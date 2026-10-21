
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { RATE_LIMIT_SCRIPT } from "./rate-limiter.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://127.0.0.1:6380";

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
});

const PREFIX = `rate-limit-test:${process.pid}:`;

const globalKey = `${PREFIX}global`;
const senderKey = `${PREFIX}sender`;
const lastSendKey = `${PREFIX}last-send`;

const WINDOW_MS = 60_000;
const MIN_INTERVAL_MS = 1_000;
const GLOBAL_LIMIT = 2;
const SENDER_LIMIT = 2;

let currentTime: number;

async function reserve(
  emailId: string,
  sender = "test-sender",
): Promise<number> {
  return Number(
    await redis.eval(
      RATE_LIMIT_SCRIPT,
      3,
      globalKey,
      senderKey,
      lastSendKey,
      String(currentTime),
      String(WINDOW_MS),
      String(MIN_INTERVAL_MS),
      String(GLOBAL_LIMIT),
      String(SENDER_LIMIT),
      emailId,
    ),
  );
}

describe("Redis rate limiter integration", () => {
  beforeAll(async () => {
    await redis.connect();
    expect(await redis.ping()).toBe("PONG");
  });

  beforeEach(async () => {
    await redis.del(globalKey, senderKey, lastSendKey);
    currentTime = Date.now() + 10_000;
  });

  afterAll(async () => {
    await redis.del(globalKey, senderKey, lastSendKey);
    await redis.quit();
  });

  it("reserves a slot when limits allow sending", async () => {
    expect(await reserve("email-1")).toBe(0);

    expect(await redis.zcard(globalKey)).toBe(1);
    expect(await redis.zcard(senderKey)).toBe(1);
  });

  it("enforces the global hourly limit", async () => {
    expect(await reserve("email-1")).toBe(0);

    currentTime += MIN_INTERVAL_MS + 10;
    expect(await reserve("email-2")).toBe(0);

    currentTime += MIN_INTERVAL_MS + 10;
    const waitMs = await reserve("email-3");

    expect(waitMs).toBeGreaterThan(0);
    expect(await redis.zcard(globalKey)).toBe(2);
  });

  it("enforces the per-sender hourly limit", async () => {
    expect(await reserve("email-1", "sender-a")).toBe(0);

    currentTime += MIN_INTERVAL_MS + 10;
    expect(await reserve("email-2", "sender-a")).toBe(0);

    currentTime += MIN_INTERVAL_MS + 10;
    const waitMs = await reserve("email-3", "sender-a");

    expect(waitMs).toBeGreaterThan(0);
  });

  it("enforces the minimum interval between sends", async () => {
    expect(await reserve("email-1")).toBe(0);

    currentTime += 100;
    const waitMs = await reserve("email-2");

    expect(waitMs).toBeGreaterThan(0);
  });

  it("does not consume quota twice for an existing reservation", async () => {
    expect(await reserve("email-1")).toBe(0);

    // A repeated reservation for the same email is idempotent.
    expect(await reserve("email-1")).toBe(0);

    expect(await redis.zcard(globalKey)).toBe(1);
    expect(await redis.zcard(senderKey)).toBe(1);
  });

  it("allows sending after the rate-limit window expires", async () => {
    expect(await reserve("email-1")).toBe(0);

    currentTime += WINDOW_MS + 1;

    expect(await reserve("email-2")).toBe(0);
    expect(await redis.zcard(globalKey)).toBe(1);
  });
});
