/**
 * Cầu nối MinIO (bytes) ↔ bảng FileAsset (metadata) + quy tắc ai được xem file nào.
 */

import { canViewStudent, type SessionUser } from "@/common/permissions/permissions";
import { buildObjectKey, putObject } from "@/lib/minio";
import { prisma } from "@/shared/prisma/prisma.service";

export type UploadPurpose = "assignment" | "submission" | "annotation" | "voice";

type Rule = { roles: SessionUser["role"][]; maxBytes: number; mime: RegExp };

/**
 * Ai được tải loại file nào, tối đa bao nhiêu. Ảnh bài làm đã được nén ở trình duyệt
 * (~300KB/trang) nên 8MB là rất rộng — chặn trường hợp gửi nhầm video.
 */
export const UPLOAD_RULES: Record<UploadPurpose, Rule> = {
  assignment: {
    roles: ["TEACHER"],
    maxBytes: 20 * 1024 * 1024,
    mime: /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/msword)$/,
  },
  submission: {
    roles: ["STUDENT", "PARENT", "TEACHER"],
    maxBytes: 8 * 1024 * 1024,
    mime: /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/,
  },
  annotation: { roles: ["TEACHER"], maxBytes: 4 * 1024 * 1024, mime: /^image\/png$/ },
  voice: { roles: ["TEACHER"], maxBytes: 5 * 1024 * 1024, mime: /^audio\/(webm|ogg|mp4|mpeg|aac|x-m4a)(;.*)?$/ },
};

export function validateUpload(user: SessionUser, purpose: UploadPurpose, file: { size: number; type: string }) {
  const rule = UPLOAD_RULES[purpose];
  if (!rule.roles.includes(user.role)) return "Bạn không có quyền tải loại file này.";
  if (file.size <= 0) return "File đang trống.";
  if (file.size > rule.maxBytes) return `File lớn quá (tối đa ${Math.round(rule.maxBytes / 1024 / 1024)}MB).`;
  if (!rule.mime.test(file.type)) return "Định dạng file chưa hỗ trợ — dùng ảnh (JPG/PNG) hoặc PDF nhé.";
  return null;
}

export async function storeFile(user: SessionUser, purpose: UploadPurpose, file: File) {
  const key = buildObjectKey(`${purpose}/${user.id}`, file.name || `${purpose}.bin`);
  const body = Buffer.from(await file.arrayBuffer());
  const mime = file.type.split(";")[0];
  await putObject(key, body, mime);
  return prisma.fileAsset.create({
    data: { objectKey: key, fileName: file.name || "file", mimeType: mime, size: body.length, uploadedById: user.id },
    select: { id: true, fileName: true, mimeType: true, size: true },
  });
}

/**
 * Người này có được xem file không?
 * - Cô: mọi file.
 * - Người tự tải lên: được (trước khi gắn vào bài).
 * - Đề bài: học sinh được giao (hoặc phụ huynh của em đó).
 * - Trang bài làm / lớp chấm / ghi âm nhận xét: chủ bài nộp (hoặc phụ huynh).
 */
export async function canReadFile(user: SessionUser, fileId: string): Promise<boolean> {
  if (user.role === "TEACHER") return true;
  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: {
      uploadedById: true,
      assignmentFiles: { select: { assignment: { select: { submissions: { select: { studentId: true } } } } } },
      submissionPages: { select: { submission: { select: { studentId: true } } } },
      annotations: { select: { submission: { select: { studentId: true } } } },
      voiceComments: { select: { studentId: true } },
    },
  });
  if (!file) return false;
  if (file.uploadedById === user.id) return true;
  const studentIds = [
    ...file.assignmentFiles.flatMap((a) => a.assignment.submissions.map((s) => s.studentId)),
    ...file.submissionPages.map((p) => p.submission.studentId),
    ...file.annotations.map((p) => p.submission.studentId),
    ...file.voiceComments.map((s) => s.studentId),
  ];
  return studentIds.some((id) => canViewStudent(user, id));
}
