"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Moon } from "lucide-react";

import { CherryIcon } from "@/components/brand/mascot";
import { Chip, EmptyState } from "@/components/ui/feedback";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import type { attendanceAgenda } from "@/modules/attendance/attendance.service";
import { fullDate, WEEKDAY_LONG, weekdayOf } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Item = Awaited<ReturnType<typeof attendanceAgenda>>[number];

export function AgendaView({ sessions }: { sessions: Item[] }) {
  const today = sessions.filter((s) => s.isToday);
  const missed = sessions.filter((s) => !s.isToday && s.status === "SCHEDULED");

  return (
    <div>
      <PageHeader title="Điểm danh" subtitle="Chọn buổi để vào chế độ đứng lớp" />

      {today.length === 0 ? (
        <EmptyState mood="sleepy" title="Hôm nay không có buổi nào" description="Lịch dạy được tạo từ các ca ở trang Lớp học ạ." />
      ) : (
        <ul className="space-y-3">
          {today.map((s, i) => (
            <SessionRow key={s.id} s={s} index={i} />
          ))}
        </ul>
      )}

      {missed.length > 0 && (
        <>
          <SectionTitle>Tuần qua chưa điểm danh</SectionTitle>
          <ul className="space-y-3">
            {missed.map((s, i) => (
              <SessionRow key={s.id} s={s} index={i} showDate />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SessionRow({ s, index, showDate }: { s: Item; index: number; showDate?: boolean }) {
  const done = s.status === "COMPLETED";
  const cancelled = s.status === "CANCELLED";
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 24, delay: index * 0.05 }}
    >
      <Link
        href={`/diem-danh/${s.id}`}
        className={cn(
          "group flex items-center gap-4 rounded-card border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop active:scale-[0.99]",
          done ? "border-leaf/30" : cancelled ? "border-line opacity-70" : "border-line",
        )}
      >
        <div
          className="grid size-14 shrink-0 place-items-center rounded-[18px] text-white shadow-md"
          style={{ background: cancelled ? "var(--c-muted)" : s.color }}
        >
          {done ? <CheckCircle2 className="size-7" /> : cancelled ? <Moon className="size-6" /> : <CherryIcon size={30} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{s.label}</p>
          <p className="text-sm text-muted">
            {showDate ? `${WEEKDAY_LONG[weekdayOf(s.date)]}, ${fullDate(s.date)} · ` : ""}
            {s.startTime}–{s.endTime}
            {s.room ? ` · ${s.room}` : ""}
          </p>
          <div className="mt-1.5">
            {done ? (
              <Chip tone="leaf" icon={CheckCircle2}>
                Đã chốt · {s.presentCount} có mặt
              </Chip>
            ) : cancelled ? (
              <Chip tone="muted">Nghỉ · {s.cancelReason}</Chip>
            ) : showDate ? (
              <Chip tone="amber" icon={AlertCircle}>
                Chưa điểm danh
              </Chip>
            ) : (
              <Chip tone="primary" icon={Clock}>
                {s.studentCount} em
              </Chip>
            )}
          </div>
        </div>
        <ChevronRight className="size-5 text-muted transition group-hover:translate-x-0.5" />
      </Link>
    </motion.li>
  );
}
