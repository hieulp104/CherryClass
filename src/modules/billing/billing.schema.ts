import { z } from "zod";

const money = z.preprocess(
  (v) => (typeof v === "string" ? Number(v.replace(/[^\d-]/g, "")) : v),
  z.number().int("Số tiền phải là số nguyên đồng"),
);

const reason = z.string().trim().min(3, "Cô ghi lý do giúp em (ít nhất vài chữ) để sau này đối chiếu nhé").max(300);

export const adjustInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
  delta: money.refine((v) => v !== 0, "Số tiền điều chỉnh phải khác 0"),
  reason,
});

export const waiveLineSchema = z.object({
  lineId: z.string().min(1),
  waived: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export const voidInvoiceSchema = z.object({ invoiceId: z.string().min(1), reason });

export const counterAdjustSchema = z.object({
  studentId: z.string().min(1),
  delta: z.coerce.number().int().min(-30).max(30).refine((v) => v !== 0, "Số buổi phải khác 0"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason,
});

export const recordPaymentSchema = z.object({
  studentId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  amount: money.refine((v) => v > 0, "Số tiền phải lớn hơn 0"),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.enum(["BANK_TRANSFER", "CASH"]),
  note: z.string().trim().max(300).optional().nullable(),
});

export const confirmClaimSchema = z.object({
  paymentId: z.string().min(1),
  amount: money.refine((v) => v > 0, "Số tiền phải lớn hơn 0"),
});
