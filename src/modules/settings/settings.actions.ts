"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { getSettings, saveSetting } from "@/modules/settings/settings.service";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

const money = z.preprocess((v) => Number(String(v ?? "").replace(/\D/g, "")), z.number().int());

const schema = z.object({
  teacherName: z.string().trim().min(1, "Cô nhập tên hiển thị giúp em").max(40),
  billing: z.object({
    defaultUnitPrice: money.refine((v) => v >= 1000 && v <= 5_000_000, "Đơn giá từ 1.000đ đến 5.000.000đ"),
    cycleLength: z.coerce.number().int().min(1, "Chu kỳ ít nhất 1 buổi").max(60, "Chu kỳ tối đa 60 buổi"),
    countExcused: z.boolean(),
    countUnexcused: z.boolean(),
    roundTo: z.union([z.literal(1), z.literal(1000)]),
  }),
  bank: z.object({
    bin: z.string().regex(/^\d{6}$|^$/, "Ngân hàng chưa đúng"),
    bankName: z.string().max(60),
    accountNo: z.string().trim().regex(/^\d{4,20}$|^$/, "Số tài khoản chỉ gồm chữ số"),
    accountName: z.string().trim().max(60).transform((v) => v.toUpperCase()),
  }),
  reminders: z
    .object({
      gentleAfterDays: z.coerce.number().int().min(1).max(60),
      clearAfterDays: z.coerce.number().int().min(2).max(120),
    })
    .refine((r) => r.clearAfterDays > r.gentleAfterDays, { message: "Mốc 'Nhắc rõ' phải sau mốc 'Nhắc khéo'" }),
});

/**
 * Lưu cài đặt. Đổi cách tính tiền (đơn giá, chu kỳ, tính buổi vắng) chỉ áp dụng cho buổi CHỐT SAU khi lưu —
 * buổi đã chốt giữ nguyên billable/đơn giá (xem Attendance trong schema.prisma).
 */
export async function saveSettingsAction(input: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "settings.manage")) return fail("PERMISSION_DENIED");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const before = await getSettings();
  const d = parsed.data;
  await prisma.$transaction(async (tx) => {
    await saveSetting("teacherName", d.teacherName, tx);
    await saveSetting("billing", d.billing, tx);
    await saveSetting("bank", d.bank, tx);
    await saveSetting("reminders", d.reminders, tx);
    await tx.user.update({ where: { id: user.id }, data: { displayName: d.teacherName } });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: "SETTINGS_UPDATE",
      entity: "Setting",
      before: { teacherName: before.teacherName, billing: before.billing, bank: before.bank, reminders: before.reminders },
      after: d,
    });
  });
  revalidatePath("/", "layout");
  return ok(null);
}
