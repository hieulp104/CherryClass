"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BookOpenCheck, CalendarCheck2, Clock, Users } from "lucide-react";

import { Mascot, type MascotMood } from "@/components/brand/mascot";
import { buttonVariants } from "@/components/ui/button";
import type { SessionCard } from "@/modules/classes/classes.service";
import { fullDate, minutesUntil, weekdayOf, WEEKDAY_LONG } from "@/lib/dates";
import { cn, formatVnd, greetingFor } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

export type Phase = "done" | "cancelled" | "live" | "upcoming" | "missed";

export function phaseOf(s: SessionCard, time: string): Phase {
  if (s.status === "COMPLETED") return "done";
  if (s.status === "CANCELLED") return "cancelled";
  if (s.startTime <= time && time < s.endTime) return "live";
  return time < s.startTime ? "upcoming" : "missed";
}

/** Ca nên mở ngay: đang học → sắp tới → đã qua mà chưa điểm danh. */
export function pickFocus(sessions: SessionCard[], time: string) {
  const order: Phase[] = ["live", "upcoming", "missed"];
  for (const p of order) {
    const s = sessions.find((x) => phaseOf(x, time) === p);
    if (s) return s;
  }
  return null;
}

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

function duration(mins: number) {
  if (mins < 60) return `${mins} phút`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

/**
 * Dải ngày: lời chào + ca cần mở ngay + thước thời gian cả ngày.
 * Đây là chỗ duy nhất trên trang được "phô" — phần còn lại giữ yên.
 */
export function DayHero({
  sessions,
  time,
  dateKey,
  teacherName,
  summary = null,
}: {
  sessions: SessionCard[];
  time: string;
  dateKey: string;
  teacherName: string;
  /** Tổng kết sau ca cuối trong ngày (null khi chưa xong). */
  summary?: DaySummary | null;
}) {
  const hour = Number(time.slice(0, 2));
  const focus = pickFocus(sessions, time);
  const active = sessions.filter((s) => s.status !== "CANCELLED");
  const allDone = active.length > 0 && active.every((s) => s.status === "COMPLETED");
  const mood: MascotMood = active.length === 0 || hour >= 22 ? "sleepy" : allDone ? "cheer" : "happy";

  return (
    <section className="bg-night relative isolate overflow-hidden rounded-sheet p-5 text-white shadow-pop ring-1 ring-inset ring-white/10 sm:p-7">
      <div className="night-grid absolute inset-0 -z-10" aria-hidden />

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4 sm:gap-5">
          <CalendarLeaf dateKey={dateKey} />
          <h1 className="min-w-0 text-[1.6rem] font-extrabold leading-tight tracking-tight text-balance sm:text-[2.25rem]">
            {greetingFor(hour)}, {teacherName}
          </h1>
        </div>
        <Mascot mood={mood} size={92} className="-my-2 -mr-1 hidden sm:block" />
      </div>

      <FocusPanel focus={focus} time={time} allDone={allDone} empty={active.length === 0} summary={summary} />

      {sessions.length > 0 && <DayRuler sessions={sessions} time={time} />}
    </section>
  );
}

/** Tờ lịch nhỏ như lịch xé trên bàn: thứ ở dải trên, số ngày to, tháng ở dưới. */
function CalendarLeaf({ dateKey }: { dateKey: string }) {
  const [y, m, d] = dateKey.split("-");
  return (
    <time
      dateTime={dateKey}
      aria-label={`${WEEKDAY_LONG[weekdayOf(dateKey)]}, ${fullDate(dateKey)}`}
      className="flex w-[3.75rem] shrink-0 flex-col overflow-hidden rounded-[14px] bg-white/[0.08] text-center ring-1 ring-inset ring-white/15 backdrop-blur-sm sm:w-[4.5rem]"
    >
      <span className="bg-white/15 py-0.5 text-[11px] font-bold sm:text-xs">{WEEKDAY_LONG[weekdayOf(dateKey)]}</span>
      <span className="pt-1 text-[1.75rem] font-extrabold leading-none tabular-nums sm:text-[2.1rem]">{Number(d)}</span>
      <span className="pb-1.5 pt-0.5 text-[11px] text-white/65 sm:text-xs" title={y}>
        Tháng {Number(m)}
      </span>
    </time>
  );
}

type DaySummary ={ sessions: number; students: number; received: number; needReminder: number };

function FocusPanel({
  focus,
  time,
  allDone,
  empty,
  summary,
}: {
  focus: SessionCard | null;
  time: string;
  allDone: boolean;
  empty: boolean;
  summary: DaySummary | null;
}) {
  if (!focus) {
    return (
      <div className="mt-5 rounded-card border border-white/10 bg-white/[0.06] p-4 text-sm text-white/80 backdrop-blur-sm">
        {empty
          ? "Hôm nay không có ca nào. Cô nghỉ ngơi nhé."
          : summary
            ? `Hôm nay cô dạy ${summary.sessions} ca, ${summary.students} em${summary.received > 0 ? ` · nhận ${formatVnd(summary.received)}` : ""}.${summary.needReminder > 0 ? ` Còn ${summary.needReminder} phiếu cần nhắc.` : " Học phí đâu vào đấy."}`
            : allDone
              ? "Đã điểm danh xong mọi ca hôm nay."
              : "Không còn ca nào cần mở."}
      </div>
    );
  }

  const phase = phaseOf(focus, time);
  const startIn = minutesUntil(focus.startTime, time);
  const endIn = minutesUntil(focus.endTime, time);
  const total = toMin(focus.endTime) - toMin(focus.startTime);
  const status =
    phase === "live"
      ? { icon: BookOpenCheck, label: "Đang học", note: `còn ${duration(endIn)}` }
      : phase === "upcoming"
        ? { icon: Clock, label: "Ca tiếp theo", note: `bắt đầu sau ${duration(startIn)}` }
        : { icon: CalendarCheck2, label: "Chưa điểm danh", note: `kết thúc lúc ${focus.endTime}` };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15, ease: EASE }}
      className="mt-5 flex flex-col gap-4 rounded-card border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm sm:flex-row sm:items-center sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-semibold text-white/80">
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span className="relative grid size-2 place-items-center">
              {phase === "live" && <span className="absolute size-2 rounded-full bg-white/70 motion-safe:animate-ping" />}
              <span className={cn("size-2 rounded-full", phase === "missed" ? "bg-amber" : "bg-white")} />
            </span>
            <status.icon className="size-4" aria-hidden />
            {status.label}
          </span>
          <span className="whitespace-nowrap font-normal text-white/60">{status.note}</span>
        </p>
        <p className="mt-1.5 truncate text-2xl font-extrabold tracking-tight sm:text-[1.75rem]">
          {focus.classroom.name} <span className="font-semibold text-white/60">{focus.shiftName}</span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/70">
          <span className="tabular-nums">
            {focus.startTime}–{focus.endTime}
          </span>
          {focus.room && <span>{focus.room}</span>}
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" aria-hidden /> {focus.studentCount} em
          </span>
        </p>
        {phase === "live" && total > 0 && (
          <span className="mt-3 block h-1 overflow-hidden rounded-full bg-white/15" aria-hidden>
            <motion.span
              className="block h-full origin-left rounded-full bg-white"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: Math.min(1, (total - endIn) / total) }}
              transition={{ duration: 1, delay: 0.5, ease: EASE }}
            />
          </span>
        )}
      </div>
      <Link
        href={`/diem-danh/${focus.id}`}
        className={cn(buttonVariants({ variant: "white", size: "lg" }), "rounded-full px-6 active:scale-[0.97]")}
      >
        Điểm danh {focus.classroom.name}
        <i className="size-[7px] rounded-full border-[1.3px] border-current" aria-hidden />
      </Link>
    </motion.div>
  );
}

// ─────────────── Thước thời gian cả ngày ───────────────

const BAR: Record<Phase, string> = {
  done: "bg-leaf text-white",
  live: "bg-white text-primary-deep shadow-[0_0_18px_rgb(255_255_255/0.45)]",
  missed: "bg-amber text-[#3b2a0d]",
  upcoming: "bg-white/15 text-white ring-1 ring-inset ring-white/25",
  cancelled: "bg-white/5 text-white/40 line-through ring-1 ring-inset ring-white/10",
};

const PHASE_LABEL: Record<Phase, string> = {
  done: "đã xong",
  live: "đang học",
  missed: "chưa điểm danh",
  upcoming: "sắp tới",
  cancelled: "đã hủy",
};

function DayRuler({ sessions, time }: { sessions: SessionCard[]; time: string }) {
  const startH = Math.min(7, ...sessions.map((s) => Math.floor(toMin(s.startTime) / 60)));
  const endH = Math.max(21, ...sessions.map((s) => Math.ceil(toMin(s.endTime) / 60)));
  const span = (endH - startH) * 60;
  const pos = (t: string) => ((toMin(t) - startH * 60) / span) * 100;

  // Ca trùng giờ (hai lớp cùng lúc) xếp xuống làn dưới.
  const laneEnds: number[] = [];
  const placed = [...sessions]
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map((s) => {
      let lane = laneEnds.findIndex((end) => end <= toMin(s.startTime));
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = toMin(s.endTime);
      return { s, lane };
    });
  const lanes = Math.max(1, laneEnds.length);

  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const now = pos(time);
  const showNow = now >= 0 && now <= 100;

  return (
    <div className="mt-5 md:mt-6">
      <div className="relative hidden md:block" style={{ height: lanes * 34 + 4 }}>
        {placed.map(({ s, lane }, i) => {
          const phase = phaseOf(s, time);
          const left = pos(s.startTime);
          const width = pos(s.endTime) - left;
          return (
            <motion.div
              key={s.id}
              className="absolute origin-left"
              style={{ left: `${left}%`, width: `${width}%`, top: lane * 34 }}
              initial={{ opacity: 0, scaleX: 0.3 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.55, delay: 0.35 + i * 0.07, ease: EASE }}
            >
              <Link
                href={`/diem-danh/${s.id}`}
                title={`${s.classroom.name} · ${s.shiftName} · ${s.startTime}–${s.endTime} · ${PHASE_LABEL[phase]}`}
                aria-label={`${s.classroom.name} ${s.shiftName}, ${s.startTime} đến ${s.endTime}, ${PHASE_LABEL[phase]}`}
                className={cn(
                  "flex h-[30px] items-center overflow-hidden rounded-full px-2.5 text-xs font-bold transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110",
                  BAR[phase],
                )}
              >
                <span className="hidden truncate md:inline">{s.classroom.name}</span>
              </Link>
            </motion.div>
          );
        })}

        {showNow && (
          <motion.div
            className="pointer-events-none absolute -bottom-2 -top-2 w-px bg-white"
            initial={{ left: "0%", opacity: 0 }}
            animate={{ left: `${now}%`, opacity: 1 }}
            transition={{ duration: 1.1, delay: 0.2, ease: EASE }}
            aria-hidden
          >
            <span className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_white]" />
          </motion.div>
        )}
      </div>

      {/* Vạch giờ */}
      <div className="relative mt-3 hidden h-5 border-t border-white/15 md:block" aria-hidden>
        {hours.map((h) => {
          const left = ((h - startH) / (endH - startH)) * 100;
          const major = (h - startH) % 2 === 0;
          return (
            <span key={h} className="absolute top-0 -translate-x-1/2" style={{ left: `${left}%` }}>
              <span className={cn("mx-auto block w-px bg-white/25", major ? "h-1.5" : "h-1")} />
              {major && (
                <span className={cn("mt-0.5 block text-[11px] tabular-nums text-white/50", (h - startH) % 4 !== 0 && "hidden sm:block")}>
                  {h}h
                </span>
              )}
            </span>
          );
        })}
      </div>

      {/* Điện thoại: vạch quá hẹp để ghi chữ → thêm hàng chip từng ca (giờ · lớp · trạng thái), vuốt ngang. */}
      <ul className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden" aria-label="Các ca hôm nay">
        {placed.map(({ s }) => {
          const phase = phaseOf(s, time);
          return (
            <li key={s.id} className="shrink-0">
              <Link
                href={`/diem-danh/${s.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] py-1.5 pl-2.5 pr-3 text-xs font-semibold text-white/90",
                  phase === "cancelled" && "line-through opacity-60",
                )}
              >
                <span className={cn("size-2 rounded-full", DOT[phase])} aria-hidden />
                <span className="tabular-nums">{s.startTime}</span>
                <span>{s.classroom.name}</span>
                <span className="font-normal text-white/60">{PHASE_LABEL[phase]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const DOT: Record<Phase, string> = {
  done: "bg-leaf",
  live: "bg-white",
  missed: "bg-amber",
  upcoming: "bg-white/40",
  cancelled: "bg-white/20",
};
