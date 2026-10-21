
import { DelayedError, type Job } from "bullmq";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { mailer } from "../config/mailer.js";
import { reserveSendSlot } from "../services/rate-limiter.js";
import { indexEmail } from "../services/email-search.js";
import type { ScheduledEmailJob } from "../types/email.js";
import { sendSlackNotification } from "../services/slack-notification.js";

type EmailRecord = {
  id: string;
  ownerGoogleId: string | null;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  status: string;
};

async function tryIndexEmail(email: EmailRecord): Promise<void> {
  if (!email.ownerGoogleId) return;

  try {
    await indexEmail({
      id: email.id,
      ownerGoogleId: email.ownerGoogleId,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduledAt: email.scheduledAt.toISOString(),
    });
  } catch (error) {
    console.error(`Failed to index email ${email.id}:`, error);
  }
}

async function markDeliveryUnknown(email: EmailRecord): Promise<void> {
  if (!email.ownerGoogleId) return;

  try {
    const result = await prisma.scheduledEmail.updateMany({
      where: {
        id: email.id,
        ownerGoogleId: email.ownerGoogleId,
        status: "SENDING",
      },
      data: { status: "DELIVERY_UNKNOWN" },
    });

    if (result.count > 0) {
      await tryIndexEmail({
        ...email,
        status: "DELIVERY_UNKNOWN",
      });
    }
  } catch (error) {
    console.error(
      `Could not persist delivery outcome for ${email.id}.`,
      error,
    );
  }
}

async function resetBeforeSend(email: EmailRecord): Promise<void> {
  if (!email.ownerGoogleId) {
    throw new Error(`Email ${email.id} has no owner.`);
  }

  await prisma.scheduledEmail.updateMany({
    where: {
      id: email.id,
      ownerGoogleId: email.ownerGoogleId,
      status: "SENDING",
    },
    data: { status: "SCHEDULED" },
  });
}

async function trySendSlackNotification(
  ownerGoogleId: string,
  message: string,
): Promise<void> {
  try {
    await sendSlackNotification(ownerGoogleId, message);
  } catch (error) {
    console.error(
      "Slack notification failed; email delivery remains successful.",
      error,
    );
  }
}

export async function processEmail(
  job: Job<ScheduledEmailJob>,
): Promise<void> {
  const { emailId } = job.data;

  const existing = await prisma.scheduledEmail.findUnique({
    where: { id: emailId },
  });

  if (!existing || existing.status !== "SCHEDULED") {
    console.log(
      `Skipping email ${emailId}: status=${existing?.status ?? "NOT_FOUND"}.`,
    );
    return;
  }

  if (!existing.ownerGoogleId) {
    console.error(
      `Skipping email ${emailId}: no ownerGoogleId is assigned.`,
    );
    return;
  }

  await tryIndexEmail(existing);

  // Atomically claim the email to avoid duplicate processing.
  const claim = await prisma.scheduledEmail.updateMany({
    where: {
      id: emailId,
      ownerGoogleId: existing.ownerGoogleId,
      status: "SCHEDULED",
    },
    data: { status: "SENDING" },
  });

  if (claim.count === 0) return;

  let waitMs: number;

  try {
    waitMs = await reserveSendSlot(emailId, env.EMAIL_FROM);
  } catch (error) {
    try {
      await resetBeforeSend(existing);
    } catch (resetError) {
      console.error(`Could not reset ${emailId}.`, resetError);
    }

    throw error;
  }

  console.log(
    `[RateLimiter] Email=${emailId}, waitMs=${waitMs}, ` +
      `minIntervalMs=${env.MIN_SEND_INTERVAL_MS}, ` +
      `globalLimit=${env.GLOBAL_HOURLY_LIMIT}, ` +
      `senderLimit=${env.PER_SENDER_HOURLY_LIMIT}`,
  );

  if (waitMs > 0) {
    const retryDelay = Math.max(waitMs, 1_000);

    console.log(
      `[RateLimiter] Rescheduling email ${emailId} after ${retryDelay}ms`,
    );

    await resetBeforeSend(existing);
    await job.moveToDelayed(Date.now() + retryDelay, job.token);

    throw new DelayedError();
  }

  try {
    await mailer.sendMail({
      from: env.EMAIL_FROM,
      to: existing.recipient,
      subject: existing.subject,
      text: existing.body,
    });
  } catch (error) {
    await markDeliveryUnknown(existing);
    throw error;
  }

  let updated: { count: number };

  try {
    updated = await prisma.scheduledEmail.updateMany({
      where: {
        id: emailId,
        ownerGoogleId: existing.ownerGoogleId,
        status: "SENDING",
      },
      data: { status: "SENT" },
    });
  } catch (error) {
    await markDeliveryUnknown(existing);
    throw error;
  }

  if (updated.count === 0) {
    console.error(
      `SMTP accepted ${emailId}, but the SENT status was not persisted.`,
    );
    return;
  }

  await tryIndexEmail({
    ...existing,
    status: "SENT",
  });

  await trySendSlackNotification(
    existing.ownerGoogleId,
    [
      "✅ *Scheduled email sent successfully!*",
      `*To:* ${existing.recipient}`,
      `*Subject:* ${existing.subject}`,
      `*Email ID:* ${existing.id}`,
    ].join("\n"),
  );

  console.log(`Email sent. ID=${emailId}`);
}
