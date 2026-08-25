// Argon2id password hashing with server-side pepper (ADR-0003).
// Pepper is applied before hashing. Changing AUTH_PEPPER invalidates all existing password verifications.
import { hash as argon2Hash, verify as argon2Verify } from "@node-rs/argon2";

function getPepper(): string {
  const pepper = process.env.AUTH_PEPPER;
  if (!pepper) {
    throw new Error("AUTH_PEPPER environment variable is required");
  }
  return pepper;
}

function peppered(password: string): Buffer {
  return Buffer.concat([Buffer.from(password), Buffer.from(getPepper())]);
}

export async function hashPassword(password: string): Promise<string> {
  return argon2Hash(peppered(password), {
    algorithm: 2, // argon2id
    memoryCost: 65536, // 64 MiB
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2Verify(hash, peppered(password));
}
