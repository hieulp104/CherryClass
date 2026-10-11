import { listInvoices } from "@/modules/billing/billing.service";
import { sessionsOn } from "@/modules/classes/classes.service";
import { incomeSamePeriodLastMonth, incomeTrend, outstandingTotal } from "@/modules/finance/finance.service";
import { getSettings } from "@/modules/settings/settings.service";
import { addDays, diffDays, fromDbDate, shortDate, todayKey, toDbDate, vnDayStartUtc, vnNow } from "@/lib/dates";
import { formatVnd } from "@/lib/utils";
import { prisma } from "@/shared/prisma/prisma.service";

const QUOTES = [
  "Mỗi buổi dạy là một hạt giống — cô đang chăm cả một vườn cherry.",
  "Học trò nhớ cô không phải vì bài khó, mà vì cô đã tin các em.",
  "Nhớ uống nước và nghỉ giọng giữa các ca nhé.",
  "Hôm nay sẽ có một em hiểu bài nhờ cô.",
  "Chậm mà chắc — cherry chín đỏ cũng cần đủ nắng.",
  "Kiên nhẫn với học trò rồi, hôm nay kiên nhẫn với chính mình nữa nhé.",
  "Một lời khen đúng lúc có thể thay đổi cả năm học của một em.",
  "Lớp học vui là vì có cô ở đó.",
  "Việc đếm buổi, tính tiền để app lo — cô chỉ cần dạy.",
  "Điều các em nhớ mãi là cách cô đối xử với các em.",
  "Cô đã làm rất tốt rồi.",
  "Một ngày bận rộn nữa — nhưng cô làm được.",
];

export function quoteOfDay(dateKey: string): string {
  const day = diffDays("2026-01-01", dateKey);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

export type AttentionKind = "CLAIMED" | "OVERDUE" | "READY" | "UNMARKED" | "GRADE" | "ABSENT" | "BIRTHDAY";

export type AttentionItem = { key: string; label: string; sub?: string; badge: string; href: string };

/** Một nhóm trong "Việc cần chú ý" — theo bố cục QLNS: nhãn nhóm + vài dòng cụ thể. */
export type AttentionGroup = {
  kind: AttentionKind;
  label: string;
  /** Con số hiện bên phải (vd số BÀI NỘP chờ chấm). */
  total: number;
  /** Số mục cùng loại với `items` (vd số ĐỀ có bài chờ chấm) — dùng cho "và N nữa". Mặc định = total. */
  itemTotal?: number;
  href: string;
  items: AttentionItem[];
};

const ATTENTION_LIMIT = 4;

export async function getTodayData() {
  const now = vnNow();
  const today = now.dateKey;
  const month = today.slice(0, 7);
  const settings = await getSettings();

  const [
    sessions,
    trend,
    incomePrev,
    outstanding,
    activeStudents,
    invoices,
    absentees,
    birthdays,
    unmarked,
    paidToday,
    toGrade,
    classrooms,
  ] = await Promise.all([
    sessionsOn(today),
    incomeTrend(month, 6),
    incomeSamePeriodLastMonth(today),
    outstandingTotal(),
    prisma.student.count({ where: { status: "ACTIVE", deletedAt: null } }),
    listInvoices(),
    consecutiveAbsentees(today),
    birthdaysOn(today),
    prisma.session.findMany({
      where: {
        status: "SCHEDULED",
        date: { gte: toDbDate(addDays(today, -7)), lt: toDbDate(today) },
        shift: { active: true, classroom: { archivedAt: null } },
      },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
      select: {
        id: true,
        date: true,
        startTime: true,
        shift: { select: { name: true, classroom: { select: { name: true } } } },
      },
    }),
    prisma.payment.aggregate({
      where: { status: "CONFIRMED", paidAt: { gte: vnDayStartUtc(today), lt: vnDayStartUtc(addDays(today, 1)) } },
      _sum: { amount: true },
    }),
    ungradedByAssignment(),
    prisma.classroom.findMany({
      where: { archivedAt: null },
      orderBy: [{ grade: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        grade: true,
        color: true,
        _count: { select: { students: { where: { status: "ACTIVE", deletedAt: null } } } },
      },
    }),
  ]);

  const byState = (...states: string[]) => invoices.filter((i) => states.includes(i.state));
  const overdue = byState("OVERDUE");
  const ready = byState("READY");
  const claimed = byState("CLAIMED");
  const waiting = byState("WAITING", "PARTIAL");

  const invoiceItem = (i: (typeof invoices)[number], badge: string): AttentionItem => ({
    key: i.id,
    label: i.student.fullName,
    sub: i.student.classroom,
    badge,
    href: `/thu-tien/${i.id}`,
  });

  const attention: AttentionGroup[] = [];
  if (claimed.length)
    attention.push({
      kind: "CLAIMED",
      label: "Phụ huynh báo đã chuyển khoản",
      total: claimed.length,
      href: "/thu-tien?tab=CLAIMED",
      items: claimed.slice(0, ATTENTION_LIMIT).map((i) => invoiceItem(i, formatVnd(i.claim?.amount ?? i.totalDue))),
    });
  if (overdue.length)
    attention.push({
      kind: "OVERDUE",
      label: `Phiếu quá ${settings.reminders.gentleAfterDays} ngày chưa đóng`,
      total: overdue.length,
      href: "/thu-tien?tab=OVERDUE",
      items: [...overdue]
        .sort((a, b) => (b.daysSinceSent ?? 0) - (a.daysSinceSent ?? 0))
        .slice(0, ATTENTION_LIMIT)
        .map((i) => invoiceItem(i, `gửi ${i.daysSinceSent ?? 0} ngày`)),
    });
  if (ready.length)
    attention.push({
      kind: "READY",
      label: "Đủ buổi — phiếu thu chờ gửi",
      total: ready.length,
      href: "/thu-tien?tab=READY",
      items: ready.slice(0, ATTENTION_LIMIT).map((i) => invoiceItem(i, formatVnd(i.totalDue))),
    });
  if (unmarked.length)
    attention.push({
      kind: "UNMARKED",
      label: "Buổi tuần qua chưa điểm danh",
      total: unmarked.length,
      href: "/diem-danh",
      items: unmarked.slice(0, ATTENTION_LIMIT).map((s) => ({
        key: s.id,
        label: `${s.shift.classroom.name} · ${s.shift.name}`,
        badge: `${shortDate(fromDbDate(s.date))} · ${s.startTime}`,
        href: `/diem-danh/${s.id}`,
      })),
    });
  const toGradeTotal = toGrade.reduce((sum, a) => sum + a.count, 0);
  if (toGradeTotal)
    attention.push({
      kind: "GRADE",
      label: "Bài nộp chờ chấm",
      total: toGradeTotal,
      itemTotal: toGrade.length,
      href: "/bai-tap",
      items: toGrade.slice(0, ATTENTION_LIMIT).map((a) => ({
        key: a.id,
        label: a.title,
        badge: `${a.count} bài`,
        href: `/bai-tap/${a.id}/cham`,
      })),
    });
  if (absentees.length)
    attention.push({
      kind: "ABSENT",
      label: "Vắng nhiều buổi liền",
      total: absentees.length,
      href: "/hoc-sinh",
      items: absentees.slice(0, ATTENTION_LIMIT).map((a) => ({
        key: a.id,
        label: a.fullName,
        sub: a.classroom,
        badge: `vắng ${a.streak} buổi`,
        href: `/hoc-sinh/${a.id}?nhan=ABSENCE_CHECK`,
      })),
    });
  if (birthdays.length)
    attention.push({
      kind: "BIRTHDAY",
      label: "Sinh nhật hôm nay",
      total: birthdays.length,
      href: "/hoc-sinh",
      items: birthdays.slice(0, ATTENTION_LIMIT).map((b) => ({
        key: b.id,
        label: b.fullName,
        sub: b.classroom,
        badge: "gửi lời chúc",
        href: `/hoc-sinh/${b.id}?nhan=BIRTHDAY`,
      })),
    });

  // Tổng kết cuối ngày: chỉ hiện khi hôm nay có dạy và mọi buổi đã xong / hủy.
  const taught = sessions.filter((s) => s.status === "COMPLETED");
  const allDone = sessions.length > 0 && sessions.every((s) => s.status !== "SCHEDULED");
  let summary: null | { sessions: number; students: number; received: number; needReminder: number } = null;
  if (allDone && taught.length > 0) {
    const present = await prisma.attendance.findMany({
      where: { sessionId: { in: taught.map((s) => s.id) }, status: "PRESENT" },
      select: { studentId: true },
      distinct: ["studentId"],
    });
    summary = {
      sessions: taught.length,
      students: present.length,
      received: paidToday._sum.amount ?? 0,
      needReminder: overdue.length + ready.length,
    };
  }

  const current = trend.at(-1)!;

  return {
    now,
    teacherName: settings.teacherName,
    quote: quoteOfDay(today),
    sessions,
    stats: {
      income: current.amount,
      incomeCount: current.count,
      incomePrev,
      trend: trend.map((t) => ({ label: t.label, amount: t.amount })),
      outstanding: outstanding.total,
      outstandingStudents: outstanding.students,
      activeStudents,
      classroomCount: classrooms.length,
    },
    attention,
    // Chỉ đếm số phiếu — số tiền còn thu đã có ở thẻ "Còn cần thu" (tính từ sổ cái).
    billing: [
      { tab: "READY", label: "Cần gửi", count: ready.length },
      { tab: "CLAIMED", label: "Chờ xác nhận", count: claimed.length },
      { tab: "WAITING", label: "Chờ đóng", count: waiting.length },
      { tab: "OVERDUE", label: "Quá hạn", count: overdue.length },
    ] as const,
    classrooms: classrooms.map((c) => ({
      id: c.id,
      name: c.name,
      grade: c.grade,
      color: c.color,
      count: c._count.students,
    })),
    summary,
  };
}

export type TodayData = Awaited<ReturnType<typeof getTodayData>>;

/** Bài còn bài nộp chưa chấm, nhiều nhất lên trước. */
async function ungradedByAssignment() {
  const groups = await prisma.submission.groupBy({
    by: ["assignmentId"],
    where: { status: "SUBMITTED", assignment: { archivedAt: null } },
    _count: { _all: true },
  });
  if (groups.length === 0) return [];
  const assignments = await prisma.assignment.findMany({
    where: { id: { in: groups.map((g) => g.assignmentId) } },
    select: { id: true, title: true },
  });
  const title = new Map(assignments.map((a) => [a.id, a.title]));
  return groups
    .map((g) => ({ id: g.assignmentId, title: title.get(g.assignmentId) ?? "Bài tập", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
}

/** Em đang học vắng ≥ 2 buổi liên tiếp gần nhất (trong 21 ngày qua). */
async function consecutiveAbsentees(today: string) {
  const rows = await prisma.attendance.findMany({
    where: {
      source: "SESSION",
      date: { gte: toDbDate(addDays(today, -21)) },
      student: { status: "ACTIVE", deletedAt: null },
    },
    orderBy: [{ date: "desc" }],
    select: {
      status: true,
      student: { select: { id: true, fullName: true, classroom: { select: { name: true } } } },
    },
  });
  const byStudent = new Map<string, { info: (typeof rows)[number]["student"]; statuses: string[] }>();
  for (const r of rows) {
    const entry = byStudent.get(r.student.id) ?? { info: r.student, statuses: [] };
    entry.statuses.push(r.status);
    byStudent.set(r.student.id, entry);
  }
  const result: { id: string; fullName: string; classroom: string; streak: number }[] = [];
  for (const { info, statuses } of byStudent.values()) {
    let streak = 0;
    for (const s of statuses) {
      if (s === "PRESENT") break;
      streak += 1;
    }
    if (streak >= 2) result.push({ id: info.id, fullName: info.fullName, classroom: info.classroom.name, streak });
  }
  return result.sort((a, b) => b.streak - a.streak);
}

async function birthdaysOn(today: string) {
  const mmdd = today.slice(5);
  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", deletedAt: null, dob: { not: null } },
    select: { id: true, fullName: true, dob: true, classroom: { select: { name: true } } },
  });
  return students
    .filter((s) => s.dob && fromDbDate(s.dob).slice(5) === mmdd)
    .map((s) => ({ id: s.id, fullName: s.fullName, classroom: s.classroom.name }));
}

export { todayKey };
