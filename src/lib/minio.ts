/**
 * Hạ tầng lưu file trên MinIO (S3-compatible) — lấy từ QLNS, rút gọn.
 * ⚠ Chỉ import ở server. Trình duyệt KHÔNG nhận URL MinIO: mọi lượt đọc file đi qua
 * /api/tep/[id] để kiểm quyền (học sinh chỉ xem bài của mình).
 */

import { Client } from "minio";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";

const BUCKET = process.env.MINIO_BUCKET ?? "teamcherry-files";

const globalForMinio = globalThis as unknown as { minio?: Client; minioReady?: Promise<void> };

function createClient(): Client {
  return new Client({
    endPoint: process.env.MINIO_ENDPOINT ?? "localhost",
    port: Number(process.env.MINIO_PORT ?? 9200),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "",
    secretKey: process.env.MINIO_SECRET_KEY ?? "",
  });
}

export const minio = globalForMinio.minio ?? createClient();
if (process.env.NODE_ENV !== "production") globalForMinio.minio = minio;

/** MinIO không tự tạo bucket khi putObject — tạo một lần cho mỗi tiến trình. */
function ensureBucket(): Promise<void> {
  globalForMinio.minioReady ??= (async () => {
    const exists = await minio.bucketExists(BUCKET).catch(() => false);
    if (!exists) await minio.makeBucket(BUCKET);
  })().catch((e) => {
    globalForMinio.minioReady = undefined;
    throw e;
  });
  return globalForMinio.minioReady;
}

/** Bỏ dấu và ký tự lạ khỏi tên file để ghép vào object key. */
function slugifyFileName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const clean =
    base
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/đ/gi, "d")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .toLowerCase() || "file";
  return ext ? `${clean}.${ext}` : clean;
}

/** "submissions/abc" + "Bài 1.jpg" → "submissions/abc/<uuid>-bai-1.jpg" */
export function buildObjectKey(prefix: string, originalName: string): string {
  return `${prefix.replace(/^\/+|\/+$/g, "")}/${randomUUID()}-${slugifyFileName(originalName)}`;
}

export async function putObject(objectKey: string, body: Buffer, mimeType: string): Promise<void> {
  await ensureBucket();
  await minio.putObject(BUCKET, objectKey, body, body.length, { "Content-Type": mimeType });
}

export async function getObjectStream(objectKey: string): Promise<Readable> {
  return minio.getObject(BUCKET, objectKey);
}

export async function removeObject(objectKey: string): Promise<void> {
  await minio.removeObject(BUCKET, objectKey);
}
