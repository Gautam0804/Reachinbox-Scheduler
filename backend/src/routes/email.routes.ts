
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma.js";
import { emailQueue } from "../queues/email.queue.js";
import { indexEmail } from "../services/email-search.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/require-auth.js";

export const emailRouter = Router();

// All email endpoints require an authenticated Google session.
emailRouter.use(requireAuth);

const scheduleEmailSchema = z.object({
  recipient: z.string().email(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(20_000),
  scheduledAt: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().min(1).max(100),
});


async function tryIndexEmail(email: {
  id: string;
  ownerGoogleId: string | null;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
}) {
  if (!email.ownerGoogleId) {
    console.warn(
      `Skipping Elasticsearch indexing for ${email.id}: ownerGoogleId is missing.`,
    );
    return;
  }

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
    console.error(
      `Failed to index email ${email.id} in Elasticsearch:`,
      error,
    );
  }
}

// GET /api/emails?status=SENT&page=1&limit=10
emailRouter.get("/", async (req, res, next) => {
  try {
    const { googleId } = (req as AuthenticatedRequest).authUser;

    const querySchema = z.object({
      status: z.enum(["SCHEDULED", "SENDING", "SENT"]).optional(),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(10),
    });

    const query = querySchema.safeParse(req.query);

    if (!query.success) {
      res.status(400).json({
        error: "Invalid query parameters.",
        details: query.error.issues,
      });
      return;
    }

    const { status, page, limit } = query.data;

    const where = {
      ownerGoogleId: googleId,
      ...(status ? { status } : {}),
    };

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          recipient: true,
          subject: true,
          body: true,
          scheduledAt: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    res.json({
      data: emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/emails/schedule
emailRouter.post("/schedule", async (req, res, next) => {
  try {
    const { googleId } = (req as AuthenticatedRequest).authUser;
    const input = scheduleEmailSchema.parse(req.body);

    const scheduledAt = new Date(input.scheduledAt);
    const delay = scheduledAt.getTime() - Date.now();

    if (delay < 1_000) {
      res.status(400).json({
        error: "Schedule the email at least 1 second in the future.",
      });
      return;
    }

    // Never return another user's email through an idempotency lookup.
    const existing = await prisma.scheduledEmail.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });

    if (existing) {
      if (existing.ownerGoogleId !== googleId) {
        res.status(409).json({
          error: "Idempotency key conflict. Please retry with a new key.",
        });
        return;
      }

      await tryIndexEmail(existing);

      res.status(200).json({
        message: "This email has already been scheduled.",
        emailId: existing.id,
        status: existing.status,
      });
      return;
    }

    const email = await prisma.scheduledEmail.create({
      data: {
        ownerGoogleId: googleId,
        recipient: input.recipient,
        subject: input.subject,
        body: input.body,
        scheduledAt,
        idempotencyKey: input.idempotencyKey,
      },
    });

    try {
      const job = await emailQueue.add(
        "send-email",
        {
          emailId: email.id,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          scheduledAt: email.scheduledAt.toISOString(),
        },
        {
          jobId: `email-${email.id}`,
          delay,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2_000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );

      await tryIndexEmail(email);

      res.status(202).json({
        message: "Email scheduled.",
        emailId: email.id,
        jobId: job.id,
        scheduledAt: email.scheduledAt.toISOString(),
        status: email.status,
      });
    } catch (queueError) {
      console.error(
        `Failed to enqueue email ${email.id}:`,
        queueError,
      );

      res.status(503).json({
        error:
          "The email was saved, but the scheduling queue is unavailable. Please contact support before retrying.",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid request.",
        details: error.issues,
      });
      return;
    }

    next(error);
  }
});
