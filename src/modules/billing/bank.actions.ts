"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { handleSepayTransaction, type BankHandleResult } from "@/modules/billing/bank.service";
import { getSettings } from "@/modules/settings/settings.service";
import { vnNow } from "@/lib/dates";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

async function guard() {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: fail("UNAUTHENTICATED") } as const;
  if (!can(user, "billing.manage")) return { ok: false, error: fail("PERMISSION_DENIED") } as const;
  return { ok: true, user } as const;
}

function refresh() {
  revalidatePath("/thu-tien", "layout");
  revalidatePath("/hom-nay");
  revalidatePath("/thong-ke");
}

/** Giả lập được bật trên máy dev; khi đưa lên mạng thì tắt, trừ khi đặt BANK_SIMULATOR=on. */
function simulatorEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.BANK_SIMULATOR === "on";
}

const simulateSchema = z.object({
  amount: z.coerce.number().int().min(1000, "Số tiền ít nhất 1.000đ").max(100_000_000),
  content: z.string().trim().max(200),
});

/**
 * Giả lập "tiền về tài khoản" — đi qua ĐÚNG đường xử lý của webhook SePay thật (handleSepayTransaction),
 * chỉ khác là dữ liệu do cô tự nhập. Để thử đủ trường hợp mà không cần chuyển tiền thật.
 */
export async function simulateBankTransferAction(input: unknown): Promise<ActionResult<BankHandleResult>> {
  const g = await guard();
  if (!g.ok) return g.error;
  if (!simulatorEnabled()) return fail("PERMISSION_DENIED", "Chỉ dùng được trên máy thử.");
  const parsed = simulateSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const settings = await getSettings();
  const now = vnNow();
  const result = await handleSepayTransaction(
    {
      id: `SIM-${Date.now()}`,
      gateway: settings.bank.bankName || "MB Bank",
      transactionDate: `${now.dateKey} ${now.time}:00`,
      accountNumber: settings.bank.accountNo,
      code: null,
      content: parsed.data.content,
      transferType: "in",
      transferAmount: parsed.data.amount,
      accumulated: null,
      subAccount: null,
      referenceCode: `SIM.${Date.now()}`,
      description: parsed.data.content,
    },
    g.user.id,
  );
  refresh();
  return ok(result);
}

const assignSchema = z.object({
  transactionId: z.string().min(1),
  studentId: z.string().min(1),
});

/** Cô gán khoản tiền chưa khớp cho một em → ghi nhận đã thu (đúng số tiền đã về). Sổ cái tự phân bổ vào phiếu cũ nhất. */
export async function assignBankTransactionAction(input: unknown): Promise<ActionResult<{ paymentId: string }>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { transactionId, studentId } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.bankTransaction.findUnique({ where: { id: transactionId } });
    if (!row) return fail("NOT_FOUND");
    if (row.matchedPaymentId || row.dismissedAt) return fail("CONFLICT", "Khoản tiền này đã được xử lý rồi ạ.");
    const student = await tx.student.findFirst({ where: { id: studentId, deletedAt: null }, select: { id: true } });
    if (!student) return fail("NOT_FOUND");
    const payment = await tx.payment.create({
      data: {
        studentId,
        amount: row.amount,
        paidAt: row.receivedAt,
        method: "BANK_TRANSFER",
        source: "WEBHOOK",
        status: "CONFIRMED",
        bankRef: row.externalId,
        note: `Cô gán từ tiền về: "${row.content}"`,
        confirmedAt: new Date(),
      },
    });
    await tx.bankTransaction.update({ where: { id: row.id }, data: { matchedPaymentId: payment.id, decision: "MATCHED" } });
    await writeAuditLog(tx, {
      actorId: g.user.id,
      action: "BANK_ASSIGN",
      entity: "Payment",
      entityId: payment.id,
      after: { amount: payment.amount, studentId, bankTransaction: row.id },
      reason: row.reason,
    });
    return ok({ paymentId: payment.id });
  });
  if (result.ok) {
    refresh();
    revalidatePath(`/hoc-sinh/${studentId}`);
  }
  return result;
}

/** "Không phải học phí" — ẩn khỏi danh sách chờ (vẫn giữ lịch sử). */
export async function dismissBankTransactionAction(transactionId: string): Promise<ActionResult<null>> {
  const g = await guard();
  if (!g.ok) return g.error;
  const row = await prisma.bankTransaction.findUnique({ where: { id: transactionId } });
  if (!row) return fail("NOT_FOUND");
  if (row.matchedPaymentId) return fail("CONFLICT", "Khoản tiền này đã được gán cho một em rồi ạ.");
  await prisma.$transaction(async (tx) => {
    await tx.bankTransaction.update({ where: { id: transactionId }, data: { dismissedAt: new Date() } });
    await writeAuditLog(tx, { actorId: g.user.id, action: "BANK_DISMISS", entity: "BankTransaction", entityId: transactionId, reason: "Không phải học phí" });
  });
  refresh();
  return ok(null);
}
