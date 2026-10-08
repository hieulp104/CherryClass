import { listInvoices } from "@/modules/billing/billing.service";
import { sessionsOn } from "@/modules/classes/classes.service";
import { incomeOf, outstandingTotal } from "@/modules/finance/finance.service";
import { getSettings } from "@/modules/settings/settings.service";
import { addDays, diffDays, fromDbDate, todayKey, toDbDate, vnDayStartUtc, vnNow } from "@/lib/dates";
import { givenName } from "@/lib/utils";
import { prisma } from "@/shared/prisma/prisma.service";

const QUOTES = [
  "Mỗi buổi dạy là một hạt giống — cô đang chăm cả một vườn cherry đó ạ 🍒",
  "Học trò nhớ cô không phải vì bài khó, mà vì cô đã tin các em.",
  "Cô nhớ uống nước và nghỉ giọng giữa các ca nhé 💧",
  "Hôm nay sẽ có một em hiểu bài nhờ cô. Tuyệt ghê!",
  "Chậm mà chắc — cherry chín đỏ cũng cần đủ nắng mà.",
  "Cô kiên nhẫn với học trò rồi, hôm nay kiên nhẫn với chính mình nữa nhé.",
  "Một lời khen đúng lúc có thể thay đổi cả năm học của một em.",
  "Lớp học vui là vì có cô ở đó ✨",
  "Mệt thì nghỉ chút xíu, việc đếm buổi tính tiền để em lo ạ!",
  "Điều các em nhớ mãi là cách cô đối xử với các em.",
  "Cô đã làm rất tốt rồi. Thật đấy ạ 💗",
  "Một ngày bận rộn nữa — nhưng cô làm được mà!",
];

export function quoteOfDay(dateKey: string): string {
  const day = diffDays("2026-01-01", dateKey);
  return QUOTES[((day % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

export type TodoItem = {
  key: string;
  priority: number;
  kind: "OVERDUE" | "READY" | "CLAIMED" | "ABSENT" | "BIRTHDAY" | "UNMARKED";
  title: string;
  detail: string;
  href: string;
  count?: number;
};

export async function getTodayData() {
  const now = vnNow();
  const today = now.dateKey;
  const month = today.slice(0, 7);
  const settings = await getSettings();

  const [sessions, income, outstanding, activeStudents, invoices, absentees, birthdays, unmarked, paidToday] =
    await Promise.all([
      sessionsOn(today),
      incomeOf(month),
      outstandingTotal(),
      prisma.student.count({ where: { status: "ACTIVE", deletedAt: null } }),
      listInvoices(),
      consecutiveAbsentees(today),
      birthdaysOn(today),
      prisma.session.count({
        where: {
          status: "SCHEDULED",
          date: { gte: toDbDate(addDays(today, -7)), lt: toDbDate(today) },
          shift: { active: true, classroom: { archivedAt: null } },
        },
      }),
      prisma.payment.aggregate({
        where: { status: "CONFIRMED", paidAt: { gte: vnDayStartUtc(today), lt: vnDayStartUtc(addDays(today, 1)) } },
        _sum: { amount: true },
      }),
    ]);

  const overdue = invoices.filter((i) => i.state === "OVERDUE");
  const ready = invoices.filter((i) => i.state === "READY");
  const claimed = invoices.filter((i) => i.state === "CLAIMED");

  const names = (list: { student: { fullName: string } }[]) =>
    list
      .slice(0, 3)
      .map((i) => givenName(i.student.fullName))
      .join(", ") + (list.length > 3 ? ` và ${list.length - 3} em nữa` : "");

  const todos: TodoItem[] = [];
  if (claimed.length)
    todos.push({
      key: "claimed",
      priority: 1,
      kind: "CLAIMED",
      title: `${claimed.length} phụ huynh báo đã chuyển khoản`,
      detail: `${names(claimed)} — cô đối chiếu rồi xác nhận một chạm nhé`,
      href: "/thu-tien?tab=CLAIMED",
      count: claimed.length,
    });
  if (overdue.length)
    todos.push({
      key: "overdue",
      priority: 2,
      kind: "OVERDUE",
      title: `${overdue.length} phiếu đã quá ${settings.reminders.gentleAfterDays} ngày`,
      detail: `${names(overdue)} — app đã soạn sẵn lời nhắc khéo`,
      href: "/thu-tien?tab=OVERDUE",
      count: overdue.length,
    });
  if (ready.length)
    todos.push({
      key: "ready",
      priority: 3,
      kind: "READY",
      title: `Cô ơi, có ${ready.length} em đủ buổi rồi ạ`,
      detail: `${names(ready)} — phiếu thu đã sẵn sàng để gửi`,
      href: "/thu-tien?tab=READY",
      count: ready.length,
    });
  if (unmarked)
    todos.push({
      key: "unmarked",
      priority: 4,
      kind: "UNMARKED",
      title: `${unmarked} buổi tuần qua chưa điểm danh`,
      detail: "Chưa điểm danh thì chưa đếm buổi được ạ",
      href: "/diem-danh",
      count: unmarked,
    });
  for (const a of absentees.slice(0, 5)) {
    todos.push({
      key: `absent-${a.id}`,
      priority: 5,
      kind: "ABSENT",
      title: `${givenName(a.fullName)} vắng ${a.streak} buổi liền`,
      detail: `${a.classroom} — hỏi thăm phụ huynh một câu nhé`,
      href: `/hoc-sinh/${a.id}?nhan=ABSENCE_CHECK`,
    });
  }
  for (const b of birthdays) {
    todos.push({
      key: `bday-${b.id}`,
      priority: 6,
      kind: "BIRTHDAY",
      title: `Hôm nay sinh nhật ${givenName(b.fullName)} 🎂`,
      detail: `${b.classroom} — gửi con một lời chúc nhé`,
      href: `/hoc-sinh/${b.id}?nhan=BIRTHDAY`,
    });
  }
  todos.sort((a, b) => a.priority - b.priority);

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

  return {
    now,
    teacherName: settings.teacherName,
    quote: quoteOfDay(today),
    sessions,
    stats: {
      income: income.amount,
      incomeCount: income.count,
      outstanding: outstanding.total,
      outstandingStudents: outstanding.students,
      activeStudents,
    },
    todos,
    summary,
  };
}

export type TodayData = Awaited<ReturnType<typeof getTodayData>>;

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
