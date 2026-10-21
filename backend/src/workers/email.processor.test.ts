
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DelayedError, type Job } from "bullmq";
import type { ScheduledEmailJob } from "../types/email.js";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  slackFindUnique: vi.fn(),
  sendMail: vi.fn(),
  reserveSendSlot: vi.fn(),
  indexEmail: vi.fn(),
  moveToDelayed: vi.fn(),
}));

vi.mock("../config/env.js", () => ({
  env: {
    EMAIL_FROM: "test@example.com",
  },
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    scheduledEmail: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
    slackConnection: {
      findUnique: mocks.slackFindUnique,
    },
  },
}));

vi.mock("../config/mailer.js", () => ({
  mailer: {
    sendMail: mocks.sendMail,
  },
}));

vi.mock("../services/rate-limiter.js", () => ({
  reserveSendSlot: mocks.reserveSendSlot,
}));

vi.mock("../services/email-search.js", () => ({
  indexEmail: mocks.indexEmail,
}));

import { processEmail } from "./email.processor.js";

const email = {
  id: "email-1",
  ownerGoogleId: "google-user-1",
  recipient: "recipient@example.com",
  subject: "Test subject",
  body: "Test body",
  scheduledAt: new Date("2026-10-21T10:00:00Z"),
  status: "SCHEDULED",
};

function makeJob(): Job<ScheduledEmailJob> {
  return {
    data: { emailId: email.id },
    id: email.id,
    token: "test-token",
    moveToDelayed: mocks.moveToDelayed,
  } as unknown as Job<ScheduledEmailJob>;
}

describe("processEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.slackFindUnique.mockResolvedValue(null);
    mocks.findUnique.mockResolvedValue({ ...email });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.sendMail.mockResolvedValue({});
    mocks.reserveSendSlot.mockResolvedValue(0);
    mocks.indexEmail.mockResolvedValue(undefined);
    mocks.moveToDelayed.mockResolvedValue(undefined);
  });

  it("sends an email and marks it SENT", async () => {
    await processEmail(makeJob());

    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: "test@example.com",
      to: email.recipient,
      subject: email.subject,
      text: email.body,
    });

    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ status: "SCHEDULED" }),
        data: { status: "SENDING" },
      }),
    );

    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ status: "SENDING" }),
        data: { status: "SENT" },
      }),
    );

    expect(mocks.indexEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: email.id,
        status: "SENT",
      }),
    );
  });

  it("marks delivery unknown when SMTP fails", async () => {
    mocks.sendMail.mockRejectedValue(
      new Error("SMTP connection failed"),
    );

    await expect(processEmail(makeJob())).rejects.toThrow(
      "SMTP connection failed",
    );

    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SENDING" }),
        data: { status: "DELIVERY_UNKNOWN" },
      }),
    );
  });

  it("does not send an email that is already processed", async () => {
    mocks.findUnique.mockResolvedValue({
      ...email,
      status: "SENT",
    });

    await processEmail(makeJob());

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("does not send if another worker already claimed the email", async () => {
    mocks.updateMany.mockResolvedValueOnce({ count: 0 });

    await processEmail(makeJob());

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.reserveSendSlot).not.toHaveBeenCalled();
  });

  it("does not send an email without an owner", async () => {
    mocks.findUnique.mockResolvedValue({
      ...email,
      ownerGoogleId: null,
    });

    await processEmail(makeJob());

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("continues delivery when Elasticsearch indexing fails", async () => {
    mocks.indexEmail.mockRejectedValue(
      new Error("Elasticsearch unavailable"),
    );

    await processEmail(makeJob());

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);

    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { status: "SENT" },
      }),
    );
  });

  it("delays the job when the rate limit is active", async () => {
    mocks.reserveSendSlot.mockResolvedValue(5_000);

    const job = makeJob();
    const before = Date.now();

    await expect(processEmail(job)).rejects.toBeInstanceOf(
      DelayedError,
    );

    const after = Date.now();

    expect(mocks.sendMail).not.toHaveBeenCalled();

    expect(mocks.moveToDelayed).toHaveBeenCalledTimes(1);

    const [delayedUntil, token] =
      mocks.moveToDelayed.mock.calls[0];

    expect(delayedUntil).toBeGreaterThanOrEqual(
      before + 5_000,
    );
    expect(delayedUntil).toBeLessThanOrEqual(
      after + 5_000,
    );
    expect(token).toBe("test-token");

    expect(mocks.updateMany).toHaveBeenCalledTimes(2);

    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "SENDING",
        }),
        data: { status: "SCHEDULED" },
      }),
    );
  });

  it("does not send when the rate limiter fails", async () => {
    mocks.reserveSendSlot.mockRejectedValue(
      new Error("Redis unavailable"),
    );

    await expect(processEmail(makeJob())).rejects.toThrow(
      "Redis unavailable",
    );

    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);

    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "SENDING",
        }),
        data: { status: "SCHEDULED" },
      }),
    );
  });

  it("does not resend when persisting SENT fails after SMTP succeeds", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 }) // Claim SENDING
      .mockRejectedValueOnce(
        new Error("Database write failed"),
      ) // Persist SENT
      .mockResolvedValueOnce({ count: 1 }); // DELIVERY_UNKNOWN

    await expect(processEmail(makeJob())).rejects.toThrow(
      "Database write failed",
    );

    expect(mocks.sendMail).toHaveBeenCalledTimes(1);

    expect(mocks.updateMany).toHaveBeenCalledTimes(3);

    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "SENDING",
        }),
        data: { status: "DELIVERY_UNKNOWN" },
      }),
    );
  });
});
