import type { Prisma } from "@/generated/prisma/client";
import {
  fullAttendanceWeeks,
  garden,
  isLate,
  monthAverage,
  selfComparison,
  submissionState,
  toTen,
} from "@/modules/assignments/assignments.core";
import { fromDbDate, todayKey } from "@/lib/dates";
import { prisma } from "@/shared/prisma/prisma.service";

type Tx = Prisma.TransactionClient;

export type TargetInput = { kind: "CLASSROOM" | "SHIFT" | "STUDENT"; refId: string };

/** Giao cho lớp / ca / từng em → danh sách học sinh ĐANG HỌC thực nhận, kèm nhãn hiển thị. */
export async function resolveTargets(tx: Tx | typeof prisma, targets: TargetInput[]) {
  const ids = new Set<string>();
  const labels: { kind: TargetInput["kind"]; refId: string; label: string }[] = [];
  for (const t of targets) {
    if (t.kind === "CLASSROOM") {
      const c = await tx.classroom.findUnique({
        where: { id: t.refId },
        select: { name: true, students: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } } },
      });
      if (!c) continue;
      c.students.forEach((s) => ids.add(s.id));
      labels.push({ ...t, label: c.name });
    } else if (t.kind === "SHIFT") {
      const s = await tx.shift.findUnique({
        where: { id: t.refId },
        select: { name: true, classroom: { select: { name: true } }, students: { where: { status: "ACTIVE", deletedAt: null }, select: { id: true } } },
      });
      if (!s) continue;
      s.students.forEach((x) => ids.add(x.id));
      labels.push({ ...t, label: `${s.classroom.name} · ${s.name}` });
    } else {
      const st = await tx.student.findFirst({ where: { id: t.refId, deletedAt: null }, select: { id: true, fullName: true } });
      if (!st) continue;
      ids.add(st.id);
      labels.push({ ...t, label: st.fullName });
    }
  }
  return { studentIds: [...ids], labels };
}

// ─────────────────── Phía cô ───────────────────

export async function listAssignments() {
  const now = new Date();
  const rows = await prisma.assignment.findMany({
    where: { archivedAt: null },
    orderBy: { dueAt: "desc" },
    include: {
      targets: { select: { label: true } },
      submissions: { select: { status: true, submittedAt: true } },
      _count: { select: { files: true } },
    },
  });
  return rows.map((a) => {
    const total = a.submissions.length;
    const submitted = a.submissions.filter((s) => s.status !== "ASSIGNED").length;
    const graded = a.submissions.filter((s) => s.status === "GRADED").length;
    const late = a.submissions.filter((s) => s.submittedAt && isLate(s.submittedAt, a.dueAt)).length;
    return {
      id: a.id,
      title: a.title,
      dueAt: a.dueAt.toISOString(),
      overdue: a.dueAt < now,
      targets: a.targets.map((t) => t.label),
      fileCount: a._count.files,
      total,
      submitted,
      graded,
      toGrade: submitted - graded,
      late,
    };
  });
}

export type AssignmentListItem = Awaited<ReturnType<typeof listAssignments>>[number];

export async function getAssignmentDetail(id: string) {
  const a = await prisma.assignment.findUnique({
    where: { id },
    include: {
      targets: true,
      files: { orderBy: { sortOrder: "asc" }, include: { file: { select: { id: true, fileName: true, mimeType: true } } } },
      submissions: {
        include: {
          student: { select: { id: true, fullName: true, avatarHue: true, classroom: { select: { name: true } } } },
          _count: { select: { pages: true } },
        },
      },
    },
  });
  if (!a) return null;
  const now = new Date();
  return {
    ...a,
    submissions: a.submissions
      .map((s) => ({ ...s, state: submissionState(s, a.dueAt, now) }))
      .sort((x, y) => x.student.fullName.localeCompare(y.student.fullName, "vi")),
  };
}

/** Hàng chấm: các bài đã nộp (chưa chấm lên trước), kèm từng trang ảnh. */
export async function getGradingQueue(assignmentId: string) {
  const a = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      title: true,
      dueAt: true,
      maxScore: true,
      submissions: {
        where: { status: { in: ["SUBMITTED", "GRADED"] } },
        orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
        select: {
          id: true,
          status: true,
          submittedAt: true,
          note: true,
          score: true,
          comment: true,
          reviewHint: true,
          voiceFileId: true,
          student: { select: { id: true, fullName: true, avatarHue: true, classroom: { select: { name: true } } } },
          pages: {
            orderBy: { sortOrder: "asc" },
            select: { id: true, fileId: true, annotationFileId: true, file: { select: { mimeType: true, fileName: true } } },
          },
        },
      },
    },
  });
  if (!a) return null;
  return {
    ...a,
    dueAt: a.dueAt.toISOString(),
    submissions: a.submissions.map((s) => ({
      ...s,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      late: s.submittedAt ? isLate(s.submittedAt, a.dueAt) : false,
    })),
  };
}

export type GradingQueue = NonNullable<Awaited<ReturnType<typeof getGradingQueue>>>;

/** Số bài chờ chấm (cho trang Hôm nay). */
export async function ungradedCount() {
  return prisma.submission.count({ where: { status: "SUBMITTED", assignment: { archivedAt: null } } });
}

// ─────────────────── Phía học sinh / phụ huynh (đã kiểm phạm vi ở nơi gọi) ───────────────────

export async function studentAssignments(studentId: string) {
  const now = new Date();
  const subs = await prisma.submission.findMany({
    where: { studentId, assignment: { archivedAt: null } },
    orderBy: { assignment: { dueAt: "desc" } },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      score: true,
      gradedAt: true,
      seenAt: true,
      assignment: { select: { id: true, title: true, dueAt: true, maxScore: true } },
    },
  });
  return subs.map((s) => ({
    id: s.id,
    assignmentId: s.assignment.id,
    title: s.assignment.title,
    dueAt: s.assignment.dueAt.toISOString(),
    maxScore: s.assignment.maxScore,
    score: s.score,
    status: s.status,
    state: submissionState(s, s.assignment.dueAt, now),
    hoursLeft: (s.assignment.dueAt.getTime() - now.getTime()) / 3_600_000,
    newGrade: s.status === "GRADED" && !s.seenAt,
  }));
}

export type StudentAssignment = Awaited<ReturnType<typeof studentAssignments>>[number];

export async function studentSubmission(assignmentId: string, studentId: string) {
  const s = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId, studentId } },
    include: {
      assignment: {
        include: { files: { orderBy: { sortOrder: "asc" }, include: { file: { select: { id: true, fileName: true, mimeType: true } } } } },
      },
      pages: { orderBy: { sortOrder: "asc" }, select: { id: true, fileId: true, annotationFileId: true, file: { select: { mimeType: true, fileName: true } } } },
      student: { select: { fullName: true } },
    },
  });
  if (!s) return null;
  return { ...s, state: submissionState(s, s.assignment.dueAt, new Date()) };
}

/** Vườn cherry + so với chính mình + điểm theo thời gian của một em. */
export async function studentProgress(studentId: string) {
  const [subs, attendance] = await Promise.all([
    prisma.submission.findMany({
      where: { studentId },
      select: {
        status: true,
        submittedAt: true,
        score: true,
        gradedAt: true,
        assignment: { select: { title: true, dueAt: true, maxScore: true } },
      },
    }),
    prisma.attendance.findMany({ where: { studentId, source: "SESSION" }, select: { date: true, status: true } }),
  ]);
  const onTime = subs.filter((s) => s.submittedAt && !isLate(s.submittedAt, s.assignment.dueAt)).length;
  const weeks = fullAttendanceWeeks(attendance.map((a) => ({ date: fromDbDate(a.date), status: a.status })));
  const graded = subs
    .filter((s) => s.status === "GRADED" && s.score !== null && s.gradedAt)
    .map((s) => ({
      month: todayKey(s.gradedAt!).slice(0, 7),
      date: todayKey(s.gradedAt!),
      score: s.score!,
      max: s.assignment.maxScore,
      title: s.assignment.title,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const month = todayKey().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const prevMonth = `${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, "0")}`;
  const thisAvg = monthAverage(graded, month);
  const lastAvg = monthAverage(graded, prevMonth);
  return {
    garden: garden({ onTimeSubmissions: onTime, fullWeeks: weeks.length }),
    onTime,
    fullWeeks: weeks.length,
    comparison: selfComparison(thisAvg, lastAvg),
    thisAvg,
    lastAvg,
    scores: graded.map((g) => ({ date: g.date, title: g.title, score: Math.round(toTen(g.score, g.max) * 100) / 100 })),
  };
}

export type StudentProgress = Awaited<ReturnType<typeof studentProgress>>;
