import { isLate, monthAverage } from "@/modules/assignments/assignments.core";
import { monthUtcRange } from "@/modules/finance/finance.service";
import { parentAddress } from "@/modules/messages/messages.templates";
import type { MonthlyReportInput } from "@/modules/reports/report.core";
import { getSettings } from "@/modules/settings/settings.service";
import { addMonths, monthRange, todayKey, toDbDate } from "@/lib/dates";
import { givenName } from "@/lib/utils";
import { prisma } from "@/shared/prisma/prisma.service";

/**
 * Số liệu cho báo cáo tháng (chưa có lời nhận xét của cô). Chỉ đọc — không ghi gì.
 * Bài tập tính theo HẠN NỘP trong tháng; điểm tính theo NGÀY CHẤM (như "so với chính mình").
 */
export async function monthlyReportData(studentId: string, month: string): Promise<Omit<MonthlyReportInput, "note"> | null> {
  const { from, to } = monthRange(month);
  const prev = addMonths(month, -1);
  const [student, settings, attendance, homework, graded] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, deletedAt: null }, select: { fullName: true, parentName: true } }),
    getSettings(),
    prisma.attendance.findMany({
      where: { studentId, source: "SESSION", date: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: { status: true, isMakeup: true },
    }),
    prisma.submission.findMany({
      where: { studentId, assignment: { archivedAt: null, dueAt: monthUtcRange(month) } },
      select: { status: true, submittedAt: true, assignment: { select: { dueAt: true } } },
    }),
    prisma.submission.findMany({
      where: { studentId, status: "GRADED", score: { not: null }, gradedAt: { gte: monthUtcRange(prev).gte, lt: monthUtcRange(month).lt } },
      select: { score: true, gradedAt: true, assignment: { select: { maxScore: true } } },
    }),
  ]);
  if (!student) return null;

  const scores = graded.map((g) => ({ month: todayKey(g.gradedAt!).slice(0, 7), score: g.score!, max: g.assignment.maxScore }));
  const submitted = homework.filter((h) => h.status !== "ASSIGNED" && h.submittedAt);

  return {
    parent: parentAddress(student.parentName),
    child: givenName(student.fullName),
    month,
    teacher: settings.teacherName,
    attendance: {
      present: attendance.filter((a) => a.status === "PRESENT").length,
      excused: attendance.filter((a) => a.status === "EXCUSED").length,
      unexcused: attendance.filter((a) => a.status === "UNEXCUSED").length,
      makeup: attendance.filter((a) => a.status === "PRESENT" && a.isMakeup).length,
    },
    homework: {
      assigned: homework.length,
      submitted: submitted.length,
      onTime: submitted.filter((h) => !isLate(h.submittedAt!, h.assignment.dueAt)).length,
    },
    average: monthAverage(scores, month),
    previousAverage: monthAverage(scores, prev),
  };
}
