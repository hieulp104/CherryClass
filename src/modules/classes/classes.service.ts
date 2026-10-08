import type { Prisma } from "@/generated/prisma/client";
import { addDays, fromDbDate, todayKey, toDbDate, weekdayOf } from "@/lib/dates";
import { prisma } from "@/shared/prisma/prisma.service";

type Tx = Prisma.TransactionClient;

/**
 * Sinh buổi học từ lịch lặp của các ca đang hoạt động, trong khoảng [from, to].
 * Idempotent: buổi đã có (kể cả đã hủy) không bị tạo lại nhờ unique (shift, date, startTime).
 */
export async function ensureSessions(from: string, to: string, client: Tx | typeof prisma = prisma) {
  const shifts = await client.shift.findMany({
    where: { active: true, classroom: { archivedAt: null } },
    select: { id: true, createdAt: true, schedules: true },
  });
  const data: Prisma.SessionCreateManyInput[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    for (const shift of shifts) {
      for (const s of shift.schedules) {
        if (s.weekday !== wd) continue;
        data.push({ shiftId: shift.id, date: toDbDate(d), startTime: s.startTime, endTime: s.endTime });
      }
    }
  }
  if (data.length > 0) await client.session.createMany({ data, skipDuplicates: true });
}

/** Buổi học trong một ngày, kèm lớp/ca và số em (để vẽ thẻ trên trang Hôm nay / Điểm danh). */
export async function sessionsOn(date: string) {
  await ensureSessions(date, date);
  const sessions = await prisma.session.findMany({
    where: { date: toDbDate(date), shift: { classroom: { archivedAt: null } } },
    orderBy: [{ startTime: "asc" }],
    include: {
      shift: {
        select: {
          id: true,
          name: true,
          room: true,
          classroom: { select: { id: true, name: true, grade: true, color: true } },
          _count: { select: { students: { where: { status: "ACTIVE", deletedAt: null } } } },
        },
      },
      _count: { select: { attendances: true } },
      attendances: { select: { status: true } },
    },
  });
  return sessions.map((s) => ({
    id: s.id,
    date: fromDbDate(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    cancelReason: s.cancelReason,
    shiftId: s.shift.id,
    shiftName: s.shift.name,
    room: s.shift.room,
    classroom: s.shift.classroom,
    studentCount: s.shift._count.students,
    presentCount: s.attendances.filter((a) => a.status === "PRESENT").length,
    absentCount: s.attendances.filter((a) => a.status !== "PRESENT").length,
  }));
}

export type SessionCard = Awaited<ReturnType<typeof sessionsOn>>[number];

/** Danh sách lớp + ca + lịch + sĩ số cho trang Lớp học. */
export async function listClassrooms() {
  const classrooms = await prisma.classroom.findMany({
    where: { archivedAt: null },
    orderBy: [{ grade: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    include: {
      shifts: {
        where: { active: true },
        orderBy: { name: "asc" },
        include: {
          schedules: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
          _count: { select: { students: { where: { status: "ACTIVE", deletedAt: null } } } },
        },
      },
      _count: { select: { students: { where: { status: "ACTIVE", deletedAt: null } } } },
    },
  });
  return classrooms;
}

export type ClassroomWithShifts = Awaited<ReturnType<typeof listClassrooms>>[number];

/** Lịch tuần: các buổi từ `from` tới `from + 6`. */
export async function weekSessions(from: string) {
  const to = addDays(from, 6);
  await ensureSessions(from, to);
  const sessions = await prisma.session.findMany({
    where: { date: { gte: toDbDate(from), lte: toDbDate(to) }, shift: { active: true, classroom: { archivedAt: null } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    include: { shift: { select: { name: true, classroom: { select: { name: true, color: true } } } } },
  });
  return sessions.map((s) => ({
    id: s.id,
    date: fromDbDate(s.date),
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    cancelReason: s.cancelReason,
    label: `${s.shift.classroom.name} · ${s.shift.name}`,
    color: s.shift.classroom.color,
  }));
}

/**
 * Sau khi đổi lịch một ca: bỏ các buổi TƯƠNG LAI chưa điểm danh theo lịch cũ rồi sinh lại.
 * Buổi đã qua hoặc đã có điểm danh giữ nguyên — lịch sử không bị viết lại.
 */
export async function regenerateFutureSessions(tx: Tx, shiftId: string) {
  const today = todayKey();
  await tx.session.deleteMany({
    where: { shiftId, status: "SCHEDULED", date: { gte: toDbDate(today) }, attendances: { none: {} } },
  });
  await ensureSessions(today, addDays(today, 28), tx);
}
