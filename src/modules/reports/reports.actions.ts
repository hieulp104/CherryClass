"use server";

import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import type { MonthlyReportInput } from "@/modules/reports/report.core";
import { monthlyReportData } from "@/modules/reports/reports.service";

const schema = z.object({
  studentId: z.string().min(1).max(64),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Tháng chưa đúng dạng"),
});

/** Số liệu báo cáo tháng của một em — chỉ cô xem được. Lời văn ghép ở trình duyệt (report.core) để cô sửa trực tiếp. */
export async function monthlyReportAction(input: unknown): Promise<ActionResult<Omit<MonthlyReportInput, "note">>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "student.manage")) return fail("PERMISSION_DENIED");
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const data = await monthlyReportData(parsed.data.studentId, parsed.data.month);
  if (!data) return fail("NOT_FOUND", "Không tìm thấy học sinh này.");
  return ok(data);
}
