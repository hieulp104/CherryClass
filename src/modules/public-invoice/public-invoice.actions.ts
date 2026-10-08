"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { getPublicInvoice } from "@/modules/billing/billing.service";
import { formatVnd } from "@/lib/utils";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Phụ huynh bấm "Tôi đã chuyển khoản" — KHÔNG cần đăng nhập, chỉ cần link có mã bảo mật.
 * Tạo khoản PENDING (chưa tính là tiền đã nhận) + báo cho cô. Bấm nhiều lần chỉ ghi một lần.
 */
export async function claimTransferAction(token: string): Promise<ActionResult<{ alreadyClaimed: boolean }>> {
  const invoice = await getPublicInvoice(String(token ?? ""));
  if (!invoice || invoice.expired) return fail("NOT_FOUND", "Link phiếu không còn hiệu lực. Anh/chị nhắn cô giúp em nhé.");
  if (invoice.totalDue <= 0 || invoice.state === "PAID") return ok({ alreadyClaimed: true });

  const row = await prisma.invoice.findUnique({
    where: { publicToken: token },
    select: { id: true, studentId: true, code: true, student: { select: { fullName: true } } },
  });
  if (!row) return fail("NOT_FOUND");

  const existing = await prisma.payment.findFirst({ where: { invoiceId: row.id, status: "PENDING" } });
  if (existing) return ok({ alreadyClaimed: true });

  const teachers = await prisma.user.findMany({ where: { role: "TEACHER", isActive: true }, select: { id: true } });
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        studentId: row.studentId,
        invoiceId: row.id,
        amount: invoice.totalDue,
        paidAt: new Date(),
        method: "BANK_TRANSFER",
        source: "PARENT_CLAIM",
        status: "PENDING",
      },
    });
    await tx.notification.createMany({
      data: teachers.map((t) => ({
        userId: t.id,
        kind: "PARENT_PAYMENT_CLAIM",
        title: `Phụ huynh ${row.student.fullName} báo đã chuyển ${formatVnd(invoice.totalDue)}`,
        body: `Phiếu ${row.code} — cô kiểm tra tài khoản rồi xác nhận giúp em nhé.`,
        link: `/thu-tien/${row.id}`,
      })),
    });
    await tx.auditLog.create({
      data: { action: "PAYMENT_PARENT_CLAIM", entity: "Invoice", entityId: row.id, after: { amount: invoice.totalDue } },
    });
  });
  revalidatePath(`/p/${token}`);
  revalidatePath("/thu-tien");
  revalidatePath("/hom-nay");
  return ok({ alreadyClaimed: false });
}
