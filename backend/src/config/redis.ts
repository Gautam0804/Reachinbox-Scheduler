import "dotenv/config";
import { Redis } from "ioredis";
import { env } from "./env.js";

export const redisConnection = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      retryStrategy(times) {
        return Math.min(times * 500, 5000);
      },
    })
  : new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      maxRetriesPerRequest: null,
    });