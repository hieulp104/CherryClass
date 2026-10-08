"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { effectiveUnitPrice } from "@/modules/billing/billing.core";
import {
  adjustInvoiceSchema,
  confirmClaimSchema,
  counterAdjustSchema,
  recordPaymentSchema,
  voidInvoiceSchema,
  waiveLineSchema,
} from "@/modules/billing/billing.schema";
import { issueDueInvoices, recomputeInvoice, type IssuedInvoice } from "@/modules/billing/billing.service";
import { getSettings } from "@/modules/settings/settings.service";
import { toDbDate } from "@/lib/dates";
import { formatVnd } from "@/lib/utils";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ";
}

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: fail("UNAUTHENTICATED") } as const;
  if (!can(user, "billing.manage")) return { ok: false, error: fail("PERMISSION_DENIED") } as const;
  return { ok: true, user } as const;
}

function refresh(studentId?: string, invoiceId?: string) {
  revalidatePath("/thu-tien");
  revalidatePath("/hom-nay");
  revalidatePath("/thong-ke");
  if (invoiceId) revalidatePath(`/thu-tien/${invoiceId}`);
  if (studentId) revalidatePath(`/hoc-sinh/${studentId}`);
}

const NEGATIVE = "Sau khi sửa, phiếu bị âm tiền. Cô kiểm tra lại số tiền giảm giúp em nhé.";

/** Sửa tay số tiền của phiếu (±), lý do bắt buộc, lưu cả giá trị cũ và mới. */
export async function adjustInvoiceAction(input: unknown): Promise<ActionResult<{ amount: number }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = adjustInvoiceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { invoiceId, delta, reason } = parsed.data;
  const settings = await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!before) throw new Error("NOT_FOUND");
      if (before.status === "VOID") throw new Error("VOID");
      await tx.invoiceAdjustment.create({ data: { invoiceId, delta, reason, createdById: g.user.id } });
      const after = await recomputeInvoice(tx, invoiceId, settings.billing);
      await writeAuditLog(tx, {
        actorId: g.user.id,
        action: "INVOICE_ADJUST",
        entity: "Invoice",
        entityId: invoiceId,
        before: { amount: before.amount, adjustmentTotal: before.adjustmentTotal },
        after: { amount: after.amount, adjustmentTotal: after.adjustmentTotal, delta },
        reason,
      });
      return after;
    });
    refresh(result.studentId, invoiceId);
    return ok({ amount: result.amount });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "NEGATIVE_INVOICE") return fail("VALIDATION_ERROR", NEGATIVE);
    if (msg === "NOT_FOUND") return fail("NOT_FOUND");
    if (msg === "VOID") return fail("CONFLICT", "Phiếu đã hủy, không sửa được nữa.");
    throw e;
  }
}

/** Miễn / bỏ miễn một buổi trong phiếu. Buổi vẫn gắn với phiếu nên không bị tính lại ở chu kỳ sau. */
export async function waiveLineAction(input: unknown): Promise<ActionResult<{ amount: number }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = waiveLineSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { lineId, waived, reason } = parsed.data;
  if (waived && (!reason || reason.length < 3)) {
    return fail("VALIDATION_ERROR", "Cô ghi lý do miễn buổi giúp em nhé.");
  }
  const settings = await getSettings();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const line = await tx.invoiceLine.findUnique({ where: { id: lineId }, include: { invoice: true } });
      if (!line) throw new Error("NOT_FOUND");
      if (line.invoice.status === "VOID") throw new Error("VOID");
      await tx.invoiceLine.update({
        where: { id: lineId },
        data: { waived, waiveReason: waived ? reason : null },
      });
      const after = await recomputeInvoice(tx, line.invoiceId, settings.billing);
      await writeAuditLog(tx, {
        actorId: g.user.id,
        action: waived ? "INVOICE_LINE_WAIVE" : "INVOICE_LINE_UNWAIVE",
        entity: "Invoice",
        entityId: line.invoiceId,
        before: { amount: line.invoice.amount, lineId, waived: line.waived },
        after: { amount: after.amount, lineId, waived },
        reason: reason ?? null,
      });
      return after;
    });
    refresh(result.studentId, result.id);
    return ok({ amount: result.amount });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "NEGATIVE_INVOICE") return fail("VALIDATION_ERROR", NEGATIVE);
    if (msg === "NOT_FOUND") return fail("NOT_FOUND");
    if (msg === "VOID") return fail("CONFLICT", "Phiếu đã hủy, không sửa được nữa.");
    throw e;
  }
}

/**
 * Hủy phiếu: các buổi trong phiếu được trả lại bộ đếm rồi phát hành lại ngay (nếu vẫn đủ chu kỳ).
 * Dùng khi phiếu sai giảm giá / sai buổi — phiếu mới là phiếu "chưa gửi" nên sửa điểm danh được.
 * Tiền đã đóng không mất: nằm ở sổ cái của em và tự trừ vào phiếu mới.
 */
export async function voidInvoiceAction(input: unknown): Promise<ActionResult<{ reissued: IssuedInvoice[] }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = voidInvoiceSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const settings = await getSettings();

  const result = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUnique({ where: { id: parsed.data.invoiceId }, include: { lines: true } });
    if (!inv || inv.status === "VOID") return null;
    await tx.invoice.update({
      where: { id: inv.id },
      data: { status: "VOID", voidedAt: new Date(), voidReason: parsed.data.reason },
    });
    // Gỡ dòng để các buổi quay về bộ đếm (attendanceId là UNIQUE nên phải gỡ mới phát hành lại được).
    await tx.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
    await tx.payment.updateMany({ where: { invoiceId: inv.id }, data: { invoiceId: null } });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: "INVOICE_VOID",
      entity: "Invoice",
      entityId: inv.id,
      before: { ...inv, lines: inv.lines.map((l) => l.attendanceId) },
      reason: parsed.data.reason,
    });
    const reissued = await issueDueInvoices(tx, inv.studentId, settings.billing, g.user.id);
    return { studentId: inv.studentId, reissued };
  });
  if (!result) return fail("NOT_FOUND");
  refresh(result.studentId, parsed.data.invoiceId);
  return ok({ reissued: result.reissued });
}

/** Đánh dấu đã gửi phiếu cho phụ huynh (khi cô sao chép tin nhắn / tự gửi). Khóa sửa điểm danh các buổi trong phiếu. */
export async function markInvoiceSentAction(invoiceId: string): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return fail("NOT_FOUND");
  if (inv.status === "READY") {
    await prisma.$transaction(async (tx) => {
      await tx.invoice.update({ where: { id: invoiceId }, data: { status: "SENT", sentAt: new Date() } });
      await writeAuditLog(tx, { actorId: g.user.id, action: "INVOICE_SENT", entity: "Invoice", entityId: invoiceId });
    });
  }
  refresh(inv.studentId, invoiceId);
  return ok(null);
}

/**
 * Sửa tay bộ đếm buổi:
 * - Cộng: thêm buổi "cộng tay" (vd các buổi đã học trước khi dùng app) rồi phát hành phiếu nếu đủ chu kỳ.
 * - Trừ: bỏ tính tiền các buổi GẦN NHẤT chưa vào phiếu.
 */
export async function adjustCounterAction(input: unknown): Promise<ActionResult<{ issued: IssuedInvoice[] }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = counterAdjustSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const { studentId, delta, date, reason } = parsed.data;
  const settings = await getSettings();

  const result = await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id: studentId } });
    if (!student) return { error: fail("NOT_FOUND") };
    if (delta > 0) {
      const unitPrice = effectiveUnitPrice(student.unitPrice, settings.billing);
      await tx.attendance.createMany({
        data: Array.from({ length: delta }, () => ({
          studentId,
          date: toDbDate(date),
          status: "PRESENT" as const,
          source: "MANUAL" as const,
          billable: true,
          unitPrice,
          reason,
        })),
      });
    } else {
      const rows = await tx.attendance.findMany({
        where: { studentId, billable: true, invoiceLine: { is: null } },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: -delta,
        select: { id: true },
      });
      if (rows.length < -delta) {
        return { error: fail("CONFLICT", `Bộ đếm hiện chỉ có ${rows.length} buổi chưa vào phiếu, không trừ ${-delta} buổi được.`) };
      }
      await tx.attendance.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { billable: false, reason: `Cô trừ tay: ${reason}` },
      });
    }
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: "COUNTER_ADJUST",
      entity: "Student",
      entityId: studentId,
      after: { delta, date },
      reason,
    });
    const issued = await issueDueInvoices(tx, studentId, settings.billing, g.user.id);
    return { issued };
  });
  if ("error" in result && result.error) return result.error;
  refresh(studentId);
  return ok({ issued: result.issued ?? [] });
}

// ─────────────────── Tiền vào ───────────────────

export async function recordPaymentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const d = parsed.data;
  const row = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        studentId: d.studentId,
        invoiceId: d.invoiceId || null,
        amount: d.amount,
        // 12:00 giờ VN của ngày đóng — lọc theo tháng không bị lệch múi giờ.
        paidAt: new Date(`${d.paidAt}T12:00:00.000+07:00`),
        method: d.method,
        source: "MANUAL",
        status: "CONFIRMED",
        confirmedAt: new Date(),
        note: d.note || null,
      },
    });
    await writeAuditLog(tx, { actorId: g.user.id, action: "PAYMENT_RECORD", entity: "Payment", entityId: p.id, after: p });
    return p;
  });
  refresh(d.studentId, d.invoiceId ?? undefined);
  return ok({ id: row.id });
}

/** Xác nhận khoản phụ huynh báo đã chuyển. Số tiền sửa được nếu thực nhận khác (đóng thiếu). */
export async function confirmClaimAction(input: unknown): Promise<ActionResult<{ amount: number }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = confirmClaimSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", firstIssue(parsed.error));
  const p = await prisma.payment.findUnique({ where: { id: parsed.data.paymentId } });
  if (!p) return fail("NOT_FOUND");
  if (p.status !== "PENDING") return fail("CONFLICT", "Khoản này đã được xử lý rồi ạ.");
  await prisma.$transaction(async (tx) => {
    const after = await tx.payment.update({
      where: { id: p.id },
      data: { status: "CONFIRMED", amount: parsed.data.amount, confirmedAt: new Date() },
    });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: "PAYMENT_CONFIRM",
      entity: "Payment",
      entityId: p.id,
      before: { amount: p.amount, status: p.status },
      after: { amount: after.amount, status: after.status },
      reason: p.amount !== after.amount ? `Thực nhận ${formatVnd(after.amount)} khác số phụ huynh báo` : null,
    });
  });
  refresh(p.studentId, p.invoiceId ?? undefined);
  return ok({ amount: parsed.data.amount });
}

/** Chưa thấy tiền về → từ chối khoản báo (không xóa, vẫn giữ lịch sử). */
export async function rejectClaimAction(paymentId: string): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!p) return fail("NOT_FOUND");
  if (p.status !== "PENDING") return fail("CONFLICT", "Khoản này đã được xử lý rồi ạ.");
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { status: "REJECTED" } });
    await writeAuditLog(tx, { actorId: g.user.id, action: "PAYMENT_REJECT", entity: "Payment", entityId: paymentId });
  });
  refresh(p.studentId, p.invoiceId ?? undefined);
  return ok(null);
}

/** Hủy một khoản thu cô đã ghi nhầm. Không xóa — chuyển REJECTED kèm lý do. */
export async function cancelPaymentAction(input: { paymentId: string; reason: string }): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const reason = String(input.reason ?? "").trim();
  if (reason.length < 3) return fail("VALIDATION_ERROR", "Cô ghi lý do hủy khoản thu giúp em nhé.");
  const p = await prisma.payment.findUnique({ where: { id: input.paymentId } });
  if (!p) return fail("NOT_FOUND");
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: p.id }, data: { status: "REJECTED", note: `${p.note ?? ""} [Đã hủy: ${reason}]`.trim() } });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: "PAYMENT_CANCEL",
      entity: "Payment",
      entityId: p.id,
      before: p,
      reason,
    });
  });
  refresh(p.studentId, p.invoiceId ?? undefined);
  return ok(null);
}
