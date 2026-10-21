
import { createHash } from "node:crypto";

import { redisConnection } from "../config/redis.js";
import { env } from "../config/env.js";

const HOUR_MS = 60 * 60 * 1000;

// Keep hourly limits effectively disabled in testing mode.
// The minimum send interval remains active in both modes.
const TEST_HOURLY_LIMIT = 1_000_000;

export const RATE_LIMIT_SCRIPT = `
local globalKey = KEYS[1]
local senderKey = KEYS[2]
local lastSendKey = KEYS[3]

local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local minIntervalMs = tonumber(ARGV[3])
local globalLimit = tonumber(ARGV[4])
local senderLimit = tonumber(ARGV[5])
local member = ARGV[6]

-- Remove expired reservations from both sliding windows.
redis.call("ZREMRANGEBYSCORE", globalKey, "-inf", now - windowMs)
redis.call("ZREMRANGEBYSCORE", senderKey, "-inf", now - windowMs)

-- Check whether this email already has a reservation.
local globalExisting = redis.call("ZSCORE", globalKey, member)
local senderExisting = redis.call("ZSCORE", senderKey, member)

-- Repair inconsistent reservations without consuming quota twice.
if globalExisting and senderExisting then
  return 0
end

if globalExisting and not senderExisting then
  redis.call("ZADD", senderKey, globalExisting, member)
  senderExisting = globalExisting
end

if senderExisting and not globalExisting then
  redis.call("ZADD", globalKey, senderExisting, member)
  globalExisting = senderExisting
end

-- Existing reservations must not consume quota twice.
if globalExisting and senderExisting then
  return 0
end

local globalCount = redis.call("ZCARD", globalKey)
local senderCount = redis.call("ZCARD", senderKey)
local lastSend = tonumber(redis.call("GET", lastSendKey) or "0")

local waitMs = 0

-- Enforce the global hourly limit.
if globalCount >= globalLimit then
  local oldest = redis.call("ZRANGE", globalKey, 0, 0, "WITHSCORES")

  if #oldest >= 2 then
    waitMs = math.max(
      waitMs,
      tonumber(oldest[2]) + windowMs - now
    )
  end
end

-- Enforce the per-sender hourly limit.
if senderCount >= senderLimit then
  local oldest = redis.call("ZRANGE", senderKey, 0, 0, "WITHSCORES")

  if #oldest >= 2 then
    waitMs = math.max(
      waitMs,
      tonumber(oldest[2]) + windowMs - now
    )
  end
end

-- Enforce the minimum interval between sends in both modes.
if lastSend > 0 and now - lastSend < minIntervalMs then
  waitMs = math.max(
    waitMs,
    minIntervalMs - (now - lastSend)
  )
end

-- Do not reserve a slot if the caller must wait.
if waitMs > 0 then
  return math.max(1, math.ceil(waitMs))
end

-- Atomically reserve the email in both sliding windows.
redis.call("ZADD", globalKey, now, member)
redis.call("ZADD", senderKey, now, member)

redis.call(
  "SET",
  lastSendKey,
  now,
  "PX",
  minIntervalMs + 1000
)

redis.call("PEXPIRE", globalKey, windowMs + 60000)
redis.call("PEXPIRE", senderKey, windowMs + 60000)

return 0
`;

export async function reserveSendSlot(
  emailId: string,
  sender: string,
): Promise<number> {
  const now = Date.now();

  // Hash the sender address to avoid exposing it in Redis keys.
  const senderHash = createHash("sha256")
    .update(sender.trim().toLowerCase())
    .digest("hex");

  const globalLimit = env.RATE_LIMIT_TEST_MODE
    ? TEST_HOURLY_LIMIT
    : env.GLOBAL_HOURLY_LIMIT;

  const senderLimit = env.RATE_LIMIT_TEST_MODE
    ? TEST_HOURLY_LIMIT
    : env.PER_SENDER_HOURLY_LIMIT;
console.log(
  `[RateLimiter] TestMode=${env.RATE_LIMIT_TEST_MODE}, ` +
    `waitIntervalMs=${env.MIN_SEND_INTERVAL_MS}, ` +
    `globalLimit=${globalLimit}, ` +
    `senderLimit=${senderLimit}`,
);

  const result = await redisConnection.eval(
    RATE_LIMIT_SCRIPT,
    3,
    "email-rate:global",
    `email-rate:sender:${senderHash}`,
    "email-rate:last-send",
    String(now),
    String(HOUR_MS),
    String(env.MIN_SEND_INTERVAL_MS),
    String(globalLimit),
    String(senderLimit),
    emailId,
  );

  return Number(result);
}
