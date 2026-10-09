"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  Lightbulb,
  MessageSquareText,
} from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { StudentAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Chip, Notice } from "@/components/ui/feedback";
import { Input, Textarea } from "@/components/ui/form";
import { CherryConfetti } from "@/components/ui/fx";
import { useToast } from "@/components/ui/toast";
import { gradeSubmissionAction } from "@/modules/assignments/assignments.actions";
import { formatScore, isLowScore, normalizeScore } from "@/modules/assignments/assignments.core";
import type { GradingQueue } from "@/modules/assignments/assignments.service";
import { Annotator, type AnnotatorHandle } from "@/modules/assignments/components/annotator";
import { VoiceRecorder } from "@/modules/assignments/components/voice-recorder";
import { fileUrl, uploadFile } from "@/lib/image-prep";
import { haptic } from "@/lib/haptics";
import { cn, formatDateTime, givenName } from "@/lib/utils";

type Sub = GradingQueue["submissions"][number];
type Voice = { kind: "keep" } | { kind: "new"; blob: Blob } | { kind: "remove" };

/**
 * Màn chấm bài: lướt từng bài (nút ← → hoặc phím mũi tên), khoanh/ghi chú lên ảnh,
 * chấm điểm bằng chip, chèn nhận xét mẫu một chạm, ghi âm nhận xét. "Lưu & bài tiếp" tự sang bài kế.
 */
export function GradingView({
  queue,
  initialId,
  quickComments,
}: {
  queue: GradingQueue;
  initialId?: string;
  quickComments: string[];
}) {
  const [subs, setSubs] = useState(queue.submissions);
  const firstUngraded = subs.findIndex((s) => s.status === "SUBMITTED");
  const [index, setIndex] = useState(() => {
    const i = initialId ? subs.findIndex((s) => s.id === initialId) : -1;
    return i >= 0 ? i : Math.max(0, firstUngraded);
  });
  const [dir, setDir] = useState(1);
  const [done, setDone] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const current = subs[index];

  const go = (next: number) => {
    if (next < 0 || next >= subs.length) return;
    setDir(next > index ? 1 : -1);
    setIndex(next);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === "TEXTAREA" || (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onSaved = (updated: Sub) => {
    const list = subs.map((s) => (s.id === updated.id ? updated : s));
    setSubs(list);
    const nextIdx = list.findIndex((s, i) => i > index && s.status === "SUBMITTED");
    const anyLeft = list.findIndex((s) => s.status === "SUBMITTED");
    if (nextIdx >= 0) go(nextIdx);
    else if (anyLeft >= 0) go(anyLeft);
    else {
      setDone(true);
      setConfetti((n) => n + 1);
    }
  };

  const graded = subs.filter((s) => s.status === "GRADED").length;

  if (subs.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <Mascot mood="sleepy" size={120} />
        <p className="text-xl font-bold">Chưa có em nào nộp bài</p>
        <Link href={`/bai-tap/${queue.id}`} className="font-semibold text-primary">
          ← Về trang bài tập
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <CherryConfetti fire={confetti} />
      <header className="pt-safe sticky top-0 z-30 border-b border-line/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-2.5">
          <Link
            href={`/bai-tap/${queue.id}`}
            aria-label="Thoát chấm bài"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface shadow-card active:scale-90"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{queue.title}</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <motion.div className="h-full rounded-full bg-leaf" animate={{ width: `${(graded / subs.length) * 100}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold tabular">
            {index + 1}/{subs.length}
          </span>
          <button
            type="button"
            aria-label="Bài trước"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="grid size-10 place-items-center rounded-full bg-surface shadow-card disabled:opacity-40"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="Bài sau"
            onClick={() => go(index + 1)}
            disabled={index === subs.length - 1}
            className="grid size-10 place-items-center rounded-full bg-surface shadow-card disabled:opacity-40"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait" custom={dir}>
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-3 px-6 py-16 text-center"
          >
            <Mascot mood="celebrate" size={150} />
            <p className="text-2xl font-extrabold">Chấm xong hết rồi! 🎉</p>
            <p className="text-muted">Các em sẽ thấy điểm và nhận xét của cô ngay.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="outline" onClick={() => setDone(false)}>
                Xem lại
              </Button>
              <Link
                href={`/bai-tap/${queue.id}`}
                className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 font-semibold text-on-primary"
              >
                Về trang bài tập
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={current.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <SubmissionGrader
              key={current.id}
              sub={current}
              maxScore={queue.maxScore}
              quickComments={quickComments}
              onSaved={onSaved}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SubmissionGrader({
  sub,
  maxScore,
  quickComments,
  onSaved,
}: {
  sub: Sub;
  maxScore: number;
  quickComments: string[];
  onSaved: (s: Sub) => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [score, setScore] = useState(sub.score !== null ? String(sub.score).replace(".", ",") : "");
  const [comment, setComment] = useState(sub.comment ?? "");
  const [hint, setHint] = useState(sub.reviewHint ?? "");
  const [voice, setVoice] = useState<Voice>({ kind: "keep" });
  const [pending, start] = useTransition();
  // Điện thoại: bảng chấm gọn (chỉ điểm + nút lưu) để nhìn rõ bài; mở rộng khi cần nhận xét.
  const [expanded, setExpanded] = useState(Boolean(sub.comment || sub.reviewHint || sub.voiceFileId));
  const annotators = useRef(new Map<string, AnnotatorHandle | null>());
  const parsed = score.trim() ? normalizeScore(Number(score.replace(",", ".")), maxScore) : null;
  const low = parsed !== null && isLowScore(parsed, maxScore);
  const chips =
    maxScore === 10
      ? [10, 9.5, 9, 8.5, 8, 7.5, 7, 6, 5, 4]
      : [
          maxScore,
          Math.round(maxScore * 0.9),
          Math.round(maxScore * 0.8),
          Math.round(maxScore * 0.7),
          Math.round(maxScore * 0.5),
        ];

  const save = () =>
    start(async () => {
      if (parsed === null) {
        toast.error(`Cô nhập điểm từ 0 đến ${maxScore} giúp em nhé.`);
        return;
      }
      try {
        const annotations: { pageId: string; fileId: string | null }[] = [];
        for (const page of sub.pages) {
          const handle = annotators.current.get(page.id);
          const out = handle ? await handle.export() : null;
          if (out === "clear") annotations.push({ pageId: page.id, fileId: null });
          else if (out) annotations.push({ pageId: page.id, fileId: (await uploadFile(out, "cham.png", "annotation")).id });
        }
        let voiceFileId: string | null | undefined;
        if (voice.kind === "new") {
          const ext = voice.blob.type.includes("mp4") ? "m4a" : voice.blob.type.includes("ogg") ? "ogg" : "webm";
          voiceFileId = (await uploadFile(voice.blob, `nhan-xet.${ext}`, "voice")).id;
        } else if (voice.kind === "remove") voiceFileId = null;

        const res = await gradeSubmissionAction({
          submissionId: sub.id,
          score: parsed,
          comment,
          reviewHint: hint,
          voiceFileId,
          annotations,
        });
        if (!res.ok) return toast.error(res.message);
        haptic([12, 40, 12]);
        toast.success(`${givenName(sub.student.fullName)}: ${formatScore(res.data.score)} điểm ✓`);
        const updatedPages = sub.pages.map((p) => {
          const a = annotations.find((x) => x.pageId === p.id);
          return a ? { ...p, annotationFileId: a.fileId } : p;
        });
        onSaved({
          ...sub,
          status: "GRADED",
          score: res.data.score,
          comment,
          reviewHint: hint,
          voiceFileId: voiceFileId === undefined ? sub.voiceFileId : voiceFileId,
          pages: updatedPages,
        });
        router.refresh();
      } catch (e) {
        toast.error((e as Error).message);
      }
    });

  return (
    <div className="mx-auto grid max-w-5xl gap-4 px-3 pb-40 pt-3 lg:grid-cols-[1.5fr_1fr] lg:pb-10 [&>*]:min-w-0">
      {/* Bài làm */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <StudentAvatar name={sub.student.fullName} hue={sub.student.avatarHue} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{sub.student.fullName}</p>
            <p className="text-caption text-muted">
              {sub.student.classroom.name} · nộp {sub.submittedAt ? formatDateTime(sub.submittedAt) : ""}
            </p>
          </div>
          {sub.late && (
            <Chip tone="amber" icon={Clock}>
              Nộp muộn
            </Chip>
          )}
          {sub.status === "GRADED" && (
            <Chip tone="leaf" icon={CheckCircle2}>
              Đã chấm
            </Chip>
          )}
        </div>
        {sub.note && (
          <Notice tone="sky" icon={MessageSquareText}>
            Em nhắn: “{sub.note}”
          </Notice>
        )}
        {sub.pages.map((p, i) =>
          p.file.mimeType.startsWith("image/") ? (
            <div key={p.id}>
              <p className="mb-1 text-caption font-semibold text-muted">Trang {i + 1}</p>
              <Annotator
                ref={(h) => {
                  annotators.current.set(p.id, h);
                }}
                src={fileUrl(p.fileId)}
                annotationSrc={p.annotationFileId ? fileUrl(p.annotationFileId) : null}
              />
            </div>
          ) : (
            <a
              key={p.id}
              href={fileUrl(p.fileId)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 font-semibold"
            >
              <FileText className="size-6 text-sky" /> Trang {i + 1}: {p.file.fileName} (mở xem)
            </a>
          ),
        )}
      </div>

      {/* Bảng chấm */}
      <aside className="pb-safe fixed inset-x-0 bottom-0 z-20 max-h-[70dvh] overflow-y-auto rounded-t-sheet border-t border-line bg-surface-raised/95 p-4 shadow-pop backdrop-blur lg:sticky lg:top-20 lg:max-h-none lg:self-start lg:rounded-card lg:border">
        <p className="text-sm font-bold text-muted">Điểm (thang {maxScore})</p>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {chips.map((c) => (
            <motion.button
              key={c}
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setScore(String(c).replace(".", ","))}
              className={cn(
                "min-w-12 shrink-0 rounded-[14px] border px-2.5 py-2 text-lg font-extrabold tabular",
                parsed === c ? "border-primary bg-primary text-on-primary" : "border-line bg-surface",
              )}
            >
              {formatScore(c)}
            </motion.button>
          ))}
          <Input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            inputMode="decimal"
            placeholder="Khác"
            className="w-20 shrink-0 text-center text-lg font-extrabold"
            aria-label="Điểm"
          />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 flex w-full items-center justify-center gap-1 text-sm font-semibold text-primary lg:hidden"
        >
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
          {expanded ? "Thu gọn" : comment || hint ? "Sửa nhận xét" : "Thêm nhận xét · ghi âm"}
        </button>
        <div className={cn(!expanded && !low && "hidden lg:block")}>
          <p className="mt-3 text-sm font-bold text-muted">Nhận xét</p>
          <div className="no-scrollbar mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
            {quickComments.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setComment((v) => (v.includes(c) ? v : v ? `${v} ${c}` : c))}
                className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold active:scale-95"
              >
                {c}
              </button>
            ))}
          </div>
          <Textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Nhận xét cho em…"
            className="mt-1.5 min-h-0"
          />

          <AnimatePresence>
            {(low || hint) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-amber">
                  <Lightbulb className="size-4" /> Gợi ý em cần ôn
                </p>
                <Input
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                  placeholder="vd: Ôn lại góc nội tiếp, bài 3 SGK trang 75"
                  className="mt-1.5"
                />
                <p className="mt-1 text-caption text-muted">
                  Bài dưới 5 điểm luôn kèm lời động viên cho em — cô thêm gợi ý ôn thì càng tốt.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-3">
            <VoiceRecorder
              value={voice.kind === "keep" && sub.voiceFileId ? fileUrl(sub.voiceFileId) : null}
              onChange={(b) => setVoice(b ? { kind: "new", blob: b } : { kind: "remove" })}
            />
          </div>
        </div>

        <Button size="lg" block className="mt-4" loading={pending} onClick={save} disabled={parsed === null}>
          {!pending && <CheckCircle2 className="size-5" />}
          {parsed === null ? "Chọn điểm để lưu" : `Lưu ${formatScore(parsed)} điểm & bài tiếp`}
        </Button>
      </aside>
    </div>
  );
}
