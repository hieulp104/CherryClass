/**
 * Ghi nhật ký (AuditLog) — theo QLNS.
 * Gọi BÊN TRONG `prisma.$transaction` cùng lệnh ghi dữ liệu để log rollback cùng nghiệp vụ.
 * Mọi thao tác chạm tới tiền (chốt buổi, tạo/sửa/hủy phiếu, xác nhận thu) bắt buộc ghi log.
 */

import { headers } from "next/headers";

import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/shared/prisma/prisma.service";

type AuditClient = Pick<PrismaClient, "auditLog">;

export type AuditInput = {
  actorId: string | null;
  /** SCREAMING_SNAKE: SESSION_FINALIZE, INVOICE_ADJUST, PAYMENT_CONFIRM... */
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  /** Lý do — bắt buộc với mọi lần sửa tay tiền/buổi. */
  reason?: string | null;
};

const REDACTED_FIELDS = new Set(["passwordHash", "password"]);

function toJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === "object") {
    if ("toJSON" in value && typeof value.toJSON === "function") {
      return (value as { toJSON: () => unknown }).toJSON();
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (REDACTED_FIELDS.has(k)) continue;
      out[k] = toJson(v);
    }
    return out;
  }
  return value;
}

async function requestMeta() {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    return {
      ipAddress: forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null,
      userAgent: h.get("user-agent"),
    };
  } catch {
    // Ngoài request (seed, script) thì không có header.
    return { ipAddress: null, userAgent: null };
  }
}

export async function writeAuditLog(client: AuditClient, input: AuditInput): Promise<void> {
  const meta = await requestMeta();
  await client.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: toJson(input.before) as never,
      after: toJson(input.after) as never,
      reason: input.reason ?? null,
      ...meta,
    },
  });
}

export async function audit(input: AuditInput): Promise<void> {
  await writeAuditLog(prisma, input);
}
