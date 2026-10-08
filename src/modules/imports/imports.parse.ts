/**
 * Đọc bảng học sinh từ Excel — hàm thuần, nhận mảng 2 chiều (đã đọc bằng exceljs) để test được.
 * Tự tìm dòng tiêu đề trong 10 dòng đầu và nhận diện cột theo tên thường gặp (có/không dấu, viết tắt).
 */

import { normalizePhone, PHONE_PATTERN, removeDiacritics } from "@/lib/utils";

export type ImportField =
  | "fullName"
  | "lastName"
  | "firstName"
  | "classroom"
  | "shift"
  | "dob"
  | "parentName"
  | "parentPhone"
  | "studentPhone"
  | "school"
  | "unitPrice"
  | "joinedAt"
  | "note";

export const FIELD_LABEL: Record<ImportField, string> = {
  fullName: "Họ tên",
  lastName: "Họ (đệm)",
  firstName: "Tên",
  classroom: "Lớp",
  shift: "Ca",
  dob: "Ngày sinh",
  parentName: "Phụ huynh",
  parentPhone: "SĐT phụ huynh",
  studentPhone: "SĐT học sinh",
  school: "Trường",
  unitPrice: "Học phí/buổi",
  joinedAt: "Ngày vào học",
  note: "Ghi chú",
};

/** Thứ tự quan trọng: cụ thể trước, chung chung sau ("sdt hoc sinh" phải khớp trước "sdt"). */
const SYNONYMS: [ImportField, string[]][] = [
  ["studentPhone", ["sdt hoc sinh", "sdt hs", "so dien thoai hoc sinh", "dien thoai hoc sinh", "sdt con"]],
  ["parentPhone", ["sdt phu huynh", "sdt ph", "so dien thoai phu huynh", "dien thoai phu huynh", "sdt bo me", "sdt", "so dien thoai", "dien thoai", "dt", "phone", "zalo"]],
  ["parentName", ["ten phu huynh", "ho ten phu huynh", "phu huynh", "bo me", "ph", "nguoi giam ho"]],
  ["fullName", ["ho va ten", "ho ten", "ho ten hoc sinh", "ten hoc sinh", "hoc sinh", "ho ten hs", "ten hs", "name"]],
  ["lastName", ["ho dem", "ho va ten dem", "ho"]],
  ["firstName", ["ten"]],
  ["dob", ["ngay sinh", "ns", "sinh ngay", "ngay thang nam sinh"]],
  ["joinedAt", ["ngay vao hoc", "ngay bat dau", "bat dau hoc", "ngay nhap hoc", "vao hoc"]],
  ["classroom", ["lop", "lop hoc", "khoi lop", "lop day"]],
  ["shift", ["ca", "ca hoc", "nhom", "kip"]],
  ["school", ["truong", "truong hoc", "truong dang hoc"]],
  ["unitPrice", ["hoc phi", "hoc phi buoi", "don gia", "gia buoi", "gia"]],
  ["note", ["ghi chu", "note"]],
];

function norm(value: unknown): string {
  return removeDiacritics(String(value ?? "")).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Ghép tiêu đề → trường. Trả về map cột → trường (cột không nhận ra thì bỏ qua). */
export function detectColumns(header: unknown[]): Map<number, ImportField> {
  const result = new Map<number, ImportField>();
  const used = new Set<ImportField>();
  const cells = header.map(norm);

  // Vòng 1: khớp chính xác. Vòng 2: tiêu đề BẮT ĐẦU bằng từ đồng nghĩa ("sdt phu huynh (zalo)").
  for (const mode of ["exact", "prefix"] as const) {
    for (const [field, words] of SYNONYMS) {
      if (used.has(field)) continue;
      for (let i = 0; i < cells.length; i++) {
        if (result.has(i) || !cells[i]) continue;
        const hit = words.some((w) => (mode === "exact" ? cells[i] === w : cells[i].startsWith(`${w} `)));
        if (hit) {
          result.set(i, field);
          used.add(field);
          break;
        }
      }
    }
  }
  return result;
}

/** Tìm dòng tiêu đề: dòng đầu tiên (trong 10 dòng) có ít nhất 2 cột nhận ra, trong đó có tên. */
export function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cols = detectColumns(rows[i] ?? []);
    const fields = new Set(cols.values());
    const hasName = fields.has("fullName") || fields.has("firstName");
    if (hasName && cols.size >= 2) return i;
  }
  return -1;
}

/** Ngày từ ô Excel: Date, số serial, "dd/mm/yyyy", "d-m-yy", "yyyy-mm-dd". → "YYYY-MM-DD" hoặc null. */
export function parseDateCell(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // exceljs trả Date ở 00:00 UTC cho ô ngày — lấy thẳng phần ngày UTC.
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 1000 && value < 80000) {
    const ms = Math.round((value - 25569) * 86_400_000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return valid(y, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1990 || y > 2100) return null;
  return dt.toISOString().slice(0, 10);
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && value && "text" in value) return String((value as { text: unknown }).text ?? "").trim();
  if (typeof value === "object" && value && "result" in value) return String((value as { result: unknown }).result ?? "").trim();
  return String(value).trim();
}

function titleCase(name: string): string {
  return name
    .toLocaleLowerCase("vi")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toLocaleUpperCase("vi") + w.slice(1))
    .join(" ");
}

export type ParsedRow = {
  rowNumber: number;
  fullName: string;
  classroom: string;
  shift: string;
  dob: string | null;
  parentName: string;
  parentPhone: string;
  studentPhone: string;
  school: string;
  unitPrice: number | null;
  joinedAt: string | null;
  note: string;
  problems: string[];
};

export function parseRows(rows: unknown[][]): {
  headerRow: number;
  columns: { index: number; header: string; field: ImportField }[];
  rows: ParsedRow[];
} {
  const headerRow = findHeaderRow(rows);
  if (headerRow < 0) return { headerRow, columns: [], rows: [] };
  const header = rows[headerRow] ?? [];
  const cols = detectColumns(header);
  const columns = [...cols.entries()].map(([index, field]) => ({ index, header: text(header[index]), field }));
  const get = (row: unknown[], field: ImportField) => {
    const c = columns.find((x) => x.field === field);
    return c ? row[c.index] : undefined;
  };

  const out: ParsedRow[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    let fullName = text(get(row, "fullName"));
    if (!fullName) fullName = [text(get(row, "lastName")), text(get(row, "firstName"))].filter(Boolean).join(" ");
    fullName = titleCase(fullName.replace(/\s+/g, " "));
    const rest = [get(row, "classroom"), get(row, "parentPhone"), get(row, "parentName")].map(text).join("");
    if (!fullName && !rest) continue; // dòng trống

    const problems: string[] = [];
    if (!fullName) problems.push("Thiếu họ tên");
    else if (/^\d+$/.test(fullName.replace(/\s/g, ""))) problems.push("Họ tên không hợp lệ");

    const rawParentPhone = text(get(row, "parentPhone"));
    const parentPhone = rawParentPhone ? normalizePhone(rawParentPhone.replace(/^(\d{9})$/, "0$1")) : "";
    if (parentPhone && !PHONE_PATTERN.test(parentPhone)) problems.push("SĐT phụ huynh chưa đúng");
    const rawStudentPhone = text(get(row, "studentPhone"));
    const studentPhone = rawStudentPhone ? normalizePhone(rawStudentPhone.replace(/^(\d{9})$/, "0$1")) : "";
    if (studentPhone && !PHONE_PATTERN.test(studentPhone)) problems.push("SĐT học sinh chưa đúng");

    const rawDob = get(row, "dob");
    const dob = parseDateCell(rawDob);
    if (text(rawDob) && !dob) problems.push("Ngày sinh không đọc được");

    const rawPrice = text(get(row, "unitPrice")).replace(/\D/g, "");
    let unitPrice: number | null = rawPrice ? Number(rawPrice) : null;
    // "80" hoặc "80k" trong file → 80.000đ
    if (unitPrice !== null && unitPrice > 0 && unitPrice < 1000) unitPrice *= 1000;

    out.push({
      rowNumber: r + 1,
      fullName,
      classroom: text(get(row, "classroom")),
      shift: text(get(row, "shift")),
      dob,
      parentName: titleCase(text(get(row, "parentName"))),
      parentPhone,
      studentPhone,
      school: text(get(row, "school")),
      unitPrice,
      joinedAt: parseDateCell(get(row, "joinedAt")),
      note: text(get(row, "note")),
      problems,
    });
  }
  return { headerRow, columns, rows: out };
}

/** Ghép tên lớp trong file với lớp trong app: "9a", "Lớp 9A", "9A1"… (bỏ dấu, bỏ chữ "lop"). */
export function matchClassroom(raw: string, classrooms: { id: string; name: string }[]): string | null {
  const key = (s: string) => norm(s).replace(/^lop\s*/, "").replace(/\s/g, "");
  const k = key(raw);
  if (!k) return null;
  return classrooms.find((c) => key(c.name) === k)?.id ?? null;
}
