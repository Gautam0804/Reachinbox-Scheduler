
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  updateMany: vi.fn(),
  indexEmail: vi.fn(),
}));

vi.mock("../config/prisma.js", () => ({
  prisma: {
    scheduledEmail: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("../services/email-search.js", () => ({
  indexEmail: mocks.indexEmail,
}));

import { recoverStaleSendingEmails } from "./email-recovery.js";

const oldEmail = {
  id: "email-old",
  ownerGoogleId: "google-user-1",
  recipient: "recipient@example.com",
  subject: "Old email",
  body: "Email body",
  scheduledAt: new Date("2026-10-19T10:00:00Z"),
  status: "SENDING",
  updatedAt: new Date("2026-10-19T10:00:00Z"),
};

describe("recoverStaleSendingEmails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([oldEmail]);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.indexEmail.mockResolvedValue(undefined);
  });

  it("moves a stale SENDING email to DELIVERY_UNKNOWN", async () => {
    await recoverStaleSendingEmails();

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "SENDING",
          updatedAt: {
            lt: expect.any(Date),
          },
        }),
      }),
    );

    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "email-old",
          status: "SENDING",
        }),
        data: { status: "DELIVERY_UNKNOWN" },
      }),
    );

    expect(mocks.indexEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "email-old",
        status: "DELIVERY_UNKNOWN",
      }),
    );
  });

  it("does not index when another process already changed the record", async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 });

    await recoverStaleSendingEmails();

    expect(mocks.indexEmail).not.toHaveBeenCalled();
  });

  it("continues recovery if Elasticsearch indexing fails", async () => {
    mocks.indexEmail.mockRejectedValue(
      new Error("Elasticsearch unavailable"),
    );

    await expect(recoverStaleSendingEmails()).resolves.toBeUndefined();

    expect(mocks.updateMany).toHaveBeenCalled();
  });

  it("does nothing when there are no stale emails", async () => {
    mocks.findMany.mockResolvedValue([]);

    await recoverStaleSendingEmails();

    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.indexEmail).not.toHaveBeenCalled();
  });
});
