import { z } from "zod";

import { normalizePhone, PHONE_PATTERN } from "@/lib/utils";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const phone = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? normalizePhone(v) : null))
  .refine((v) => v === null || PHONE_PATTERN.test(v), "SĐT gồm 10–11 số, bắt đầu bằng 0");

const date = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ngày chưa đúng");

export const studentSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().trim().min(2, "Cô nhập họ tên em giúp em nhé").max(80),
  classroomId: z.string().min(1, "Cô chọn lớp cho em nhé"),
  shiftId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  dob: date,
  school: optionalText(120),
  parentName: optionalText(80),
  parentPhone: phone,
  studentPhone: phone,
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày bắt đầu học chưa đúng"),
  /** null = theo đơn giá mặc định. */
  unitPrice: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(String(v).replace(/\D/g, ""))),
    z.number().int().min(0).max(10_000_000).nullable(),
  ),
});

export const statusSchema = z.object({
  studentId: z.string().min(1),
  status: z.enum(["ACTIVE", "PAUSED", "LEFT"]),
});

export const noteSchema = z.object({
  studentId: z.string().min(1),
  content: z.string().trim().min(1, "Ghi chú đang trống").max(2000),
});

export const siblingGroupSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Cô đặt tên nhóm (vd: Nhà chị Lan)").max(80),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.preprocess((v) => Number(String(v ?? "").replace(/\D/g, "")), z.number().int().min(0)),
  applyTo: z.enum(["ALL", "FROM_SECOND"]),
  studentIds: z.array(z.string()).min(2, "Nhóm anh chị em cần ít nhất 2 em"),
}).refine((g) => g.discountType !== "PERCENT" || g.discountValue <= 100, {
  message: "Giảm theo % tối đa 100%",
  path: ["discountValue"],
});
