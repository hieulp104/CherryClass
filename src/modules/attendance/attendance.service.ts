import { getSettings } from "@/modules/settings/settings.service";
import { addDays, fromDbDate, todayKey, toDbDate } from "@/lib/dates";
import { prisma } from "@/shared/prisma/prisma.service";
import { ensureSessions } from "@/modules/classes/classes.service";

/** Đếm buổi tính tiền CHƯA vào phiếu của nhiều em, trừ các buổi thuộc `excludeSessionId`. */
export async function uninvoicedCounts(studentIds: string[], excludeSessionId?: string) {
  if (studentIds.length === 0) return new Map<string, number>();
  const rows = await prisma.attendance.groupBy({
    by: ["studentId"],
    where: {
      studentId: { in: studentIds },
      billable: true,
      invoiceLine: { is: null },
      ...(excludeSessionId ? { OR: [{ sessionId: null }, { sessionId: { not: excludeSessionId } }] } : {}),
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.studentId, r._count._all]));
}

export type RosterStudent = {
  id: string;
  fullName: string;
  avatarHue: number;
  classroom: string;
  status: "PRESENT" | "EXCUSED" | "UNEXCUSED";
  note: string | null;
  isMakeup: boolean;
  /** Đã có dòng điểm danh trong DB (buổi đã chốt trước đó). */
  saved: boolean;
  /** Buổi này đã nằm trong phiếu đã gửi → không đổi trạng thái được nữa. */
  locked: boolean;
  /** Số buổi tính tiền chưa vào phiếu, KHÔNG kể buổi này. */
  counted: number;
  birthdayToday: boolean;
};

/** Danh sách điểm danh của một buổi: học sinh của ca + học sinh học bù đã thêm. */
export async function getRoster(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      shift: { select: { id: true, name: true, room: true, classroom: { select: { id: true, name: true, color: true } } } },
      attendances: {
        include: {
          student: { select: { id: true, fullName: true, avatarHue: true, dob: true, classroom: { select: { name: true } } } },
          invoiceLine: { select: { invoice: { select: { status: true } } } },
        },
      },
    },
  });
  if (!session) return null;

  const date = fromDbDate(session.date);
  const members = await prisma.student.findMany({
    where: {
      shiftId: session.shiftId,
      deletedAt: null,
      status: "ACTIVE",
      joinedAt: { lte: session.date },
    },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true, avatarHue: true, dob: true, classroom: { select: { name: true } } },
  });

  const rowByStudent = new Map(session.attendances.map((a) => [a.studentId, a]));
  const all = new Map<string, (typeof members)[number]>();
  for (const m of members) all.set(m.id, m);
  for (const a of session.attendances) if (!all.has(a.studentId)) all.set(a.studentId, a.student);

  const counts = await uninvoicedCounts([...all.keys()], session.id);
  const mmdd = date.slice(5);
  const settings = await getSettings();

  const students: RosterStudent[] = [...all.values()]
    .map((s) => {
      const row = rowByStudent.get(s.id);
      return {
        id: s.id,
        fullName: s.fullName,
        avatarHue: s.avatarHue,
        classroom: s.classroom.name,
        status: row?.status ?? "PRESENT",
        note: row?.note ?? null,
        isMakeup: row?.isMakeup ?? false,
        saved: Boolean(row),
        locked: row?.invoiceLine?.invoice.status === "SENT",
        counted: counts.get(s.id) ?? 0,
        birthdayToday: s.dob ? fromDbDate(s.dob).slice(5) === mmdd : false,
      };
    })
    // Em học bù xếp cuối, còn lại theo TÊN (từ cuối) như sổ điểm danh.
    .sort((a, b) => Number(a.isMakeup) - Number(b.isMakeup) || compareGivenName(a.fullName, b.fullName));

  return {
    session: {
      id: session.id,
      date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      cancelReason: session.cancelReason,
      shiftName: session.shift.name,
      room: session.shift.room,
      classroom: session.shift.classroom,
    },
    students,
    billing: settings.billing,
  };
}

export type Roster = NonNullable<Awaited<ReturnType<typeof getRoster>>>;

function compareGivenName(a: string, b: string) {
  const ga = a.trim().split(/\s+/);
  const gb = b.trim().split(/\s+/);
  return (ga.at(-1) ?? "").localeCompare(gb.at(-1) ?? "", "vi") || a.localeCompare(b, "vi");
}

/** Buổi hôm nay + các buổi 7 ngày qua chưa điểm danh (để cô không quên). */
export async function attendanceAgenda() {
  const today = todayKey();
  const from = addDays(today, -7);
  await ensureSessions(from, today);
  const sessions = await prisma.session.findMany({
    where: {
      date: { gte: toDbDate(from), lte: toDbDate(today) },
      shift: { active: true, classroom: { archivedAt: null } },
      OR: [{ date: toDbDate(today) }, { status: "SCHEDULED" }],
    },
    orderBy: [{ date: "desc" }, { startTime: "asc" }],
    include: {
      shift: {
        select: {
          name: true,
          room: true,
          classroom: { select: { name: true, color: true } },
          _count: { select: { students: { where: { status: "ACTIVE", deletedAt: null } } } },
        },
      },
      attendances: { select: { status: true } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    date: fromDbDate(s.date),
    isToday: fromDbDate(s.date) === today,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    cancelReason: s.cancelReason,
    label: `${s.shift.classroom.name} · ${s.shift.name}`,
    room: s.shift.room,
    color: s.shift.classroom.color,
    studentCount: s.shift._count.students,
    presentCount: s.attendances.filter((a) => a.status === "PRESENT").length,
  }));
}
