"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { AlarmClock, Archive, CalendarClock, CheckCircle2, CircleDashed, Clock, FileText, Hourglass, PenLine, Pencil, XCircle, type LucideIcon } from "lucide-react";

import { StudentAvatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, Notice, type ChipTone } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { PageHeader, Segmented } from "@/components/ui/page";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { archiveAssignmentAction, updateAssignmentAction } from "@/modules/assignments/assignments.actions";
import { formatScore, type SubmissionState } from "@/modules/assignments/assignments.core";
import type { getAssignmentDetail } from "@/modules/assignments/assignments.service";
import { ProgressRing } from "@/modules/assignments/components/assignment-list";
import { fileUrl } from "@/lib/image-prep";
import { cn, formatDateTime } from "@/lib/utils";

type Loose<T> = T extends Date ? string : T extends (infer U)[] ? Loose<U>[] : T extends object ? { [K in keyof T]: Loose<T[K]> } : T;
type Detail = Loose<NonNullable<Awaited<ReturnType<typeof getAssignmentDetail>>>>;

export const SUBMISSION_STATE_META: Record<SubmissionState, { label: string; tone: ChipTone; icon: LucideIcon }> = {
  TODO: { label: "Chưa nộp", tone: "muted", icon: CircleDashed },
  DUE_SOON: { label: "Sắp hết hạn", tone: "amber", icon: AlarmClock },
  MISSING: { label: "Quá hạn chưa nộp", tone: "overdue", icon: XCircle },
  SUBMITTED: { label: "Đã nộp", tone: "sky", icon: Hourglass },
  LATE: { label: "Nộp muộn", tone: "amber", icon: Clock },
  GRADED: { label: "Đã chấm", tone: "leaf", icon: CheckCircle2 },
};

type Filter = "ALL" | "TODO" | "SUBMITTED" | "GRADED";

/** ISO → giá trị ô datetime-local theo giờ VN. */
function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return d.toISOString().slice(0, 16);
}

export function AssignmentDetailView({ detail }: { detail: Detail }) {
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const subs = detail.submissions;
  const submitted = subs.filter((s) => s.status !== "ASSIGNED");
  const toGrade = subs.filter((s) => s.status === "SUBMITTED").length;
  const late = subs.filter((s) => s.state === "LATE" || (s.state === "GRADED" && s.submittedAt && s.submittedAt > detail.dueAt)).length;
  const list = subs.filter((s) =>
    filter === "ALL" ? true : filter === "TODO" ? s.status === "ASSIGNED" : filter === "SUBMITTED" ? s.status === "SUBMITTED" : s.status === "GRADED",
  );

  return (
    <div>
      <PageHeader
        back="/bai-tap"
        title={detail.title}
        subtitle={`Giao cho ${detail.targets.map((t) => t.label).join(", ")}`}
        actions={
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Sửa / gia hạn
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr] [&>*]:min-w-0">
        <div className="space-y-4">
          <Card className="flex items-center gap-4 p-5">
            <ProgressRing value={submitted.length} total={subs.length} size={76} />
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <p className="flex items-center gap-1.5 font-semibold">
                <CalendarClock className="size-4 text-muted" /> Hạn {formatDateTime(detail.dueAt)}
              </p>
              <p className="text-muted">
                {submitted.length}/{subs.length} em đã nộp{late ? ` · ${late} nộp muộn` : ""}
              </p>
              <p className="text-muted">Thang {detail.maxScore} điểm</p>
            </div>
          </Card>
          {toGrade > 0 && (
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <ButtonLink href={`/bai-tap/${detail.id}/cham`} size="xl" block className="shadow-fab">
                <PenLine className="size-5" /> Chấm {toGrade} bài
              </ButtonLink>
            </motion.div>
          )}
          {submitted.length > 0 && toGrade === 0 && (
            <ButtonLink href={`/bai-tap/${detail.id}/cham`} variant="soft" block>
              Xem lại bài đã chấm
            </ButtonLink>
          )}
          {detail.description && (
            <Card className="whitespace-pre-line p-4 text-sm">{detail.description}</Card>
          )}
          {detail.files.length > 0 && (
            <Card className="p-4">
              <p className="mb-2 font-semibold">Đề bài</p>
              <div className="grid grid-cols-3 gap-2">
                {detail.files.map((f) => (
                  <a
                    key={f.fileId}
                    href={fileUrl(f.fileId)}
                    target="_blank"
                    rel="noreferrer"
                    className="relative aspect-[3/4] overflow-hidden rounded-[12px] border border-line bg-surface-subtle"
                  >
                    {f.file.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fileUrl(f.fileId)} alt={f.file.fileName} className="size-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex size-full flex-col items-center justify-center gap-1 p-2 text-center text-caption text-muted">
                        <FileText className="size-7 text-sky" />
                        <span className="line-clamp-2 break-all">{f.file.fileName}</span>
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div>
          <Segmented
            layoutId="sub-filter"
            value={filter}
            onChange={setFilter}
            className="mb-3"
            options={[
              { value: "ALL", label: "Tất cả", count: subs.length },
              { value: "TODO", label: "Chưa nộp", count: subs.length - submitted.length },
              { value: "SUBMITTED", label: "Chờ chấm", count: toGrade },
              { value: "GRADED", label: "Đã chấm" },
            ]}
          />
          <Card className="divide-y divide-line">
            {list.map((s, i) => {
              const meta = SUBMISSION_STATE_META[s.state];
              const body = (
                <>
                  <StudentAvatar name={s.student.fullName} hue={s.student.avatarHue} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.student.fullName}</p>
                    <p className="text-caption text-muted">
                      {s.student.classroom.name}
                      {s.submittedAt ? ` · nộp ${formatDateTime(s.submittedAt)} · ${s._count.pages} trang` : ""}
                    </p>
                  </div>
                  {s.status === "GRADED" && s.score !== null ? (
                    <span className="text-lg font-extrabold text-leaf tabular">{formatScore(s.score)}</span>
                  ) : (
                    <Chip tone={meta.tone} icon={meta.icon}>
                      {meta.label}
                    </Chip>
                  )}
                </>
              );
              return (
                <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i, 15) * 0.02 }}>
                  {s.status === "ASSIGNED" ? (
                    <div className="flex items-center gap-3 p-3.5">{body}</div>
                  ) : (
                    <Link href={`/bai-tap/${detail.id}/cham?bai=${s.id}`} className={cn("flex items-center gap-3 p-3.5 transition hover:bg-surface-subtle")}>
                      {body}
                    </Link>
                  )}
                </motion.div>
              );
            })}
            {list.length === 0 && <p className="p-6 text-center text-sm text-muted">Không có em nào ở mục này.</p>}
          </Card>
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)} title="Sửa bài / gia hạn" size="sm">
        <form
          action={(fd) =>
            start(async () => {
              const res = await updateAssignmentAction({ id: detail.id, title: fd.get("title"), description: fd.get("description"), dueAt: fd.get("dueAt") });
              if (!res.ok) return toast.error(res.message);
              toast.success("Đã lưu");
              setEditing(false);
              router.refresh();
            })
          }
          className="space-y-4 pb-2"
        >
          <Field label="Tên bài">
            <Input name="title" defaultValue={detail.title} required />
          </Field>
          <Field label="Lời dặn">
            <Textarea name="description" rows={3} defaultValue={detail.description ?? ""} />
          </Field>
          <Field label="Hạn nộp" hint="Gia hạn thì bài nộp trước hạn mới không còn bị tính muộn">
            <Input type="datetime-local" name="dueAt" defaultValue={toLocalInput(detail.dueAt)} required />
          </Field>
          <Button type="submit" size="lg" block loading={pending}>
            Lưu
          </Button>
          <Notice tone="muted" icon={Archive}>
            <button
              type="button"
              className="font-semibold text-overdue"
              onClick={() =>
                start(async () => {
                  const res = await archiveAssignmentAction(detail.id);
                  if (!res.ok) return toast.error(res.message);
                  toast.success("Đã cất bài vào lưu trữ");
                  router.push("/bai-tap");
                })
              }
            >
              Cất bài này vào lưu trữ
            </button>{" "}
            — học sinh sẽ không thấy nữa, điểm đã chấm vẫn giữ.
          </Notice>
        </form>
      </Sheet>
    </div>
  );
}
