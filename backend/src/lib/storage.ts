import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { env, features } from "./env";

/**
 * Document storage. Cloudflare R2 (S3-compatible) when configured,
 * otherwise a local ./uploads folder so the app works in local dev without R2.
 * Keys are always prefixed with the workspace id for tenant isolation.
 */
let s3: S3Client | null = null;
function client() {
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}

const LOCAL_DIR = path.resolve(process.cwd(), "uploads");
const localPath = (key: string) => {
  const p = path.resolve(LOCAL_DIR, key);
  if (!p.startsWith(LOCAL_DIR)) throw new Error("Invalid storage key");
  return p;
};

export const storage = {
  async put(key: string, body: Buffer, contentType: string) {
    if (features.r2()) {
      await client().send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }));
      return;
    }
    const p = localPath(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  },

  async get(key: string): Promise<Buffer> {
    if (features.r2()) {
      const res = await client().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
      const bytes = await res.Body!.transformToByteArray();
      return Buffer.from(bytes);
    }
    return readFile(localPath(key));
  },

  async delete(key: string) {
    if (features.r2()) {
      await client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
      return;
    }
    await rm(localPath(key), { force: true });
  },
};
