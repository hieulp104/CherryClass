"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Copy, Download, FileSpreadsheet, UploadCloud } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Notice } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { CherryConfetti } from "@/components/ui/fx";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { commitImportAction, previewImportAction, type ImportPreview, type PreviewRow } from "@/modules/imports/imports.actions";
import type { ClassroomOption } from "@/modules/students/components/student-form";
import { fullDate } from "@/lib/dates";
import { cn, formatVnd } from "@/lib/utils";

export function ImportWizard({ classrooms }: { classrooms: ClassroomOption[] }) {
  const toast = useToast();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [rows, setRows] = useState<(PreviewRow & { selected: boolean })[]>([]);
  const [done, setDone] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = (file: File) =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.append("file", file);
      const res = await previewImportAction(fd);
      if (!res.ok) return setError(res.message);
      setPreview(res.data);
      setRows(res.data.rows.map((r) => ({ ...r, selected: r.problems.length === 0 && !r.duplicate && Boolean(r.fullName) })));
    });

  const selected = rows.filter((r) => r.selected);
  const missingClass = selected.filter((r) => !r.classroomId).length;

  const setAllClassroom = (id: string) =>
    setRows((list) => list.map((r) => (r.selected && !r.classroomId ? { ...r, classroomId: id, shiftId: null } : r)));

  const commit = () =>
    start(async () => {
      const res = await commitImportAction({
        fileName: preview?.fileName ?? "",
        skipped: rows.length - selected.length,
        rows: selected.map((r) => ({
          rowNumber: r.rowNumber,
          fullName: r.fullName,
          classroomId: r.classroomId ?? "",
          shiftId: r.shiftId,
          dob: r.dob,
          parentName: r.parentName,
          parentPhone: r.parentPhone,
          studentPhone: r.studentPhone,
          school: r.school,
          unitPrice: r.unitPrice,
          joinedAt: r.joinedAt,
        })),
      });
      if (!res.ok) return toast.error(res.message);
      setDone(res.data.created);
    });

  if (done !== null) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <CherryConfetti fire={1} />
        <Mascot mood="celebrate" size={140} className="mx-auto" />
        <h1 className="mt-4 text-h1 font-extrabold">Đã nhập {done} học sinh! 🎉</h1>
        <p className="mt-2 text-muted">Các em đã sẵn sàng trong danh sách điểm danh. Em nào chưa xếp ca thì cô vào sổ tay của em để chọn ca nhé.</p>
        <div className="mt-6 flex justify-center gap-2">
          <ButtonLink href="/hoc-sinh">Xem danh sách</ButtonLink>
          <Button
            variant="outline"
            onClick={() => {
              setDone(null);
              setPreview(null);
              setRows([]);
            }}
          >
            Nhập file khác
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader back="/hoc-sinh" title="Nhập học sinh từ Excel" subtitle="Em tự nhận diện cột, cô xem lại trước khi lưu" />

      <AnimatePresence mode="wait">
        {!preview ? (
          <motion.div key="upload" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mx-auto max-w-2xl">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) upload(f);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-3 rounded-sheet border-2 border-dashed bg-surface px-6 py-12 text-center transition",
                dragging ? "scale-[1.01] border-primary bg-primary-soft/40" : "border-line-strong hover:border-primary",
              )}
            >
              <motion.div animate={dragging ? { y: -8, scale: 1.1 } : { y: [0, -6, 0] }} transition={dragging ? {} : { duration: 2.4, repeat: Infinity }}>
                {pending ? <Mascot mood="thinking" size={96} /> : <UploadCloud className="size-14 text-primary" />}
              </motion.div>
              <p className="text-lg font-bold">{pending ? "Em đang đọc file…" : "Chọn hoặc kéo file Excel vào đây"}</p>
              <p className="text-sm text-muted">File .xlsx, có dòng tiêu đề như Họ tên · Lớp · SĐT phụ huynh…</p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {error && (
              <Notice tone="overdue" className="mt-4">
                {error}
              </Notice>
            )}
            <Card variant="subtle" className="mt-4 flex flex-wrap items-center gap-3 p-4">
              <FileSpreadsheet className="size-8 text-leaf" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Chưa có file sẵn?</p>
                <p className="text-sm text-muted">Tải file mẫu, điền danh sách rồi chọn lại ở trên.</p>
              </div>
              <a
                href="/api/mau-nhap-excel"
                className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line-strong bg-surface px-4 text-sm font-semibold hover:bg-surface-subtle"
              >
                <Download className="size-4" /> Tải file mẫu
              </a>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="size-5 text-leaf" />
                <p className="font-semibold">{preview.fileName}</p>
                <span className="text-sm text-muted">· {rows.length} dòng</span>
              </div>
              <p className="mt-2 text-sm text-muted">Em nhận ra các cột:</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {preview.columns.map((c) => (
                  <Chip key={c.header} tone="leaf">
                    {c.header.toLowerCase() === c.label.toLowerCase() ? c.label : `${c.header} → ${c.label}`}
                  </Chip>
                ))}
              </div>
            </Card>

            {missingClass > 0 && (
              <Notice tone="amber" className="mt-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{missingClass} em chưa ghép được lớp. Gán tất cả vào:</span>
                  <Select className="min-h-9 w-auto py-1" defaultValue="" onChange={(e) => e.target.value && setAllClassroom(e.target.value)}>
                    <option value="">Chọn lớp…</option>
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Notice>
            )}

            <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface shadow-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-surface-subtle text-left text-caption text-muted">
                  <tr>
                    <th className="w-10 p-3">
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        checked={selected.length === rows.length}
                        onChange={(e) => setRows((list) => list.map((r) => ({ ...r, selected: e.target.checked && Boolean(r.fullName) })))}
                        className="size-4 accent-[var(--c-primary)]"
                      />
                    </th>
                    <th className="p-3">Dòng</th>
                    <th className="p-3">Họ tên</th>
                    <th className="p-3">Lớp</th>
                    <th className="p-3">Ngày sinh</th>
                    <th className="p-3">Phụ huynh</th>
                    <th className="p-3">Học phí</th>
                    <th className="p-3">Lưu ý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r, i) => (
                    <tr key={r.rowNumber} className={cn(!r.selected && "opacity-55", (r.problems.length || r.duplicate) && "bg-amber-soft/40")}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={r.selected}
                          disabled={!r.fullName}
                          onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                          className="size-4 accent-[var(--c-primary)]"
                        />
                      </td>
                      <td className="p-3 text-muted tabular">{r.rowNumber}</td>
                      <td className="p-3 font-semibold">{r.fullName || <span className="text-overdue">(trống)</span>}</td>
                      <td className="p-3">
                        <Select
                          className="min-h-9 min-w-32 py-1 text-sm"
                          value={r.classroomId ?? ""}
                          onChange={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, classroomId: e.target.value || null, shiftId: null } : x)))}
                        >
                          <option value="">{r.classroom ? `"${r.classroom}"?` : "Chọn…"}</option>
                          {classrooms.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="p-3 tabular">{r.dob ? fullDate(r.dob) : "—"}</td>
                      <td className="p-3">
                        {r.parentName || "—"}
                        {r.parentPhone && <span className="block text-caption text-muted">{r.parentPhone}</span>}
                      </td>
                      <td className="p-3 tabular">{r.unitPrice ? formatVnd(r.unitPrice) : "Mặc định"}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {r.duplicate && (
                            <Chip tone="amber" icon={Copy}>
                              Trùng {r.duplicateOf}
                            </Chip>
                          )}
                          {r.problems.map((p) => (
                            <Chip key={p} tone="overdue" icon={AlertTriangle}>
                              {p}
                            </Chip>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pb-safe sticky bottom-20 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface-raised/95 p-3 shadow-pop backdrop-blur lg:bottom-4">
              <p className="text-sm">
                Nhập <b>{selected.length}</b> em · bỏ qua {rows.length - selected.length} dòng
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setPreview(null)}>
                  Chọn file khác
                </Button>
                <Button loading={pending} disabled={selected.length === 0 || missingClass > 0} onClick={commit}>
                  Nhập {selected.length} học sinh
                </Button>
              </div>
            </div>
            {missingClass > 0 && <p className="mt-2 text-center text-caption text-amber">Cô chọn lớp cho các em còn thiếu giúp em nhé.</p>}
            <p className="mt-4 text-center text-caption text-muted">
              Đã có danh sách? <Link href="/hoc-sinh" className="font-semibold text-primary">Về trang học sinh</Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
