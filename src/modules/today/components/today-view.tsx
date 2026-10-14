"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { AnimatePresence, MotionConfig, motion, type Variants } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
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

import { DayHero } from "@/modules/today/components/day-hero";
import { Card, trackSpotlight } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/feedback";
import { CountUp } from "@/components/ui/fx";
import { IconTile } from "@/components/ui/page";
import type { AttentionGroup, AttentionKind, TodayData } from "@/modules/today/today.service";
import { vnNow } from "@/lib/dates";
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

/**
 * Trang Tổng quan trả lời MỘT câu: hôm nay cô cần làm gì. Ba khối, không lặp thông tin:
 *  1. Dải ngày — lời chào, ca cần mở, thước giờ các ca (thay cho thẻ lịch dạy riêng).
 *  2. Ba số — thu tháng này · còn cần thu (kèm thanh phiếu theo trạng thái) · học sinh.
 *  3. Việc cần chú ý — danh sách bấm vào là làm.
 * Lịch dạy chi tiết, sĩ số từng lớp, phiếu theo trạng thái xem ở Lớp học / Học sinh / Thu tiền.
 */
export function TodayView({ data }: { data: TodayData }) {
  const time = useClock(data.now.time);

  return (
    <MotionConfig reducedMotion="user">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={rise}>
          <DayHero
            sessions={data.sessions}
            time={time}
            dateKey={data.now.dateKey}
            teacherName={data.teacherName}
            summary={data.summary}
          />
        </motion.div>

        <motion.div
          variants={rise}
          className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card md:grid-cols-3"
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
          >
            <BillingMix billing={data.billing} />
          </StatCard>
          <StatCard
            href="/hoc-sinh"
            label="Học sinh đang học"
            icon={Users}
            tone="primary"
            value={data.stats.activeStudents}
            hint={`${data.stats.classroomCount} lớp`}
            className="hidden md:block"
          />
        </motion.div>

        <AttentionCard groups={data.attention} />
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
  className,
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
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onPointerMove={trackSpotlight}
      className={cn("spotlight group relative min-w-0 bg-surface p-4 transition-colors hover:bg-surface-raised sm:p-5", className)}
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
    <motion.div variants={rise}>
      <Card className="p-5">
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
          <ul className="mt-2 grid grid-cols-1 gap-x-10 lg:grid-cols-2 [&>li]:border-b [&>li]:border-line [&>li:last-child]:border-b-0 lg:[&>li:nth-last-child(2):nth-child(odd)]:border-b-0">
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
  const itemTotal = g.itemTotal ?? g.total;
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
        {/* Chỉ tên việc + số lượng; bấm mới mở danh sách các em. */}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{g.label}</span>
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


// ─────────────── Phiếu đang mở theo trạng thái — một thanh mảnh trong ô "Còn cần thu" ───────────────

const BILLING_TONE: Record<TodayData["billing"][number]["tab"], string> = {
  READY: "bg-primary",
  CLAIMED: "bg-sky",
  WAITING: "bg-amber",
  OVERDUE: "bg-overdue",
};

/** Thanh chia theo số phiếu ở từng trạng thái + chú thích (có chữ, không chỉ dựa vào màu). */
function BillingMix({ billing }: { billing: TodayData["billing"] }) {
  const parts = billing.filter((b) => b.count > 0);
  const total = parts.reduce((n, b) => n + b.count, 0);
  if (total === 0) return null;
  return (
    <div className="mt-3">
      <span className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((b, i) => (
          <motion.span
            key={b.tab}
            className={cn("h-full origin-left rounded-full", BILLING_TONE[b.tab])}
            style={{ flexGrow: b.count }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, delay: 0.4 + i * 0.08, ease: EASE }}
          />
        ))}
      </span>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted">
        {parts.map((b) => (
          <li key={b.tab} className="inline-flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", BILLING_TONE[b.tab])} aria-hidden />
            {b.label} <b className="font-semibold tabular-nums text-foreground">{b.count}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
