
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),

  // Redis
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // PostgreSQL
  DATABASE_URL: z.string().min(1),

  // SMTP email configuration
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  // Email worker and rate limiting
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_SEND_INTERVAL_MS: z.coerce.number().int().nonnegative().default(1000),
  GLOBAL_HOURLY_LIMIT: z.coerce.number().int().positive().default(100),
  PER_SENDER_HOURLY_LIMIT: z.coerce.number().int().positive().default(30),

  // Development/testing mode for email rate limiting
  RATE_LIMIT_TEST_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),

  // Slack notifications
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_ALERT_CHANNEL: z.string().optional(),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:4000/api/slack/callback"),

  // Encryption for stored Slack OAuth tokens
  SLACK_TOKEN_ENCRYPTION_KEY: z.string().length(64),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z
    .string()
    .url()
    .default("http://localhost:4000/api/auth/google/callback"),

  // Application session
  SESSION_SECRET: z.string().min(32),

  // Bull Board admin access: comma-separated email addresses
  ADMIN_EMAILS: z.string().min(1),

  // Elasticsearch
  ELASTICSEARCH_NODE: z
    .string()
    .url()
    .default("http://localhost:9200"),
});

export const env = envSchema.parse(process.env);
