"use server";

import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { effectiveUnitPrice, isBillable } from "@/modules/billing/billing.core";
import { issueDueInvoices } from "@/modules/billing/billing.service";
import { finalizeSessionSchema } from "@/modules/attendance/attendance.schema";
import { getSettings } from "@/modules/settings/settings.service";
import { fromDbDate, shortDate } from "@/lib/dates";
import { givenName } from "@/lib/utils";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

export type FinalizeResult = {
  present: number;
  excused: number;
  unexcused: number;
  /** Em vừa đủ chu kỳ → phiếu mới được tạo. */
  completed: { studentId: string; name: string; invoiceId: string; code: string; amount: number }[];
};

class Conflict extends Error {}

/**
 * "Xong buổi": ghi điểm danh + chốt tiền + phát hành phiếu, tất cả trong MỘT transaction.
 * Gọi lại được nhiều lần (sửa điểm danh buổi đã chốt) — kết quả không bị ghi đôi.
 *
 * Quy tắc khóa: buổi đã nằm trong phiếu ĐÃ GỬI phụ huynh thì không đổi trạng thái được;
 * cô phải vào phiếu sửa (có lý do). Phiếu CHƯA GỬI thì được tạo lại tự động.
 */
export async function finalizeSessionAction(input: unknown): Promise<ActionResult<FinalizeResult>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "attendance.manage")) return fail("PERMISSION_DENIED");
  const parsed = finalizeSessionSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { sessionId, entries, clientOpId } = parsed.data;
  const settings = await getSettings();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const session = await tx.session.findUnique({
          where: { id: sessionId },
          include: {
            attendances: {
              include: {
                student: { select: { fullName: true } },
                invoiceLine: {
                  select: {
                    invoice: {
                      select: {
                        id: true,
                        status: true,
                        code: true,
                        _count: { select: { adjustments: true, payments: true } },
                        lines: { where: { waived: true }, select: { id: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!session) throw new Conflict("Không tìm thấy buổi học này nữa ạ.");
        if (session.status === "CANCELLED") throw new Conflict("Buổi này đã được hủy. Cô khôi phục buổi trước rồi điểm danh nhé.");

        const date = session.date;
        const existing = new Map(session.attendances.map((a) => [a.studentId, a]));
        const students = await tx.student.findMany({
          where: { id: { in: entries.map((e) => e.studentId) } },
          select: { id: true, fullName: true, unitPrice: true },
        });
        const studentMap = new Map(students.map((s) => [s.id, s]));

        const conflicts: string[] = [];
        const rebuild = new Set<string>(); // phiếu chưa gửi cần tạo lại
        const touched = new Set<string>();

        for (const e of entries) {
          const student = studentMap.get(e.studentId);
          if (!student) continue;
          const row = existing.get(e.studentId);
          const note = e.note?.trim() || null;

          if (!row) {
            await tx.attendance.create({
              data: {
                sessionId,
                studentId: e.studentId,
                date,
                status: e.status,
                note,
                isMakeup: e.isMakeup,
                billable: isBillable(e.status, settings.billing),
                unitPrice: effectiveUnitPrice(student.unitPrice, settings.billing),
              },
            });
            touched.add(e.studentId);
            continue;
          }

          if (row.status === e.status) {
            if (row.note !== note) await tx.attendance.update({ where: { id: row.id }, data: { note } });
            continue;
          }

          const inv = row.invoiceLine?.invoice;
          if (inv) {
            const edited = inv._count.adjustments > 0 || inv._count.payments > 0 || inv.lines.length > 0;
            if (inv.status === "SENT" || edited) {
              conflicts.push(`${student.fullName} (phiếu ${inv.code})`);
              continue;
            }
            rebuild.add(inv.id);
          }
          // Giữ nguyên đơn giá đã chốt — đổi trạng thái không làm đổi giá của buổi.
          await tx.attendance.update({
            where: { id: row.id },
            data: { status: e.status, note, billable: isBillable(e.status, settings.billing) },
          });
          touched.add(e.studentId);
        }

        // Em học bù bị gỡ khỏi danh sách → xóa dòng (nếu chưa vào phiếu).
        const sent = new Set(entries.map((e) => e.studentId));
        for (const row of session.attendances) {
          if (!row.isMakeup || sent.has(row.studentId)) continue;
          if (row.invoiceLine) {
            const inv = row.invoiceLine.invoice;
            const edited = inv._count.adjustments > 0 || inv._count.payments > 0 || inv.lines.length > 0;
            if (inv.status === "SENT" || edited) {
              conflicts.push(`${row.student.fullName} (phiếu ${inv.code})`);
              continue;
            }
            rebuild.add(inv.id);
          }
          touched.add(row.studentId);
        }

        if (conflicts.length > 0) {
          throw new Conflict(
            `Buổi ${shortDate(fromDbDate(date))} của ${conflicts.join(", ")} đã nằm trong phiếu đã gửi phụ huynh. ` +
              "Cô mở phiếu đó để sửa (có ghi lý do) nhé — các thay đổi khác chưa được lưu.",
          );
        }

        for (const invoiceId of rebuild) {
          const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { lines: true } });
          await tx.invoice.delete({ where: { id: invoiceId } });
          await writeAuditLog(tx, {
            actorId: user.id,
            action: "INVOICE_REBUILD",
            entity: "Invoice",
            entityId: invoiceId,
            before: { code: inv.code, amount: inv.amount, attendanceIds: inv.lines.map((l) => l.attendanceId) },
            reason: "Sửa điểm danh của phiếu chưa gửi — tạo lại phiếu",
          });
          touched.add(inv.studentId);
        }

        // Xóa dòng học bù bị gỡ SAU khi đã gỡ phiếu chứa nó.
        for (const row of session.attendances) {
          if (row.isMakeup && !sent.has(row.studentId) && row.invoiceLine?.invoice.status !== "SENT") {
            await tx.attendance.delete({ where: { id: row.id } });
          }
        }

        await tx.session.update({
          where: { id: sessionId },
          data: { status: "COMPLETED", completedAt: session.completedAt ?? new Date() },
        });

        const completed: FinalizeResult["completed"] = [];
        for (const studentId of touched) {
          const issued = await issueDueInvoices(tx, studentId, settings.billing, user.id);
          const name = studentMap.get(studentId)?.fullName ?? "";
          for (const inv of issued) {
            completed.push({ studentId, name: givenName(name), invoiceId: inv.id, code: inv.code, amount: inv.amount });
          }
        }

        const final = await tx.attendance.groupBy({ by: ["status"], where: { sessionId }, _count: { _all: true } });
        const count = (s: string) => final.find((f) => f.status === s)?._count._all ?? 0;

        await writeAuditLog(tx, {
          actorId: user.id,
          action: session.status === "COMPLETED" ? "SESSION_REFINALIZE" : "SESSION_FINALIZE",
          entity: "Session",
          entityId: sessionId,
          after: {
            clientOpId,
            entries: entries.filter((e) => e.status !== "PRESENT" || e.isMakeup || e.note),
            invoices: completed.map((c) => c.code),
          },
        });

        return {
          present: count("PRESENT"),
          excused: count("EXCUSED"),
          unexcused: count("UNEXCUSED"),
          completed,
        };
      },
      { timeout: 20_000 },
    );

    revalidatePath("/hom-nay");
    revalidatePath("/diem-danh");
    revalidatePath("/thu-tien");
    revalidatePath("/lop-hoc");
    return ok(result);
  } catch (e) {
    if (e instanceof Conflict) return fail("CONFLICT", e.message);
    throw e;
  }
}
