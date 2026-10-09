"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Check, Search, Send, X } from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { CherryConfetti } from "@/components/ui/fx";
import { PageHeader } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { UploadGrid } from "@/components/ui/upload-grid";
import { createAssignmentAction } from "@/modules/assignments/assignments.actions";
import type { TargetInput } from "@/modules/assignments/assignments.service";
import { useStudentSearch } from "@/modules/students/use-student-search";
import { addDays, todayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

type ClassOpt = { id: string; name: string; count: number; shifts: { id: string; name: string; count: number }[] };

const QUICK_DUE = [
  { label: "Ngày mai", days: 1 },
  { label: "3 ngày", days: 3 },
  { label: "1 tuần", days: 7 },
];

export function AssignmentForm({ classrooms }: { classrooms: ClassOpt[] }) {
  const router = useRouter();
  const toast = useToast();
  const [targets, setTargets] = useState<(TargetInput & { label: string; count: number })[]>([]);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [due, setDue] = useState(`${addDays(todayKey(), 3)}T21:00`);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [confetti, setConfetti] = useState(0);
  const search = useStudentSearch();

  const has = (kind: TargetInput["kind"], refId: string) => targets.some((t) => t.kind === kind && t.refId === refId);
  const toggle = (t: TargetInput & { label: string; count: number }) =>
    setTargets((list) => (has(t.kind, t.refId) ? list.filter((x) => !(x.kind === t.kind && x.refId === t.refId)) : [...list, t]));
  const approx = targets.reduce((s, t) => s + t.count, 0);

  const submit = (fd: FormData) =>
    start(async () => {
      setError(null);
      const res = await createAssignmentAction({
        title: fd.get("title"),
        description: fd.get("description"),
        dueAt: due,
        maxScore: fd.get("maxScore"),
        fileIds,
        targets: targets.map(({ kind, refId }) => ({ kind, refId })),
      });
      if (!res.ok) return setError(res.message);
      setConfetti((n) => n + 1);
      toast.success(`Đã giao bài cho ${res.data.count} em 🍒`);
      setTimeout(() => router.push(`/bai-tap/${res.data.id}`), 700);
    });

  return (
    <div className="mx-auto max-w-2xl">
      <CherryConfetti fire={confetti} />
      <PageHeader back="/bai-tap" title="Giao bài mới" />
      <form action={submit} className="space-y-4">
        <Card className="space-y-4 p-5">
          <Field label="Tên bài">
            <Input name="title" required placeholder="vd: Hình học — Tứ giác nội tiếp (bài 1–5)" autoFocus />
          </Field>
          <Field label="Lời dặn (không bắt buộc)">
            <Textarea name="description" rows={3} placeholder="vd: Trình bày đầy đủ lời giải, vẽ hình rõ ràng nhé các em!" />
          </Field>
          <Field label="Đề bài" hint="Chụp đề hoặc chọn file PDF/Word. Ảnh được làm nét tự động.">
            <UploadGrid
              purpose="assignment"
              accept="image/*,application/pdf,.doc,.docx"
              label="Thêm đề"
              onChange={(ids, busy) => {
                setFileIds(ids);
                setUploading(busy);
              }}
            />
          </Field>
        </Card>

        <Card className="space-y-4 p-5">
          <p className="font-bold">Giao cho</p>
          <div className="space-y-3">
            {classrooms.map((c) => (
              <div key={c.id}>
                <div className="flex flex-wrap gap-2">
                  <TargetChip active={has("CLASSROOM", c.id)} onClick={() => toggle({ kind: "CLASSROOM", refId: c.id, label: c.name, count: c.count })}>
                    Cả {c.name} · {c.count} em
                  </TargetChip>
                  {c.shifts.map((s) => (
                    <TargetChip
                      key={s.id}
                      small
                      active={has("SHIFT", s.id) || has("CLASSROOM", c.id)}
                      disabled={has("CLASSROOM", c.id)}
                      onClick={() => toggle({ kind: "SHIFT", refId: s.id, label: `${c.name} · ${s.name}`, count: s.count })}
                    >
                      {s.name} · {s.count}
                    </TargetChip>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={search.q} onChange={(e) => search.setQuery(e.target.value)} placeholder="Hoặc giao riêng cho từng em…" className="pl-9" />
            </div>
            {search.results.length > 0 && (
              <ul className="mt-1 max-h-52 overflow-y-auto rounded-control border border-line">
                {search.results.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => {
                        toggle({ kind: "STUDENT", refId: s.id, label: s.fullName, count: 1 });
                        search.reset();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                    >
                      <StudentAvatar name={s.fullName} hue={s.avatarHue} size={28} /> {s.fullName}
                      <span className="text-muted">· {s.classroom.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {targets
                .filter((t) => t.kind === "STUDENT")
                .map((t) => (
                  <span key={t.refId} className="inline-flex items-center gap-1 rounded-full bg-sky-soft py-1 pl-3 pr-1.5 text-sm font-semibold text-sky">
                    {t.label}
                    <button type="button" aria-label={`Bỏ ${t.label}`} onClick={() => toggle(t)} className="grid size-6 place-items-center rounded-full hover:bg-sky/20">
                      <X className="size-3.5" />
                    </button>
                  </span>
                ))}
            </div>
          </div>
          {targets.length > 0 && (
            <motion.p key={approx} initial={{ scale: 0.95, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="text-sm font-semibold text-primary-deep">
              Khoảng {approx} em sẽ nhận bài (em trùng ở nhiều nhóm chỉ tính một lần)
            </motion.p>
          )}
        </Card>

        <Card className="space-y-4 p-5">
          <Field label="Hạn nộp">
            <div className="mb-2 flex flex-wrap gap-2">
              {QUICK_DUE.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setDue(`${addDays(todayKey(), q.days)}T21:00`)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-semibold active:scale-95",
                    due === `${addDays(todayKey(), q.days)}T21:00` ? "border-primary bg-primary-soft text-primary-deep" : "border-line",
                  )}
                >
                  {q.label}
                </button>
              ))}
            </div>
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} required />
          </Field>
          <Field label="Thang điểm">
            <Select name="maxScore" defaultValue="10">
              <option value="10">Thang 10</option>
              <option value="20">Thang 20</option>
              <option value="100">Thang 100</option>
            </Select>
          </Field>
        </Card>

        {error && <Notice tone="overdue">{error}</Notice>}
        <div className="pb-safe sticky bottom-20 z-10 lg:bottom-4">
          <Button type="submit" size="lg" block loading={pending} disabled={uploading || targets.length === 0} className="shadow-fab">
            {!pending && <Send className="size-5" />}
            {uploading ? "Đang tải đề lên…" : "Giao bài"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TargetChip({
  children,
  active,
  onClick,
  small,
  disabled,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  small?: boolean;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors disabled:opacity-60",
        small ? "px-3 py-1.5 text-sm" : "px-4 py-2",
        active ? "border-primary bg-primary text-on-primary" : "border-line bg-surface hover:border-primary/50",
      )}
    >
      {active && <Check className="size-4" />}
      {children}
    </motion.button>
  );
}
