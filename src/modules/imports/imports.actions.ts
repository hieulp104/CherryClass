"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, type ActionResult } from "@/common/filters/error";
import { can } from "@/common/permissions/permissions";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { FIELD_LABEL, matchClassroom, parseRows, type ParsedRow } from "@/modules/imports/imports.parse";
import { nextStudentCode } from "@/modules/students/students.service";
import { todayKey, toDbDate } from "@/lib/dates";
import { hueFromString, removeDiacritics } from "@/lib/utils";
import { writeAuditLog } from "@/shared/audit/audit.service";
import { prisma } from "@/shared/prisma/prisma.service";

export type PreviewRow = ParsedRow & {
  classroomId: string | null;
  shiftId: string | null;
  duplicate: "DB" | "FILE" | null;
  duplicateOf: string | null;
};

export type ImportPreview = {
  fileName: string;
  columns: { header: string; label: string }[];
  rows: PreviewRow[];
};

const MAX_BYTES = 5 * 1024 * 1024;

export async function previewImportAction(formData: FormData): Promise<ActionResult<ImportPreview>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "student.manage")) return fail("PERMISSION_DENIED");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("VALIDATION_ERROR", "Cô chọn file Excel (.xlsx) giúp em nhé.");
  if (file.size > MAX_BYTES) return fail("VALIDATION_ERROR", "File lớn quá (tối đa 5MB) ạ.");
  if (!/\.xlsx$/i.test(file.name)) {
    return fail("VALIDATION_ERROR", "Em chỉ đọc được file .xlsx. Nếu là .xls, cô mở bằng Excel rồi 'Lưu thành' .xlsx nhé.");
  }

  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ExcelJS.Buffer);
  } catch {
    return fail("VALIDATION_ERROR", "File này em không mở được. Cô thử lưu lại bằng Excel rồi chọn lại nhé.");
  }

  // Lấy sheet đầu tiên có dòng tiêu đề nhận ra được.
  let parsed: ReturnType<typeof parseRows> | null = null;
  for (const ws of wb.worksheets) {
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, n) => {
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows[n - 1] = values;
    });
    const p = parseRows(rows.map((r) => r ?? []));
    if (p.headerRow >= 0) {
      parsed = p;
      break;
    }
  }
  if (!parsed) {
    return fail(
      "VALIDATION_ERROR",
      "Em chưa tìm thấy cột 'Họ tên' trong file. Cô kiểm tra file có dòng tiêu đề (Họ tên, Lớp, SĐT…) hoặc tải file mẫu nhé.",
    );
  }

  const [classrooms, shifts, existing] = await Promise.all([
    prisma.classroom.findMany({ where: { archivedAt: null }, select: { id: true, name: true } }),
    prisma.shift.findMany({ where: { active: true }, select: { id: true, name: true, classroomId: true } }),
    prisma.student.findMany({
      where: { deletedAt: null },
      select: { searchName: true, parentPhone: true, classroomId: true, fullName: true, code: true },
    }),
  ]);
  const existingKeys = new Map<string, string>();
  for (const s of existing) {
    existingKeys.set(`${s.searchName}|${s.parentPhone ?? ""}`, `${s.fullName} (${s.code})`);
    existingKeys.set(`${s.searchName}|cls:${s.classroomId}`, `${s.fullName} (${s.code})`);
  }

  const seen = new Map<string, number>();
  const rows: PreviewRow[] = parsed.rows.map((r) => {
    const classroomId = matchClassroom(r.classroom, classrooms);
    const shiftId = classroomId
      ? shifts.find((s) => s.classroomId === classroomId && removeDiacritics(s.name) === removeDiacritics(r.shift))?.id ?? null
      : null;
    const sn = removeDiacritics(r.fullName);
    let duplicate: PreviewRow["duplicate"] = null;
    let duplicateOf: string | null = null;
    const dbHit =
      (r.parentPhone && existingKeys.get(`${sn}|${r.parentPhone}`)) ||
      (classroomId && existingKeys.get(`${sn}|cls:${classroomId}`));
    if (dbHit) {
      duplicate = "DB";
      duplicateOf = dbHit;
    } else {
      const fileKey = `${sn}|${r.parentPhone || r.classroom}`;
      if (seen.has(fileKey)) {
        duplicate = "FILE";
        duplicateOf = `dòng ${seen.get(fileKey)}`;
      } else seen.set(fileKey, r.rowNumber);
    }
    return { ...r, classroomId, shiftId, duplicate, duplicateOf };
  });

  return ok({
    fileName: file.name,
    columns: parsed.columns.map((c) => ({ header: c.header, label: FIELD_LABEL[c.field] })),
    rows,
  });
}

const commitSchema = z.object({
  fileName: z.string().max(200),
  rows: z
    .array(
      z.object({
        rowNumber: z.number(),
        fullName: z.string().trim().min(2).max(80),
        classroomId: z.string().min(1),
        shiftId: z.string().nullable(),
        dob: z.string().nullable(),
        parentName: z.string().max(80),
        parentPhone: z.string().max(15),
        studentPhone: z.string().max(15),
        school: z.string().max(120),
        unitPrice: z.number().int().min(0).nullable(),
        joinedAt: z.string().nullable(),
      }),
    )
    .min(1, "Chưa có dòng nào được chọn để nhập")
    .max(1000),
  skipped: z.number().int().min(0),
});

export async function commitImportAction(input: unknown): Promise<ActionResult<{ created: number }>> {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED");
  if (!can(user, "student.manage")) return fail("PERMISSION_DENIED");
  const parsed = commitSchema.safeParse(input);
  if (!parsed.success) return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  const { rows, fileName, skipped } = parsed.data;
  const today = todayKey();

  const created = await prisma.$transaction(
    async (tx) => {
      let code = await nextStudentCode(tx);
      const next = (c: string) => `HS${String(Number(c.slice(2)) + 1).padStart(4, "0")}`;
      const data = rows.map((r) => {
        const row = {
          code,
          fullName: r.fullName,
          searchName: removeDiacritics(r.fullName),
          classroomId: r.classroomId,
          shiftId: r.shiftId,
          dob: r.dob ? toDbDate(r.dob) : null,
          parentName: r.parentName || null,
          parentPhone: r.parentPhone || null,
          studentPhone: r.studentPhone || null,
          school: r.school || null,
          unitPrice: r.unitPrice,
          joinedAt: toDbDate(r.joinedAt ?? today),
          avatarHue: hueFromString(`${code}${r.fullName}`),
        };
        code = next(code);
        return row;
      });
      await tx.student.createMany({ data });
      await tx.importBatch.create({
        data: { fileName, total: rows.length + skipped, created: rows.length, skipped, report: { rows: rows.map((r) => r.rowNumber) } },
      });
      await writeAuditLog(tx, {
        actorId: user.id,
        action: "STUDENT_IMPORT",
        entity: "ImportBatch",
        after: { fileName, created: rows.length, skipped },
      });
      return rows.length;
    },
    { timeout: 30_000 },
  );
  revalidatePath("/hoc-sinh");
  revalidatePath("/lop-hoc");
  return ok({ created });
}
