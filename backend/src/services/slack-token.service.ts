
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { env } from "../config/env.js";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = Buffer.from(
    env.SLACK_TOKEN_ENCRYPTION_KEY,
    "hex",
  );

  if (key.length !== 32) {
    throw new Error(
      "SLACK_TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hexadecimal characters).",
    );
  }

  return key;
}

export function encryptSlackToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    ALGORITHM,
    getEncryptionKey(),
    iv,
  );

  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptSlackToken(payload: string): string {
  const parts = payload.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted Slack token format.");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
