
import { prisma } from "../config/prisma.js";
import { indexEmail } from "../services/email-search.js";

const STALE_SENDING_AFTER_MS = 30 * 60 * 1000;

export async function recoverStaleSendingEmails(): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_SENDING_AFTER_MS);

  const staleEmails = await prisma.scheduledEmail.findMany({
    where: {
      status: "SENDING",
      updatedAt: { lt: cutoff },
    },
  });

  let recoveredCount = 0;

  for (const email of staleEmails) {
    const recovered = await prisma.scheduledEmail.updateMany({
      where: {
        id: email.id,
        status: "SENDING",
        updatedAt: { lt: cutoff },
      },
      data: { status: "DELIVERY_UNKNOWN" },
    });

    if (recovered.count === 0) continue;

    recoveredCount++;

    if (email.ownerGoogleId) {
      try {
        await indexEmail({
          id: email.id,
          ownerGoogleId: email.ownerGoogleId,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          status: "DELIVERY_UNKNOWN",
          scheduledAt: email.scheduledAt.toISOString(),
        });
      } catch (error) {
        console.error(`Failed to index email ${email.id}:`, error);
      }
    }

    console.warn(
      `Email ${email.id} moved to DELIVERY_UNKNOWN. ` +
      "Verify delivery before considering a resend.",
    );
  }

  console.log(
    `Stale email recovery completed. ` +
    `Records reviewed: ${staleEmails.length}; recovered: ${recoveredCount}.`,
  );
}
