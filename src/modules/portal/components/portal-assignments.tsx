"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { motion } from "motion/react";
import { CalendarClock, FileText, Heart, Lightbulb, MessageSquareHeart, Send, Volume2 } from "lucide-react";

import { Mascot } from "@/components/brand/mascot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, EmptyState, Notice } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/form";
import { CherryConfetti } from "@/components/ui/fx";
import { PageHeader, Segmented } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { UploadGrid } from "@/components/ui/upload-grid";
import { markGradeSeenAction, submitWorkAction } from "@/modules/assignments/assignments.actions";
import { formatScore, friendlyReminder, isLowScore, lowScoreCheer, type SubmissionState } from "@/modules/assignments/assignments.core";
import type { StudentAssignment, studentSubmission } from "@/modules/assignments/assignments.service";
import { SUBMISSION_STATE_META } from "@/modules/assignments/components/assignment-detail";
import { portalHref, type FrameProps } from "@/modules/portal/components/portal-frame";
import { fileUrl } from "@/lib/image-prep";
import { cn, formatDateTime, givenName } from "@/lib/utils";

type Tab = "TODO" | "DONE" | "GRADED";

export function PortalAssignmentList({ items, frame }: { items: StudentAssignment[]; frame: FrameProps }) {
  const todo = items.filter((i) => ["TODO", "DUE_SOON", "MISSING"].includes(i.state));
  const done = items.filter((i) => i.state === "SUBMITTED" || i.state === "LATE");
  const graded = items.filter((i) => i.state === "GRADED");
  const [tab, setTab] = useState<Tab>(todo.length ? "TODO" : graded.length ? "GRADED" : "DONE");
  const list = tab === "TODO" ? todo : tab === "DONE" ? done : graded;
  return (
    <div>
      <PageHeader title="Bài tập" />
      <Segmented
        layoutId="p-assign"
        value={tab}
        onChange={setTab}
        className="mb-4 w-fit"
        options={[
          { value: "TODO", label: "Cần làm", count: todo.length },
          { value: "DONE", label: "Chờ chấm", count: done.length },
          { value: "GRADED", label: "Có điểm", count: graded.filter((g) => g.newGrade).length },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState mood={tab === "TODO" ? "celebrate" : "sleepy"} title={tab === "TODO" ? "Không còn bài nào phải làm 🎉" : "Chưa có bài nào ở đây"} />
      ) : (
        <ul className="space-y-2.5">
          {list.map((a, i) => {
            const meta = SUBMISSION_STATE_META[a.state];
            return (
              <motion.li key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
                <Link href={portalHref(frame, `/bai-tap/${a.assignmentId}`)} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card active:scale-[0.99]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{a.title}</p>
                    <p className="flex items-center gap-1 text-caption text-muted">
                      <CalendarClock className="size-3.5" /> Hạn {formatDateTime(a.dueAt)}
                    </p>
                  </div>
                  {a.state === "GRADED" && a.score !== null ? (
                    <span className={cn("relative text-2xl font-extrabold tabular", isLowScore(a.score, a.maxScore) ? "text-amber" : "text-leaf")}>
                      {formatScore(a.score)}
                      {a.newGrade && <span className="absolute -right-2 -top-1 size-2.5 rounded-full bg-primary" />}
                    </span>
                  ) : (
                    <Chip tone={meta.tone} icon={meta.icon}>
                      {meta.label}
                    </Chip>
                  )}
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type Loose<T> = T extends Date ? string : T extends (infer U)[] ? Loose<U>[] : T extends object ? { [K in keyof T]: Loose<T[K]> } : T;
type Sub = Loose<NonNullable<Awaited<ReturnType<typeof studentSubmission>>>>;

export function PortalSubmission({ sub, frame }: { sub: Sub; frame: FrameProps }) {
  const router = useRouter();
  const toast = useToast();
  const isParent = frame.base === "/phu-huynh";
  const a = sub.assignment;
  const state = sub.state as SubmissionState;
  const graded = state === "GRADED";
  const [resubmit, setResubmit] = useState(false);
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [confetti, setConfetti] = useState(0);
  const [justSent, setJustSent] = useState<null | { late: boolean }>(null);
  const hoursLeft = (new Date(a.dueAt).getTime() - new Date().getTime()) / 3_600_000;
  const canSubmit = !graded && (sub.status === "ASSIGNED" || resubmit);
  const low = graded && sub.score !== null && isLowScore(sub.score, a.maxScore);

  // Mở bài có điểm mới → bỏ chấm đỏ.
  useEffect(() => {
    if (graded && !sub.seenAt) void markGradeSeenAction(sub.id).then(() => router.refresh());
  }, [graded, sub.seenAt, sub.id, router]);

  useEffect(() => {
    if (graded && !sub.seenAt && !low) {
      const t = setTimeout(() => setConfetti(1), 400);
      return () => clearTimeout(t);
    }
  }, [graded, sub.seenAt, low]);

  const submit = () =>
    start(async () => {
      const res = await submitWorkAction({ assignmentId: a.id, studentId: sub.studentId, pageFileIds: fileIds, note });
      if (!res.ok) return toast.error(res.message);
      setJustSent(res.data);
      setConfetti((n) => n + 1);
      setResubmit(false);
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <CherryConfetti fire={confetti} />
      <PageHeader back={portalHref(frame, "/bai-tap")} title={a.title} subtitle={`Hạn nộp ${formatDateTime(a.dueAt)} · thang ${a.maxScore}`} />

      {/* Điểm */}
      {graded && sub.score !== null && (
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 16 }}>
          <Card variant={low ? "default" : "leaf"} className={cn("relative overflow-hidden p-5", low && "border-amber/40 bg-amber-soft")}>
            {!low && <div className="sparkle-overlay absolute inset-0" />}
            <div className="relative flex items-center gap-4">
              <Mascot mood={low ? "cheer" : "celebrate"} size={86} />
              <div>
                <p className={cn("text-sm font-semibold", low ? "text-muted" : "text-white/85")}>{isParent ? `Điểm của ${givenName(sub.student.fullName)}` : "Điểm của em"}</p>
                <p className="text-[3rem] font-extrabold leading-none tabular">
                  {formatScore(sub.score)}
                  <span className={cn("text-xl", low ? "text-muted" : "text-white/70")}>/{a.maxScore}</span>
                </p>
              </div>
            </div>
            {low && (
              <p className="relative mt-3 flex items-start gap-2 font-semibold">
                <Heart className="mt-0.5 size-5 shrink-0 text-primary" /> {lowScoreCheer(sub.id)}
              </p>
            )}
          </Card>
        </motion.div>
      )}
      {graded && (sub.comment || sub.reviewHint || sub.voiceFileId) && (
        <Card className="space-y-3 p-4">
          {sub.comment && (
            <p className="flex items-start gap-2">
              <MessageSquareHeart className="mt-0.5 size-5 shrink-0 text-primary" />
              <span>
                <b>Cô nhận xét:</b> {sub.comment}
              </span>
            </p>
          )}
          {sub.voiceFileId && (
            <div className="flex flex-wrap items-center gap-2">
              <Volume2 className="size-5 text-sky" />
              <span className="text-sm font-semibold">Lời nhắn của cô:</span>
              <audio src={fileUrl(sub.voiceFileId)} controls className="h-9 max-w-full" />
            </div>
          )}
          {sub.reviewHint && (
            <Notice tone="amber" icon={Lightbulb}>
              <b>Cần ôn thêm:</b> {sub.reviewHint}
            </Notice>
          )}
        </Card>
      )}

      {justSent && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="flex items-center gap-3 border-leaf/30 bg-leaf-soft p-4">
            <Mascot mood="cheer" size={64} />
            <div>
              <p className="font-bold">Đã nộp bài! {justSent.late ? "" : "+1 quả cherry 🍒"}</p>
              <p className="text-sm text-muted">{justSent.late ? "Nộp muộn một chút nhưng cô vẫn chấm nha. Lần sau cố nộp sớm hơn nhé!" : "Đúng hạn luôn, giỏi quá. Cô sẽ chấm sớm!"}</p>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Đề bài */}
      <Card className="space-y-3 p-4">
        <p className="font-bold">Đề bài</p>
        {a.description && <p className="whitespace-pre-line text-sm">{a.description}</p>}
        {a.files.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {a.files.map((f) =>
              f.file.mimeType.startsWith("image/") ? (
                <a key={f.fileId} href={fileUrl(f.fileId)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-[14px] border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(f.fileId)} alt={f.file.fileName} className="w-full" loading="lazy" />
                </a>
              ) : (
                <a key={f.fileId} href={fileUrl(f.fileId)} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center gap-1 rounded-[14px] border border-line p-4 text-center text-sm font-semibold">
                  <FileText className="size-8 text-sky" /> {f.file.fileName}
                </a>
              ),
            )}
          </div>
        ) : (
          !a.description && <p className="text-sm text-muted">Cô giao đề trên lớp.</p>
        )}
      </Card>

      {/* Bài đã nộp */}
      {sub.pages.length > 0 && !resubmit && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold">{isParent ? "Bài con đã nộp" : "Bài em đã nộp"}</p>
            {sub.submittedAt && <span className="text-caption text-muted">{formatDateTime(sub.submittedAt)}</span>}
          </div>
          {state === "LATE" && <Chip tone="amber">Nộp muộn</Chip>}
          <div className="space-y-3">
            {sub.pages.map((p, i) =>
              p.file.mimeType.startsWith("image/") ? (
                <div key={p.id} className="relative overflow-hidden rounded-[14px] border border-line bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(p.fileId)} alt={`Trang ${i + 1}`} className="block w-full" loading="lazy" />
                  {p.annotationFileId && (
                    // Lớp khoanh/ghi chú của cô chồng lên đúng vị trí.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(p.annotationFileId)} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full" />
                  )}
                </div>
              ) : (
                <a key={p.id} href={fileUrl(p.fileId)} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-[14px] border border-line p-3 font-semibold">
                  <FileText className="size-5 text-sky" /> {p.file.fileName}
                </a>
              ),
            )}
          </div>
          {!graded && (
            <Button variant="outline" block onClick={() => setResubmit(true)}>
              Nộp lại bài khác
            </Button>
          )}
        </Card>
      )}

      {/* Nộp bài */}
      {canSubmit && (
        <Card className="space-y-3 p-4">
          <p className="font-bold">{isParent ? `Nộp bài giúp ${givenName(sub.student.fullName)}` : "Nộp bài"}</p>
          {sub.status === "ASSIGNED" && <p className="text-sm text-muted">{friendlyReminder(a.title, hoursLeft)}</p>}
          <p className="text-caption text-muted">Chụp từng trang theo thứ tự. Ảnh tự xoay đúng chiều và làm nét chữ như bản scan.</p>
          <UploadGrid
            purpose="submission"
            capture
            label="Chọn ảnh / PDF"
            onChange={(ids, b) => {
              setFileIds(ids);
              setBusy(b);
            }}
          />
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nhắn cô điều gì đó (không bắt buộc) — vd: Bài 4 em chưa làm được ạ" />
          <Button size="lg" block onClick={submit} loading={pending} disabled={busy || fileIds.length === 0}>
            {!pending && <Send className="size-5" />}
            {busy ? "Đang tải ảnh…" : fileIds.length ? `Nộp ${fileIds.length} trang` : "Chọn ảnh bài làm trước nhé"}
          </Button>
          {resubmit && (
            <Button variant="ghost" block onClick={() => setResubmit(false)}>
              Thôi, giữ bài cũ
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
