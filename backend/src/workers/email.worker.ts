
import "dotenv/config";

import { Worker, Queue } from "bullmq";

import { redisConnection } from "../config/redis.js";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { mailer } from "../config/mailer.js";
import type { ScheduledEmailJob } from "../types/email.js";
import { processEmail } from "./email.processor.js";
import { recoverStaleSendingEmails } from "./email-recovery.js";

const QUEUE_NAME = "email-scheduler";

const emailQueue = new Queue<ScheduledEmailJob>(QUEUE_NAME, {
  connection: redisConnection,
});

async function main(): Promise<void> {
  await recoverStaleSendingEmails();

  const worker = new Worker<ScheduledEmailJob>(
    QUEUE_NAME,
    processEmail,
    {
      connection: redisConnection,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  worker.on("ready", () => {
    console.log("BullMQ worker is ready.");
  });

  worker.on("drained", () => {
    console.log("Worker queue drained; waiting for next job.");
  });

  worker.on("active", (job) => {
    console.log(`Job ${job.id} became active.`);
  });

  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed.`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id} failed:`, error.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`Job ${jobId} stalled.`);
  });

  worker.on("error", (error) => {
    console.error("BullMQ worker error:", error);
  });

  console.log(
    `Email worker started with concurrency ${env.WORKER_CONCURRENCY}.`,
  );

  let shuttingDown = false;

  async function shutdown(): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log("Shutting down email worker...");

    try {
      await worker.close();
      await emailQueue.close();
      await mailer.close();
      await prisma.$disconnect();
      await redisConnection.quit();

      console.log("Email worker shut down cleanly.");
    } catch (error) {
      console.error("Error during worker shutdown:", error);
      process.exitCode = 1;
    }
  }

  process.once("SIGINT", () => {
    void shutdown();
  });

  process.once("SIGTERM", () => {
    void shutdown();
  });
}

main().catch((error) => {
  console.error("Failed to start email worker:", error);
  process.exitCode = 1;
});
