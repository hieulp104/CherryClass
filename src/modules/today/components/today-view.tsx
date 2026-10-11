"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gift,
  Hourglass,
  PenLine,
  Send,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { DayHero, phaseOf, type Phase } from "@/modules/today/components/day-hero";
import { Card, trackSpotlight } from "@/components/ui/card";
import { Chip, Notice, type ChipTone } from "@/components/ui/feedback";
import { CountUp } from "@/components/ui/fx";
import { IconTile } from "@/components/ui/page";
import type { SessionCard } from "@/modules/classes/classes.service";
import type { AttentionGroup, AttentionKind, TodayData } from "@/modules/today/today.service";
import { minutesUntil, vnNow } from "@/lib/dates";
import { cn, formatVnd, formatVndShort } from "@/lib/utils";

// ─────────────── Chuyển động: một nhịp, một đường cong, không nảy ───────────────

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

const ATTENTION_META: Record<AttentionKind, { icon: LucideIcon; tone: ChipTone }> = {
  CLAIMED: { icon: Hourglass, tone: "sky" },
  OVERDUE: { icon: AlertTriangle, tone: "overdue" },
  READY: { icon: Send, tone: "primary" },
  UNMARKED: { icon: CalendarCheck2, tone: "amber" },
  GRADE: { icon: PenLine, tone: "grape" },
  ABSENT: { icon: UserX, tone: "muted" },
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

function formatMoney(n: number) {
  return n >= 10_000_000 ? formatVndShort(n) : formatVnd(n);
}

export function TodayView({ data }: { data: TodayData }) {
  const time = useClock(data.now.time);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={container} initial="hidden" animate="show">
        {/* ─────────── Dải ngày: lời chào · ca cần mở · thước giờ ─────────── */}
        <motion.div variants={rise}>
          <DayHero
            sessions={data.sessions}
            time={time}
            dateKey={data.now.dateKey}
            teacherName={data.teacherName}
            quote={data.quote}
          />
        </motion.div>

        {/* ─────────── Số liệu nhanh: một bảng liền, chia ô bằng vạch mảnh ─────────── */}
        <motion.div
          variants={rise}
          className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card xl:grid-cols-4"
        >
          <IncomeCard stats={data.stats} />
          <StatCard
            href="/thu-tien"
            label="Còn cần thu"
            icon={Clock}
            tone="amber"
            value={data.stats.outstanding}
            money
            hint={data.stats.outstandingStudents ? `${data.stats.outstandingStudents} em chưa đóng đủ` : "Không em nào còn nợ"}
          />
          <StatCard
            href="/hoc-sinh"
            label="Học sinh đang học"
            icon={Users}
            tone="primary"
            value={data.stats.activeStudents}
            hint={`${data.stats.classroomCount} lớp`}
          />
          <SessionsStat sessions={data.sessions} time={time} />
        </motion.div>

        {/* ─────────── Lịch hôm nay · Việc cần chú ý ─────────── */}
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <ScheduleCard sessions={data.sessions} time={time} summary={data.summary} />
          <AttentionCard groups={data.attention} />
        </div>

        {/* ─────────── Phiếu thu · Sĩ số ─────────── */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <BillingCard billing={data.billing} />
          <ClassroomCard classrooms={data.classrooms} />
        </div>
      </motion.div>
    </MotionConfig>
  );
}

// ─────────────── Ô số liệu ───────────────

function StatCard({
  href,
  label,
  icon: Icon,
  tone,
  value,
  money,
  hint,
  valueClass,
  children,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: "primary" | "leaf" | "amber" | "sky";
  value: number;
  money?: boolean;
  hint: React.ReactNode;
  valueClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onPointerMove={trackSpotlight}
      className="spotlight group relative min-w-0 bg-surface p-4 transition-colors hover:bg-surface-raised sm:p-5"
    >
        <div className="flex items-center gap-2">
          <IconTile
            icon={<Icon className="size-4" />}
            tone={tone}
            className="size-7 shrink-0 rounded-[9px] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110"
          />
          <p className="min-w-0 text-sm font-medium leading-snug text-muted">{label}</p>
          <ChevronRight className="ml-auto size-4 shrink-0 text-muted opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
        </div>
        <p
          className={cn(
            "mt-3 whitespace-nowrap text-[clamp(1.2rem,5.4vw,1.75rem)] font-extrabold leading-none tracking-tight text-foreground",
            valueClass,
          )}
        >
          <CountUp value={value} format={money ? formatMoney : undefined} />
        </p>
        <div className="mt-2 text-xs text-muted">{hint}</div>
        {children}
    </Link>
  );
}

function IncomeCard({ stats }: { stats: TodayData["stats"] }) {
  const prevLabel = stats.trend.at(-2)?.label ?? "";
  const up = stats.income >= stats.incomePrev;
  const pct = stats.incomePrev > 0 ? Math.round(((stats.income - stats.incomePrev) / stats.incomePrev) * 100) : null;
  return (
    <StatCard
      href="/thong-ke"
      label="Thu tháng này"
      icon={Wallet}
      tone="leaf"
      value={stats.income}
      money
      valueClass="text-leaf"
      hint={
        <span className="flex items-center gap-1.5">
          {pct !== null ? (
            <>
              <span className={cn("inline-flex items-center gap-0.5 font-semibold", up ? "text-leaf" : "text-overdue")}>
                {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {up ? "+" : ""}
                {pct}%
              </span>
              <span>
                so với <span className="hidden sm:inline">cùng kỳ </span>
                {prevLabel}
              </span>
            </>
          ) : (
            <span>{stats.incomeCount} lượt đóng</span>
          )}
        </span>
      }
    >
      <Sparkline values={stats.trend.map((t) => t.amount)} className="mt-3 text-leaf" />
    </StatCard>
  );
}

/** Đường xu hướng 6 tháng — tự vẽ một lần khi hiện ra. */
function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const id = useId();
  if (values.length < 2 || values.every((v) => v === 0)) return <div className={cn("h-8", className)} />;
  const w = 120;
  const h = 32;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-8 w-full overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill={`url(#${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, delay: 0.3, ease: EASE }}
      />
      <motion.circle
        cx={lx}
        cy={ly}
        r={2.5}
        fill="currentColor"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 1.3 }}
      />
    </svg>
  );
}

function SessionsStat({ sessions, time }: { sessions: SessionCard[]; time: string }) {
  const live = sessions.filter((s) => s.status !== "CANCELLED");
  const done = live.filter((s) => s.status === "COMPLETED").length;
  const current = live.find((s) => phaseOf(s, time) === "live");
  const next = live.find((s) => phaseOf(s, time) === "upcoming");
  const hint = live.length === 0
    ? "Hôm nay không có lịch dạy"
    : current
      ? `Đang học: ${current.classroom.name}`
      : next
        ? `Ca tiếp: ${next.startTime} · ${next.classroom.name}`
        : done === live.length
          ? "Đã xong mọi ca"
          : "Còn ca chưa điểm danh";
  return (
    <StatCard href="/diem-danh" label="Ca hôm nay" icon={CalendarClock} tone="sky" value={live.length} hint={hint}>
      {live.length > 0 && (
        <div className="mt-3 flex gap-1" aria-label={`${done}/${live.length} ca đã xong`}>
          {live.map((s, i) => (
            <span key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
              <motion.span
                className="block h-full origin-left rounded-full bg-sky"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: s.status === "COMPLETED" ? 1 : 0 }}
                transition={{ duration: 0.6, delay: 0.5 + i * 0.08, ease: EASE }}
              />
            </span>
          ))}
        </div>
      )}
    </StatCard>
  );
}

// ─────────────── Lịch dạy hôm nay ───────────────

const PHASE_CHIP: Record<Phase, { label: string; tone: ChipTone; icon: LucideIcon }> = {
  done: { label: "Đã xong", tone: "leaf", icon: CheckCircle2 },
  cancelled: { label: "Đã hủy", tone: "muted", icon: Clock },
  live: { label: "Đang học", tone: "sky", icon: BookOpenCheck },
  upcoming: { label: "Sắp tới", tone: "muted", icon: Clock },
  missed: { label: "Chưa điểm danh", tone: "amber", icon: CalendarCheck2 },
};

function ScheduleCard({
  sessions,
  time,
  summary,
}: {
  sessions: SessionCard[];
  time: string;
  summary: TodayData["summary"];
}) {
  const students = sessions.filter((s) => s.status !== "CANCELLED").reduce((n, s) => n + s.studentCount, 0);
  return (
    <motion.div variants={rise} className="min-w-0">
      <Card className="h-full p-5">
        <h2 className="text-lg font-bold tracking-tight">Lịch dạy hôm nay</h2>
        <p className="mt-1 text-sm text-muted">
          {sessions.length ? `${sessions.length} ca · ${students} em` : "Không có ca nào"}
        </p>

        {sessions.length === 0 ? (
          <Card variant="subtle" className="mt-4 flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted">
            <IconTile icon={<CalendarClock className="size-5" />} tone="sky" className="size-10" />
            Một ngày để nghỉ ngơi — hoặc soạn bài thong thả.
          </Card>
        ) : (
          <ol className="relative mt-4">
            {/* Trục thời gian */}
            <span className="absolute bottom-3 left-[3.6rem] top-3 w-px bg-line" aria-hidden />
            {sessions.map((s, i) => (
              <ScheduleRow key={s.id} session={s} time={time} index={i} />
            ))}
          </ol>
        )}

        {summary && (
          <Notice tone="leaf" icon={ShieldCheck} className="mt-4">
            Đã dạy {summary.sessions} ca, {summary.students} em
            {summary.received > 0 ? ` · nhận ${formatVnd(summary.received)} hôm nay` : ""}.
            {summary.needReminder > 0 ? ` ${summary.needReminder} phiếu cần nhắc.` : " Học phí đâu vào đấy."}
          </Notice>
        )}
      </Card>
    </motion.div>
  );
}

function ScheduleRow({ session: s, time, index }: { session: SessionCard; time: string; index: number }) {
  const phase = phaseOf(s, time);
  const chip = PHASE_CHIP[phase];
  const total = -minutesUntil(s.endTime, s.startTime);
  const elapsed = -minutesUntil(s.startTime, time);
  const progress = phase === "live" && total > 0 ? Math.min(1, elapsed / total) : 0;
  const mins = minutesUntil(s.startTime, time);
  const countdown = phase === "upcoming" ? (mins >= 60 ? `còn ${Math.floor(mins / 60)}g${mins % 60 ? ` ${mins % 60}p` : ""}` : `còn ${mins} phút`) : null;

  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, delay: 0.25 + index * 0.06, ease: EASE }}
    >
      <Link
        href={`/diem-danh/${s.id}`}
        className={cn(
          "group relative flex items-center gap-3 rounded-control py-2.5 pr-2 transition-colors hover:bg-surface-subtle",
          phase === "cancelled" && "opacity-60",
        )}
      >
        <span className="w-11 shrink-0 text-right text-sm font-semibold tabular-nums">{s.startTime}</span>
        {/* Mốc trên trục */}
        <span className="relative z-10 grid size-3 shrink-0 place-items-center">
          {phase === "live" && <span className="absolute inset-0 rounded-full bg-sky/40 motion-safe:animate-ping" />}
          <span
            className={cn(
              "size-2.5 rounded-full ring-4 ring-surface",
              phase === "done" && "bg-leaf",
              phase === "live" && "bg-sky",
              phase === "missed" && "bg-amber",
              (phase === "upcoming" || phase === "cancelled") && "bg-line-strong",
            )}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-sm font-semibold", phase === "cancelled" && "line-through")}>
            {s.classroom.name} · {s.shiftName}
          </p>
          <p className="truncate text-xs text-muted">
            {s.startTime}–{s.endTime}
            {s.room ? ` · ${s.room}` : ""} · {s.studentCount} em
            {phase === "done" ? ` · có mặt ${s.presentCount}` : ""}
          </p>
          {/* Điện thoại: trạng thái xuống dòng để tên lớp không bị cắt. */}
          <Chip tone={chip.tone} icon={chip.icon} className="mt-1.5 sm:hidden">
            {countdown ?? chip.label}
          </Chip>
          {phase === "live" && (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-sky-soft">
              <motion.span
                className="block h-full origin-left rounded-full bg-sky"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progress }}
                transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
              />
            </span>
          )}
        </div>
        <Chip tone={chip.tone} icon={chip.icon} className="hidden shrink-0 sm:inline-flex">
          {countdown ?? chip.label}
        </Chip>
        <ChevronRight className="size-4 shrink-0 text-muted opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </Link>
    </motion.li>
  );
}

// ─────────────── Việc cần chú ý ───────────────

const ICON_TONE: Record<ChipTone, string> = {
  leaf: "bg-leaf-soft text-leaf",
  amber: "bg-amber-soft text-amber",
  overdue: "bg-overdue-soft text-overdue",
  primary: "bg-primary-soft text-primary",
  sky: "bg-sky-soft text-sky",
  grape: "bg-grape-soft text-grape",
  muted: "bg-surface-subtle text-muted",
};

/** Mỗi nhóm việc một dòng; bấm mới mở chi tiết — trang tổng quan chỉ cần nhìn lướt. */
function AttentionCard({ groups }: { groups: AttentionGroup[] }) {
  const [open, setOpen] = useState<AttentionKind | null>(null);
  return (
    <motion.div variants={rise} className="min-w-0">
      <Card className="h-full p-5">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          Việc cần chú ý
          {groups.length > 0 && <Chip tone="overdue">{groups.length}</Chip>}
        </h2>

        {groups.length === 0 ? (
          <Card variant="subtle" className="mt-4 flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted">
            <IconTile icon={<ShieldCheck className="size-5" />} tone="leaf" className="size-10" />
            Không có việc nào cần chú ý. Mọi thứ đang trong hạn.
          </Card>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {groups.map((g, gi) => (
              <AttentionRow
                key={g.kind}
                group={g}
                index={gi}
                open={open === g.kind}
                onToggle={() => setOpen(open === g.kind ? null : g.kind)}
              />
            ))}
          </ul>
        )}
      </Card>
    </motion.div>
  );
}

function AttentionRow({
  group: g,
  index,
  open,
  onToggle,
}: {
  group: AttentionGroup;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = ATTENTION_META[g.kind];
  const preview = g.items
    .slice(0, 2)
    .map((it) => it.label)
    .join(", ");
  const itemTotal = g.itemTotal ?? g.total;
  const more = itemTotal - Math.min(2, g.items.length);
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 + index * 0.05, ease: EASE }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-surface-subtle"
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-[10px]", ICON_TONE[meta.tone])}>
          <meta.icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{g.label}</span>
          {!open && (
            <span className="block truncate text-xs text-muted">
              {preview}
              {more > 0 ? ` và ${more} nữa` : ""}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums">{g.total}</span>
        <ChevronRight
          className={cn("size-4 shrink-0 text-muted transition-transform duration-300", open && "rotate-90")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <ul className="space-y-1 pb-3 pl-11">
              {g.items.map((it) => (
                <li key={it.key}>
                  <Link
                    href={it.href}
                    className="group flex items-center justify-between gap-3 rounded-control px-2 py-1.5 text-sm transition-colors hover:bg-surface-subtle"
                  >
                    <span className="min-w-0 truncate">
                      {it.label}
                      {it.sub && <span className="text-muted"> · {it.sub}</span>}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-muted tabular-nums">{it.badge}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={g.href}
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Mở {itemTotal > g.items.length ? `tất cả ${itemTotal}` : "danh sách"} <ArrowRight className="size-3.5" />
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

// ─────────────── Thanh phân bố (phiếu thu, sĩ số) ───────────────

function Bar({ value, max, index, color, className }: { value: number; max: number; index: number; color?: string; className?: string }) {
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-surface-subtle">
      <motion.span
        className={cn("block h-full origin-left rounded-full", className)}
        style={color ? { backgroundColor: color } : undefined}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: max > 0 ? value / max : 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, delay: 0.15 + index * 0.06, ease: EASE }}
      />
    </span>
  );
}

const BILLING_TONE: Record<TodayData["billing"][number]["tab"], string> = {
  READY: "bg-primary",
  CLAIMED: "bg-sky",
  WAITING: "bg-amber",
  OVERDUE: "bg-overdue",
};

function BillingCard({ billing }: { billing: TodayData["billing"] }) {
  const open = billing.reduce((n, b) => n + b.count, 0);
  const max = Math.max(1, ...billing.map((b) => b.count));
  return (
    <motion.div variants={rise} className="min-w-0">
      <Card className="h-full p-5">
        <h2 className="text-lg font-bold tracking-tight">Phiếu thu theo trạng thái</h2>
        <p className="mt-1 text-sm text-muted">{open} phiếu đang mở</p>
        {open === 0 ? (
          <Card variant="subtle" className="mt-4 flex h-32 items-center justify-center text-sm text-muted">
            Không có phiếu nào đang chờ
          </Card>
        ) : (
          <ol className="mt-4 space-y-3">
            {billing.map((b, i) => (
              <li key={b.tab}>
                <Link
                  href={`/thu-tien?tab=${b.tab}`}
                  className="group -mx-2 block rounded-control px-2 py-1 transition-colors hover:bg-surface-subtle"
                  aria-label={`${b.count} phiếu ${b.label}`}
                >
                  <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span>{b.label}</span>
                    <span className="font-semibold tabular-nums">
                      <CountUp value={b.count} duration={0.9} />
                    </span>
                  </span>
                  <Bar value={b.count} max={max} index={i} className={BILLING_TONE[b.tab]} />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </motion.div>
  );
}

function ClassroomCard({ classrooms }: { classrooms: TodayData["classrooms"] }) {
  const max = Math.max(1, ...classrooms.map((c) => c.count));
  const total = classrooms.reduce((n, c) => n + c.count, 0);
  return (
    <motion.div variants={rise} className="min-w-0">
      <Card className="h-full p-5">
        <h2 className="text-lg font-bold tracking-tight">Sĩ số theo lớp</h2>
        <p className="mt-1 text-sm text-muted">
          {total} em · {classrooms.length} lớp
        </p>
        {classrooms.length === 0 ? (
          <Card variant="subtle" className="mt-4 flex h-32 items-center justify-center text-sm text-muted">
            Chưa có lớp nào
          </Card>
        ) : (
          <ol className="mt-4 space-y-3">
            {classrooms.map((c, i) => (
              <li key={c.id}>
                <Link
                  href={`/hoc-sinh?lop=${c.id}`}
                  className="group -mx-2 block rounded-control px-2 py-1 transition-colors hover:bg-surface-subtle"
                  aria-label={`${c.count} học sinh lớp ${c.name}`}
                >
                  <span className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="truncate">{c.name}</span>
                      <span className="text-xs text-muted">khối {c.grade}</span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      <CountUp value={c.count} duration={0.9} />
                    </span>
                  </span>
                  <Bar value={c.count} max={max} index={i} color={c.color} />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </motion.div>
  );
}
