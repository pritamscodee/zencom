import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "./env";

function key(): Buffer {
  if (env.ENCRYPTION_KEY) {
    const k = /^[0-9a-f]{64}$/i.test(env.ENCRYPTION_KEY)
      ? Buffer.from(env.ENCRYPTION_KEY, "hex")
      : Buffer.from(env.ENCRYPTION_KEY, "base64");
    if (k.length === 32) return k;
  }
  return createHash("sha256").update(`zencom:${env.BETTER_AUTH_SECRET}`).digest();
}

/** AES-256-GCM encrypt any JSON-serialisable value. Output: iv.tag.ciphertext (base64url). */
export function encryptJSON(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptJSON<T = any>(payload: string): T {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !enc) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8"));
}

/** Signed, expiring state token for OAuth flows. */
export function signState(data: Record<string, string>, ttlSeconds = 600): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlSeconds * 1000 })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState<T = Record<string, string>>(state: string): T {
  const [body, sig] = state.split(".");
  if (!body || !sig) throw new Error("Invalid state");
  const expected = createHmac("sha256", key()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new Error("Invalid state signature");
  const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (typeof data.exp !== "number" || data.exp < Date.now()) throw new Error("State expired");
  return data as T;
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}
