// Phase 13 D6: AES-256-GCM credential encryption.
// CRITICAL: encryption keys must never be stored with encrypted data.
// Keys come from INTEGRATION_ENCRYPTION_KEY env var (32 bytes, base64).
// Decrypted credentials exist only for the minimum required execution scope.
// Credentials are never returned to the browser, never logged.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard IV length

function getKey(): Buffer {
  const keyEnv = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY environment variable is required for integration credential encryption. " +
        "Generate with: openssl rand -base64 32",
    );
  }
  // The env var is base64-encoded 32 bytes
  const key = Buffer.from(keyEnv, "base64");
  if (key.length !== 32) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY must be 32 bytes (base64-encoded). Current length: " + key.length,
    );
  }
  return key;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
}

export function encrypt(plaintext: string): EncryptedPayload {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prepend auth tag to ciphertext (GCM requires it for decryption)
  const combined = Buffer.concat([authTag, encrypted]);
  return {
    ciphertext: combined.toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const combined = Buffer.from(payload.ciphertext, "base64");
  // Extract auth tag (first 16 bytes) and ciphertext
  const authTag = combined.subarray(0, 16);
  const ciphertext = combined.subarray(16);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

// Check if encryption is configured (without throwing)
export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}
