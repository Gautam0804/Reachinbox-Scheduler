
import { Router } from "express";
import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { emailQueue } from "../queues/email.queue.js";
import {
  requireAuth,
  type AuthenticatedRequest,
} from "../middleware/require-auth.js";
import { env } from "../config/env.js";

const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

export const queueRouter = Router();

const adminEmails = new Set(
  env.ADMIN_EMAILS
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

queueRouter.use(
  requireAuth,
  (req, res, next) => {
    const userEmail = (
      req as AuthenticatedRequest
    ).authUser.email.toLowerCase();

    if (!adminEmails.has(userEmail)) {
      res.status(403).json({
        error: "Admin access required.",
      });
      return;
    }

    next();
  },
  serverAdapter.getRouter(),
);
