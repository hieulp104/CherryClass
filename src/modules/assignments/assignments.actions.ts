"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can, canViewStudent } from "@/common/permissions/permissions";
import { normalizeScore } from "@/modules/assignments/assignments.core";
import { resolveTargets } from "@/modules/assignments/assignments.service";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Hạn nộp chưa đúng")
  // Ô datetime-local không có múi giờ → hiểu là giờ Việt Nam.
  .transform((v) => new Date(`${v}:00+07:00`));

const createSchema = z.object({
  title: z.string().trim().min(2, "Cô đặt tên bài giúp em").max(120),
  description: z.string().trim().max(3000).optional().nullable(),
  dueAt: localDateTime,
  maxScore: z.coerce.number().int().min(1).max(100).default(10),
  fileIds: z.array(z.string()).max(20).default([]),
  targets: z
    .array(z.object({ kind: z.enum(["CLASSROOM", "SHIFT", "STUDENT"]), refId: z.string().min(1) }))
    .min(1, "Cô chọn lớp, ca hoặc học sinh được giao bài nhé"),
});

export async function createAssignmentAction(input: unknown): Promise<ActionResult<{ id: string; count: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "assignment.manage")) return fail("PERMISSION_DENIED");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const d = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const { studentIds, labels } = await resolveTargets(tx, d.targets);
    if (studentIds.length === 0) return null;
    const a = await tx.assignment.create({
      data: {
        title: d.title,
        description: d.description || null,
        dueAt: d.dueAt,
        maxScore: d.maxScore,
        files: { create: d.fileIds.map((fileId, i) => ({ fileId, sortOrder: i })) },
        targets: { create: labels },
        submissions: { create: studentIds.map((studentId) => ({ studentId })) },
      },
    });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: "ASSIGNMENT_CREATE",
      entity: "Assignment",
      entityId: a.id,
      after: { title: a.title, dueAt: a.dueAt, students: studentIds.length, targets: labels.map((l) => l.label) },
    });
    return { id: a.id, count: studentIds.length };
  });
  if (!result) return fail("VALIDATION_ERROR", "Lớp / ca đã chọn chưa có em nào đang học.");
  revalidatePath("/bai-tap");
  return ok(result);
}

const updateSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).optional().nullable(),
  dueAt: localDateTime,
});

/** Sửa tên / mô tả / gia hạn. "Nộp muộn" luôn so với hạn HIỆN TẠI, nên gia hạn sẽ xóa cờ muộn của bài nộp trước hạn mới. */
export async function updateAssignmentAction(input: unknown): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "assignment.manage")) return fail("PERMISSION_DENIED");
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { id, ...data } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const before = await tx.assignment.findUnique({ where: { id } });
    const after = await tx.assignment.update({ where: { id }, data: { ...data, description: data.description || null } });
    await writeAuditLog(tx, { actorId: user.id, action: "ASSIGNMENT_UPDATE", entity: "Assignment", entityId: id, before, after });
  });
  revalidatePath(`/bai-tap/${id}`);
  revalidatePath("/bai-tap");
  return ok(null);
}

export async function archiveAssignmentAction(id: string): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "assignment.manage")) return fail("PERMISSION_DENIED");
  await prisma.$transaction(async (tx) => {
    await tx.assignment.update({ where: { id }, data: { archivedAt: new Date() } });
    await writeAuditLog(tx, { actorId: user.id, action: "ASSIGNMENT_ARCHIVE", entity: "Assignment", entityId: id });
  });
  revalidatePath("/bai-tap");
  return ok(null);
}

// ─────────────────── Nộp bài ───────────────────

const submitSchema = z.object({
  assignmentId: z.string().min(1),
  studentId: z.string().min(1),
  pageFileIds: z.array(z.string()).min(1, "Em chụp ít nhất một trang bài làm nhé").max(30),
  note: z.string().trim().max(500).optional().nullable(),
});

/**
 * Học sinh (hoặc phụ huynh nộp hộ con) nộp bài. Nộp lại được cho tới khi cô chấm — bản mới thay bản cũ.
 * Chỉ gắn được file do CHÍNH người này vừa tải lên (chống gắn file của người khác).
 */
export async function submitWorkAction(input: unknown): Promise<ActionResult<{ late: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "submission.submit")) return fail("PERMISSION_DENIED");
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const d = parsed.data;
  if (!canViewStudent(user, d.studentId)) return fail("PERMISSION_DENIED");

  const sub = await prisma.submission.findUnique({
    where: { assignmentId_studentId: { assignmentId: d.assignmentId, studentId: d.studentId } },
    include: { assignment: { select: { dueAt: true, archivedAt: true } } },
  });
  if (!sub || sub.assignment.archivedAt) return fail("NOT_FOUND", "Bài này không còn nữa.");
  if (sub.status === "GRADED") return fail("CONFLICT", "Cô đã chấm bài này rồi nên không nộp lại được nữa nhé.");

  const own = await prisma.fileAsset.count({ where: { id: { in: d.pageFileIds }, uploadedById: user.id } });
  if (own !== d.pageFileIds.length) return fail("VALIDATION_ERROR", "Có trang chưa tải lên xong. Em thử chọn lại ảnh nhé.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.submissionPage.deleteMany({ where: { submissionId: sub.id } });
    await tx.submission.update({
      where: { id: sub.id },
      data: {
        status: "SUBMITTED",
        submittedAt: now,
        note: d.note || null,
        pages: { create: d.pageFileIds.map((fileId, i) => ({ fileId, sortOrder: i })) },
      },
    });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: sub.status === "SUBMITTED" ? "SUBMISSION_RESUBMIT" : "SUBMISSION_SUBMIT",
      entity: "Submission",
      entityId: sub.id,
      after: { pages: d.pageFileIds.length },
    });
  });
  revalidatePath("/cua-em");
  revalidatePath("/phu-huynh");
  revalidatePath(`/bai-tap/${d.assignmentId}`);
  return ok({ late: now > sub.assignment.dueAt });
}

/** Học sinh / phụ huynh mở xem điểm → bỏ chấm "điểm mới". */
export async function markGradeSeenAction(submissionId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, select: { studentId: true, status: true, seenAt: true } });
  if (!sub || sub.status !== "GRADED" || sub.seenAt || user.role === "TEACHER" || !canViewStudent(user, sub.studentId)) return;
  await prisma.submission.update({ where: { id: submissionId }, data: { seenAt: new Date() } });
}

// ─────────────────── Chấm bài ───────────────────

const gradeSchema = z.object({
  submissionId: z.string().min(1),
  score: z.coerce.number(),
  comment: z.string().trim().max(2000).optional().nullable(),
  reviewHint: z.string().trim().max(500).optional().nullable(),
  voiceFileId: z.string().optional().nullable(),
  annotations: z.array(z.object({ pageId: z.string(), fileId: z.string().nullable() })).default([]),
});

export async function gradeSubmissionAction(input: unknown): Promise<ActionResult<{ score: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "assignment.manage")) return fail("PERMISSION_DENIED");
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const d = parsed.data;
  const sub = await prisma.submission.findUnique({
    where: { id: d.submissionId },
    include: { assignment: { select: { id: true, maxScore: true } }, pages: { select: { id: true } } },
  });
  if (!sub) return fail("NOT_FOUND");
  if (sub.status === "ASSIGNED") return fail("CONFLICT", "Em này chưa nộp bài.");
  const score = normalizeScore(d.score, sub.assignment.maxScore);
  if (score === null) return fail("VALIDATION_ERROR", `Điểm phải từ 0 đến ${sub.assignment.maxScore}.`);
  const pageIds = new Set(sub.pages.map((p) => p.id));

  await prisma.$transaction(async (tx) => {
    for (const a of d.annotations) {
      if (!pageIds.has(a.pageId)) continue;
      await tx.submissionPage.update({ where: { id: a.pageId }, data: { annotationFileId: a.fileId } });
    }
    await tx.submission.update({
      where: { id: sub.id },
      data: {
        status: "GRADED",
        score,
        comment: d.comment || null,
        reviewHint: d.reviewHint || null,
        voiceFileId: d.voiceFileId === undefined ? sub.voiceFileId : d.voiceFileId,
        gradedAt: new Date(),
        seenAt: null,
      },
    });
    await writeAuditLog(tx, {
      actorId: user.id,
      action: sub.status === "GRADED" ? "SUBMISSION_REGRADE" : "SUBMISSION_GRADE",
      entity: "Submission",
      entityId: sub.id,
      before: { score: sub.score },
      after: { score },
    });
  });
  revalidatePath(`/bai-tap/${sub.assignment.id}`);
  revalidatePath("/bai-tap");
  return ok({ score });
}
