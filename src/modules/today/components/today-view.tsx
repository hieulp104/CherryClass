"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  ChevronRight,
  Clock,
  Gift,
  Hourglass,
  MessageCircleHeart,
  Send,
  Sparkles,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { CountUp } from "@/components/ui/fx";
import { EmptyState } from "@/components/ui/feedback";
import { IconTile, SectionTitle } from "@/components/ui/page";
import type { SessionCard } from "@/modules/classes/classes.service";
import type { TodayData, TodoItem } from "@/modules/today/today.service";
import { minutesUntil, vnNow } from "@/lib/dates";
import { cn, formatVnd, formatVndShort, greetingFor } from "@/lib/utils";

const TODO_META: Record<TodoItem["kind"], { icon: LucideIcon; tone: "overdue" | "primary" | "sky" | "amber" | "grape" | "leaf" }> = {
  CLAIMED: { icon: Hourglass, tone: "sky" },
  OVERDUE: { icon: AlertTriangle, tone: "overdue" },
  READY: { icon: Send, tone: "primary" },
  UNMARKED: { icon: CalendarCheck2, tone: "amber" },
  ABSENT: { icon: MessageCircleHeart, tone: "grape" },
  BIRTHDAY: { icon: Gift, tone: "leaf" },
};

/** Đồng hồ VN cập nhật mỗi 30 giây (đếm ngược tới giờ vào lớp). */
function useClock(initial: string) {
  const [time, setTime] = useState(initial);
  useEffect(() => {
    const t = setInterval(() => setTime(vnNow().time), 30_000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function pickFocus(sessions: SessionCard[], time: string) {
  const live = sessions.filter((s) => s.status !== "CANCELLED");
  const current = live.find((s) => s.status === "SCHEDULED" && s.startTime <= time && time < s.endTime);
  if (current) return { session: current, mode: "now" as const };
  const next = live.find((s) => s.status === "SCHEDULED" && s.startTime > time);
  if (next) return { session: next, mode: "next" as const };
  const missed = live.find((s) => s.status === "SCHEDULED");
  if (missed) return { session: missed, mode: "missed" as const };
  return null;
}

export function TodayView({ data }: { data: TodayData }) {
  const time = useClock(data.now.time);
  const hour = Number(time.slice(0, 2));
  const focus = pickFocus(data.sessions, time);
  const [hideSummary, setHideSummary] = useState(false);
  const mood = hour >= 22 || hour < 6 ? "sleepy" : data.summary ? "celebrate" : "happy";

  return (
    <div>
      {/* Lời chào */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 sm:gap-5"
      >
        <Mascot mood={mood} size={84} />
        <div className="min-w-0">
          <h1 className="text-h1 font-extrabold leading-tight tracking-tight sm:text-[2rem]">
            {greetingFor(hour)}, <span className="text-primary">{data.teacherName}</span> 🍒
          </h1>
          <p className="mt-1 text-sm text-muted sm:text-base">{data.quote}</p>
        </div>
      </motion.section>

      {/* Tổng kết cuối ngày */}
      <AnimatePresence>
        {data.summary && !hideSummary && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="mt-5 overflow-hidden"
          >
            <div className="bg-sunset relative overflow-hidden rounded-card p-5 text-white shadow-pop">
              <div className="sparkle-overlay absolute inset-0" />
              <button
                type="button"
                onClick={() => setHideSummary(true)}
                aria-label="Ẩn tổng kết"
                className="absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-white/20"
              >
                <X className="size-4" />
              </button>
              <p className="relative flex items-center gap-2 text-sm font-semibold text-white/85">
                <Sparkles className="size-4" /> Tổng kết hôm nay
              </p>
              <p className="relative mt-2 text-lg font-bold leading-snug sm:text-xl">
                Hôm nay cô dạy {data.summary.sessions} ca, {data.summary.students} em
                {data.summary.received > 0 ? `, nhận ${formatVnd(data.summary.received)}` : ""}.
                {data.summary.needReminder > 0
                  ? ` Có ${data.summary.needReminder} em cần nhắc học phí.`
                  : " Học phí đâu vào đấy hết rồi!"}{" "}
                Cô nghỉ ngơi nhé! 💗
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Buổi học sắp tới */}
      <section className="mt-5">
        {focus ? (
          <NextSessionCard session={focus.session} mode={focus.mode} time={time} />
        ) : data.sessions.length > 0 ? (
          <div className="bg-leaf-gradient relative overflow-hidden rounded-card p-5 text-white shadow-pop">
            <div className="sparkle-overlay absolute inset-0" />
            <p className="relative text-lg font-bold">Xong hết các ca hôm nay rồi! 🎉</p>
            <p className="relative text-white/85">Điểm danh đã chốt, học phí đã tự đếm. Cô giỏi quá!</p>
          </div>
        ) : (
          <div className="flex items-center gap-4 rounded-card border border-dashed border-line-strong bg-surface/70 p-5">
            <Mascot mood="sleepy" size={64} />
            <div>
              <p className="font-bold">Hôm nay không có lịch dạy</p>
              <p className="text-sm text-muted">Một ngày để nghỉ ngơi — hoặc soạn bài thong thả ạ.</p>
            </div>
          </div>
        )}
        {data.sessions.length > 1 && <SessionStrip sessions={data.sessions} time={time} />}
      </section>

      {/* Ba thẻ số liệu */}
      <section className="no-scrollbar -mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0">
        <StatTile
          index={0}
          href="/thong-ke"
          icon={<Wallet className="size-5" />}
          tone="leaf"
          label="Thu tháng này"
          value={data.stats.income}
          money
          detail={`${data.stats.incomeCount} lượt đóng`}
        />
        <StatTile
          index={1}
          href="/thu-tien"
          icon={<Clock className="size-5" />}
          tone="amber"
          label="Còn cần thu"
          value={data.stats.outstanding}
          money
          detail={`${data.stats.outstandingStudents} em`}
        />
        <StatTile
          index={2}
          href="/hoc-sinh"
          icon={<Users className="size-5" />}
          tone="primary"
          label="Học sinh đang học"
          value={data.stats.activeStudents}
          detail="em"
        />
      </section>

      {/* Việc cần làm */}
      <SectionTitle
        action={data.todos.length > 0 ? <span className="text-sm font-semibold text-muted">{data.todos.length} việc</span> : null}
      >
        Việc cần làm
      </SectionTitle>
      {data.todos.length === 0 ? (
        <EmptyState
          mood="sleepy"
          title="Hôm nay không có gì gấp"
          description="Cô thảnh thơi nhé! Có việc gì cần, em sẽ nhắc ngay ở đây ạ."
        />
      ) : (
        <ul className="space-y-2.5">
          {data.todos.map((t, i) => {
            const meta = TODO_META[t.kind];
            return (
              <motion.li
                key={t.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 26, delay: 0.1 + i * 0.05 }}
              >
                <Link
                  href={t.href}
                  className="group flex items-center gap-3 rounded-card border border-line bg-surface p-3.5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop active:scale-[0.99]"
                >
                  <IconTile icon={<meta.icon className="size-5" />} tone={meta.tone} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug">{t.title}</p>
                    <p className="truncate text-sm text-muted">{t.detail}</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted transition group-hover:translate-x-0.5" />
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NextSessionCard({ session, mode, time }: { session: SessionCard; mode: "now" | "next" | "missed"; time: string }) {
  const mins = minutesUntil(session.startTime, time);
  const countdown =
    mode === "now"
      ? "Đang trong giờ học"
      : mode === "missed"
        ? "Buổi này chưa điểm danh"
        : mins >= 60
          ? `còn ${Math.floor(mins / 60)} giờ ${mins % 60 ? `${mins % 60} phút` : ""}`
          : `còn ${mins} phút`;
  return (
    <Link href={`/diem-danh/${session.id}`} className="block">
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="bg-hero relative overflow-hidden rounded-card p-5 text-white shadow-pop sm:p-6"
      >
        <div className="sparkle-overlay absolute inset-0" />
        <motion.div
          className="absolute -right-4 -top-2 opacity-25"
          animate={{ rotate: [0, 8, 0], y: [0, -6, 0] }}
          transition={{ duration: 5, repeat: Infinity }}
        >
          <CherryIcon size={130} />
        </motion.div>
        <div className="relative">
          <p className="text-sm font-semibold text-white/80">
            {mode === "now" ? "Ca đang học" : mode === "missed" ? "Ca hôm nay" : "Ca sắp tới"}
          </p>
          <p className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {session.classroom.name} · {session.shiftName}
          </p>
          <p className="mt-1 text-white/85">
            {session.startTime}–{session.endTime}
            {session.room ? ` · ${session.room}` : ""} · {session.studentCount} em
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <motion.span
              key={countdown}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-full bg-white/20 px-3 py-1.5 text-sm font-bold backdrop-blur tabular"
            >
              ⏱ {countdown}
            </motion.span>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 font-bold text-[#9F1239] shadow-md">
              Vào điểm danh <ArrowRight className="size-4" />
            </span>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

function SessionStrip({ sessions, time }: { sessions: SessionCard[]; time: string }) {
  return (
    <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {sessions.map((s) => {
        const done = s.status === "COMPLETED";
        const cancelled = s.status === "CANCELLED";
        const live = !done && !cancelled && s.startTime <= time && time < s.endTime;
        return (
          <Link
            key={s.id}
            href={`/diem-danh/${s.id}`}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition active:scale-95",
              done && "border-leaf/30 bg-leaf-soft text-leaf",
              cancelled && "border-line bg-surface-subtle text-muted line-through",
              live && "border-primary bg-primary-soft text-primary-deep",
              !done && !cancelled && !live && "border-line bg-surface",
            )}
          >
            <span className="tabular">{s.startTime}</span>
            <span>{s.classroom.name}</span>
            {done && <span>✓</span>}
          </Link>
        );
      })}
    </div>
  );
}

function StatTile({
  index,
  href,
  icon,
  tone,
  label,
  value,
  money,
  detail,
}: {
  index: number;
  href: string;
  icon: React.ReactNode;
  tone: "leaf" | "amber" | "primary";
  label: string;
  value: number;
  money?: boolean;
  detail: string;
}) {
  const color = { leaf: "text-leaf", amber: "text-amber", primary: "text-primary" }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 22, delay: 0.15 + index * 0.07 }}
      className="w-[78%] shrink-0 snap-start sm:w-auto"
    >
      <Link
        href={href}
        className="block rounded-card border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <IconTile icon={icon} tone={tone} />
          <p className="text-sm font-semibold text-muted">{label}</p>
        </div>
        <p className={cn("mt-3 text-[2rem] font-extrabold leading-none tracking-tight", color)}>
          <CountUp value={value} format={money ? (n) => (n >= 10_000_000 ? formatVndShort(n) : formatVnd(n)) : undefined} />
        </p>
        <p className="mt-1.5 text-sm text-muted">{detail}</p>
      </Link>
    </motion.div>
  );
}
