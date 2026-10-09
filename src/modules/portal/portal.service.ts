/**
 * Dữ liệu cho cổng học sinh / phụ huynh. MỌI hàm ở đây nhận `studentId` đã được kiểm phạm vi
 * (`canViewStudent`) ở trang gọi — xem `requirePortal` trong portal.guard.ts.
 * Chỉ chọn trường tường minh: không bao giờ trả ghi chú riêng tư, cờ khó khăn, lý do sửa tay của cô.
 */

import { daysUntil, examCheer } from "@/modules/assignments/assignments.core";
import { studentAssignments, studentProgress } from "@/modules/assignments/assignments.service";
import { displayStateOf, loadLedgers } from "@/modules/billing/billing.service";
import { getSettings } from "@/modules/settings/settings.service";
import { addDays, fromDbDate, todayKey, toDbDate, WEEKDAY_SHORT } from "@/lib/dates";
import { prisma } from "@/shared/prisma/prisma.service";

export async function studentBasics(studentId: string) {
  const s = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      avatarHue: true,
      classroom: { select: { name: true, grade: true } },
      shift: { select: { id: true, name: true, room: true, schedules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] } } },
    },
  });
  return {
    ...s,
    schedule: s.shift?.schedules.map((x) => `${WEEKDAY_SHORT[x.weekday]} ${x.startTime}–${x.endTime}`) ?? [],
  };
}

export type StudentBasics = Awaited<ReturnType<typeof studentBasics>>;

/** Buổi học sắp tới (7 ngày) của ca chính. */
async function upcomingSessions(shiftId: string | null) {
  if (!shiftId) return [];
  const today = todayKey();
  const rows = await prisma.session.findMany({
    where: { shiftId, date: { gte: toDbDate(today), lte: toDbDate(addDays(today, 7)) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: 4,
    select: { id: true, date: true, startTime: true, endTime: true, status: true, cancelReason: true },
  });
  return rows.map((r) => ({ ...r, date: fromDbDate(r.date) }));
}

async function attendanceSummary(studentId: string) {
  const rows = await prisma.attendance.findMany({
    where: { studentId, source: "SESSION" },
    orderBy: { date: "desc" },
    take: 30,
    select: { id: true, date: true, status: true, note: true },
  });
  const present = rows.filter((r) => r.status === "PRESENT").length;
  return {
    rate: rows.length ? present / rows.length : null,
    recent: rows.map((r) => ({ ...r, date: fromDbDate(r.date) })),
  };
}

export async function portalHome(studentId: string) {
  const basics = await studentBasics(studentId);
  const [assignments, progress, sessions, attendance, settings] = await Promise.all([
    studentAssignments(studentId),
    studentProgress(studentId),
    upcomingSessions(basics.shift?.id ?? null),
    attendanceSummary(studentId),
    getSettings(),
  ]);
  const today = todayKey();
  const exam =
    basics.classroom.grade === 9 && settings.examDate && settings.examDate >= today
      ? { date: settings.examDate, days: daysUntil(today, settings.examDate), cheer: examCheer(today) }
      : null;
  return { basics, assignments, progress, sessions, attendance, exam, teacherName: settings.teacherName };
}

export type PortalHome = Awaited<ReturnType<typeof portalHome>>;

/** Học phí cho phụ huynh: phiếu (có link thanh toán) + tiền đã đóng. */
export async function portalFees(studentId: string) {
  const settings = await getSettings();
  const [invoices, payments, ledgers] = await Promise.all([
    prisma.invoice.findMany({
      where: { studentId, status: { not: "VOID" } },
      orderBy: { issuedAt: "desc" },
      select: { id: true, code: true, sessionCount: true, amount: true, status: true, sentAt: true, issuedAt: true, publicToken: true },
    }),
    prisma.payment.findMany({
      where: { studentId, status: "CONFIRMED" },
      orderBy: { paidAt: "desc" },
      select: { id: true, amount: true, paidAt: true, method: true },
    }),
    loadLedgers([studentId]),
  ]);
  const ledger = ledgers.get(studentId);
  return {
    balance: ledger?.balance ?? 0,
    // Phiếu cô CHƯA gửi thì phụ huynh chưa thấy — cô chủ động gửi kèm lời nhắn.
    invoices: invoices
      .filter((i) => i.status === "SENT")
      .map((i) => ({ ...displayStateOf(i, ledger, settings), id: i.id, code: i.code, sessionCount: i.sessionCount, amount: i.amount, issuedAt: i.issuedAt.toISOString(), token: i.publicToken })),
    payments: payments.map((p) => ({ ...p, paidAt: p.paidAt.toISOString() })),
  };
}

export type PortalFees = Awaited<ReturnType<typeof portalFees>>;
