"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

const kinds = ["FEE_SOFT", "FEE_GENTLE", "FEE_CLEAR", "ABSENCE_CHECK", "PRAISE", "SESSION_CANCELLED", "BIRTHDAY"] as const;

const logSchema = z.object({
  kind: z.enum(kinds),
  content: z.string().min(1).max(4000),
  studentId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
  /** Phiếu đang "Cần gửi" → chuyển "Đã gửi" sau khi cô sao chép tin. */
  markSent: z.boolean().default(false),
});

/** Ghi lại tin cô vừa sao chép để gửi; app KHÔNG tự gửi gì cho phụ huynh. */
export async function logMessageAction(input: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "billing.manage")) return fail("PERMISSION_DENIED");
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR");
  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.messageLog.create({
      data: { kind: d.kind, content: d.content, studentId: d.studentId || null, invoiceId: d.invoiceId || null },
    });
    if (d.markSent && d.invoiceId) {
      const inv = await tx.invoice.findUnique({ where: { id: d.invoiceId }, select: { status: true } });
      if (inv?.status === "READY") {
        await tx.invoice.update({ where: { id: d.invoiceId }, data: { status: "SENT", sentAt: new Date() } });
        await writeAuditLog(tx, { actorId: user.id, action: "INVOICE_SENT", entity: "Invoice", entityId: d.invoiceId });
      }
    }
  });
  if (d.invoiceId) {
    revalidatePath(`/thu-tien/${d.invoiceId}`);
    revalidatePath("/thu-tien");
    revalidatePath("/hom-nay");
  }
  return ok(null);
}

const templateSchema = z.object({
  id: z.string().optional().nullable(),
  kind: z.enum(kinds),
  title: z.string().trim().min(1, "Cô đặt tên mẫu giúp em").max(80),
  body: z.string().trim().min(5, "Nội dung mẫu còn ngắn quá").max(2000),
});

export async function saveTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "settings.manage")) return fail("PERMISSION_DENIED");
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { id, ...data } = parsed.data;
  const row = id
    ? await prisma.messageTemplate.update({ where: { id }, data })
    : await prisma.messageTemplate.create({ data });
  revalidatePath("/cai-dat");
  return ok({ id: row.id });
}

export async function deleteTemplateAction(id: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "settings.manage")) return fail("PERMISSION_DENIED");
  await prisma.messageTemplate.delete({ where: { id } });
  revalidatePath("/cai-dat");
  return ok(null);
}
