import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";
import type { ScheduledEmailJob } from "../types/email.js";

export const emailQueue = new Queue<ScheduledEmailJob>(
  "email-scheduler",
  { connection: redisConnection },
);