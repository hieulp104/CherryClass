"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { CalendarClock, ChevronRight, ClipboardCheck, PenLine, Plus } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Chip, EmptyState } from "@/components/ui/feedback";
import { PageHeader, Segmented } from "@/components/ui/page";
import type { AssignmentListItem } from "@/modules/assignments/assignments.service";
import { cn, formatDateTime } from "@/lib/utils";

type Tab = "GRADE" | "OPEN" | "DONE";

/** Vòng tròn tiến độ nộp bài. */
export function ProgressRing({ value, total, size = 54 }: { value: number; total: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const frac = total ? value / total : 0;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--c-line)" strokeWidth={6} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--c-primary)"
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - frac) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute text-[11px] font-extrabold tabular">
        {value}/{total}
      </span>
    </div>
  );
}

export function AssignmentList({ items }: { items: AssignmentListItem[] }) {
  const toGrade = items.filter((i) => i.toGrade > 0);
  const open = items.filter((i) => !i.overdue);
  const done = items.filter((i) => i.overdue && i.toGrade === 0);
  const [tab, setTab] = useState<Tab>(toGrade.length ? "GRADE" : "OPEN");
  const list = tab === "GRADE" ? toGrade : tab === "OPEN" ? open : done;

  return (
    <div>
      <PageHeader
        title="Bài tập"
        subtitle="Giao đề, xem ai đã nộp, chấm bài ngay trên điện thoại"
        actions={
          <ButtonLink href="/bai-tap/moi" size="sm">
            <Plus className="size-4" /> Giao bài mới
          </ButtonLink>
        }
      />
      <Segmented
        layoutId="assign-tab"
        value={tab}
        onChange={setTab}
        className="mb-4 w-fit"
        options={[
          { value: "GRADE", label: "Cần chấm", count: toGrade.reduce((s, i) => s + i.toGrade, 0) },
          { value: "OPEN", label: "Đang mở", count: open.length },
          { value: "DONE", label: "Đã xong" },
        ]}
      />
      {list.length === 0 ? (
        <EmptyState
          mood={tab === "GRADE" ? "celebrate" : "sleepy"}
          title={tab === "GRADE" ? "Chấm hết rồi! 🎉" : tab === "OPEN" ? "Chưa có bài nào đang mở" : "Chưa có bài nào xong"}
          description={tab === "OPEN" ? "Giao đề bằng ảnh chụp hoặc file PDF, chọn lớp và hạn nộp là xong." : undefined}
          action={
            tab === "OPEN" ? (
              <ButtonLink href="/bai-tap/moi">
                <Plus className="size-4" /> Giao bài mới
              </ButtonLink>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((a, i) => (
            <motion.li key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }}>
              <Link
                href={a.toGrade > 0 && tab === "GRADE" ? `/bai-tap/${a.id}/cham` : `/bai-tap/${a.id}`}
                className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop active:scale-[0.99]"
              >
                <ProgressRing value={a.submitted} total={a.total} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{a.title}</p>
                  <p className={cn("flex items-center gap-1.5 text-sm", a.overdue ? "text-muted" : "text-foreground")}>
                    <CalendarClock className="size-4 text-muted" /> Hạn {formatDateTime(a.dueAt)}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {a.targets.slice(0, 3).map((t) => (
                      <Chip key={t} tone="muted">
                        {t}
                      </Chip>
                    ))}
                    {a.toGrade > 0 && (
                      <Chip tone="primary" icon={PenLine}>
                        {a.toGrade} bài chờ chấm
                      </Chip>
                    )}
                    {a.toGrade === 0 && a.graded > 0 && (
                      <Chip tone="leaf" icon={ClipboardCheck}>
                        Đã chấm {a.graded}
                      </Chip>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-5 text-muted" />
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
