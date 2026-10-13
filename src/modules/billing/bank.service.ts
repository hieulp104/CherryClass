import { z } from "zod";

import { decideBankTransfer, parseInvoiceCode } from "@/modules/billing/billing.core";
import { displayStateOf, loadLedgers } from "@/modules/billing/billing.service";
import { getSettings } from "@/modules/settings/settings.service";
import { formatVnd, givenName } from "@/lib/utils";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Tiền về tài khoản nhận học phí (webhook SePay). Mọi quyết định khớp tiền do `decideBankTransfer` (billing.core) —
 * file này chỉ đọc DB, gọi hàm thuần, rồi ghi trong MỘT transaction kèm AuditLog.
 * Docs SePay: https://docs.sepay.vn/tich-hop-webhooks.html
 */

/** Dữ liệu SePay gửi sang (POST JSON). `id` là mã giao dịch phía SePay — dùng để chống ghi trùng khi SePay gửi lại. */
export const sepayPayloadSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  gateway: z.string().nullish(),
  /** Giờ VN dạng "2026-10-14 09:30:12". */
  transactionDate: z.string(),
  accountNumber: z.string().nullish().transform((v) => v ?? ""),
  code: z.string().nullish(),
  content: z.string().nullish().transform((v) => v ?? ""),
  transferType: z.enum(["in", "out"]),
  transferAmount: z.coerce.number(),
  accumulated: z.coerce.number().nullish(),
  subAccount: z.string().nullish(),
  referenceCode: z.string().nullish(),
  description: z.string().nullish(),
});
export type SepayPayload = z.infer<typeof sepayPayloadSchema>;

export type BankHandleResult =
  | { status: "DUPLICATE" }
  | { status: "IGNORED"; reason: string }
  | { status: "UNMATCHED"; reason: string; transactionId: string }
  | { status: "MATCHED"; paymentId: string; invoiceId: string; fit: "FULL" | "SHORT" | "OVER" };

/** "2026-10-14 09:30:12" (giờ VN) → Date. Sai định dạng thì lấy giờ hiện tại. */
function vnDateTime(s: string): Date {
  const d = new Date(`${s.trim().replace(" ", "T")}+07:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function handleSepayTransaction(p: SepayPayload, actorId: string | null = null): Promise<BankHandleResult> {
  const settings = await getSettings();
  const code = parseInvoiceCode(p.content);
  const invoice = code
    ? await prisma.invoice.findUnique({
        where: { code },
        select: { id: true, code: true, status: true, sentAt: true, studentId: true, student: { select: { fullName: true } } },
      })
    : null;
  const ledger = invoice ? (await loadLedgers([invoice.studentId])).get(invoice.studentId) : undefined;
  const totalDue = invoice ? displayStateOf(invoice, ledger, settings).totalDue : 0;
  const decision = decideBankTransfer(
    { transferType: p.transferType, amount: p.transferAmount, accountNumber: p.accountNumber, content: p.content },
    { accountNo: settings.bank.accountNo, invoice: invoice ? { code: invoice.code, status: invoice.status, totalDue } : null },
  );
  const receivedAt = vnDateTime(p.transactionDate);

  return prisma.$transaction(async (tx) => {
    // Chống trùng: SePay có thể gửi lại cùng một giao dịch (thử lại, gửi tay, nhiều webhook).
    const seen = await tx.bankTransaction.findUnique({ where: { provider_externalId: { provider: "SEPAY", externalId: p.id } } });
    if (seen) return { status: "DUPLICATE" } as const;

    const row = await tx.bankTransaction.create({
      data: {
        provider: "SEPAY",
        externalId: p.id,
        amount: Math.trunc(p.transferAmount),
        content: p.content,
        receivedAt,
        decision: decision.kind === "IGNORE" ? "IGNORED" : decision.kind,
        reason: decision.kind === "MATCHED" ? null : decision.reason,
        raw: p,
      },
    });
    if (decision.kind === "IGNORE") return { status: "IGNORED", reason: decision.reason } as const;

    const teachers = await tx.user.findMany({ where: { role: "TEACHER" }, select: { id: true } });

    if (decision.kind === "UNMATCHED" || !invoice) {
      const reason = decision.kind === "UNMATCHED" ? decision.reason : "Không tìm thấy phiếu";
      await writeAuditLog(tx, { actorId, action: "BANK_UNMATCHED", entity: "BankTransaction", entityId: row.id, after: { amount: row.amount, content: row.content }, reason });
      await tx.notification.createMany({
        data: teachers.map((t) => ({
          userId: t.id,
          kind: "BANK_UNMATCHED",
          title: `Có ${formatVnd(row.amount)} về tài khoản, chưa biết của em nào`,
          body: `${reason}. Nội dung: "${row.content}" — cô gán cho em giúp em nhé.`,
          link: "/thu-tien#tien-ve",
        })),
      });
      return { status: "UNMATCHED", reason, transactionId: row.id } as const;
    }

    // Khớp phiếu: phụ huynh đã bấm "Tôi đã chuyển khoản" thì xác nhận chính khoản đó (không ghi hai lần),
    // chưa bấm thì tạo khoản mới. Số tiền luôn là số tiền THẬT đã về.
    const claim = await tx.payment.findFirst({ where: { invoiceId: invoice.id, status: "PENDING" }, orderBy: { createdAt: "desc" } });
    const data = {
      amount: decision.amount,
      paidAt: receivedAt,
      method: "BANK_TRANSFER" as const,
      source: "WEBHOOK" as const,
      status: "CONFIRMED" as const,
      bankRef: p.referenceCode ?? p.id,
      confirmedAt: new Date(),
    };
    const payment = claim
      ? await tx.payment.update({ where: { id: claim.id }, data })
      : await tx.payment.create({ data: { ...data, studentId: invoice.studentId, invoiceId: invoice.id } });
    await tx.bankTransaction.update({ where: { id: row.id }, data: { matchedPaymentId: payment.id } });
    await writeAuditLog(tx, {
      actorId,
      action: "BANK_AUTO_CONFIRM",
      entity: "Payment",
      entityId: payment.id,
      before: claim ? { amount: claim.amount, status: claim.status } : null,
      after: { amount: payment.amount, invoice: invoice.code, bankTransaction: row.id, fit: decision.fit },
    });

    const child = givenName(invoice.student.fullName);
    const diff = Math.abs(decision.amount - totalDue);
    const body =
      decision.fit === "FULL"
        ? `Khớp phiếu ${invoice.code}, em đã tự xác nhận. Phụ huynh thấy "Đã đóng đủ".`
        : decision.fit === "SHORT"
          ? `Phiếu ${invoice.code} cần ${formatVnd(totalDue)} — chuyển thiếu ${formatVnd(diff)}, phần còn lại tự sang kỳ sau.`
          : `Phiếu ${invoice.code} cần ${formatVnd(totalDue)} — chuyển dư ${formatVnd(diff)}, tự trừ vào kỳ sau.`;
    await tx.notification.createMany({
      data: teachers.map((t) => ({
        userId: t.id,
        kind: "BANK_AUTO_CONFIRM",
        title: `Đã nhận ${formatVnd(decision.amount)} học phí của ${child}`,
        body,
        link: `/thu-tien/${invoice.id}`,
      })),
    });
    return { status: "MATCHED", paymentId: payment.id, invoiceId: invoice.id, fit: decision.fit } as const;
  });
}

/** Tiền về chưa biết của em nào — danh sách cho cô gán tay. */
export async function unmatchedBankTransactions() {
  const rows = await prisma.bankTransaction.findMany({
    where: { decision: "UNMATCHED", matchedPaymentId: null, dismissedAt: null },
    orderBy: { receivedAt: "desc" },
    take: 50,
    select: { id: true, amount: true, content: true, receivedAt: true, reason: true },
  });
  return rows.map((r) => ({ ...r, receivedAt: r.receivedAt.toISOString() }));
}
export type UnmatchedBankTransaction = Awaited<ReturnType<typeof unmatchedBankTransactions>>[number];
