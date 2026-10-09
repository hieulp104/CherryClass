"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck2, ChevronRight, ClipboardCheck, Lock, Wallet } from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { Card } from "@/components/ui/card";
import { EmptyState, InvoiceStateChip } from "@/components/ui/feedback";
import { CountUp } from "@/components/ui/fx";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { BADGES, formatScore } from "@/modules/assignments/assignments.core";
import type { StudentProgress } from "@/modules/assignments/assignments.service";
import { portalHref, type FrameProps } from "@/modules/portal/components/portal-frame";
import type { PortalFees } from "@/modules/portal/portal.service";
import { shortDate } from "@/lib/dates";
import { cn, formatDate, formatVnd } from "@/lib/utils";

// ─────────────── Vườn cherry ───────────────

/** Vị trí quả trên tán cây — cố định (giả ngẫu nhiên theo chỉ số) để mở lại vẫn y nguyên. */
function fruitSpot(i: number) {
  const golden = 2.399963; // góc vàng — rải đều như hoa hướng dương
  const r = 22 + 70 * Math.sqrt((i + 0.5) / 60);
  const a = i * golden;
  return { x: 160 + r * Math.cos(a) * 1.25, y: 120 + r * Math.sin(a) * 0.82 };
}

export function GardenView({ progress, isParent, childName }: { progress: StudentProgress; isParent: boolean; childName: string }) {
  const reduce = useReducedMotion();
  const g = progress.garden;
  const shown = Math.min(g.fruits, 60);
  return (
    <div className="space-y-4">
      <PageHeader title={isParent ? `Vườn cherry của ${childName}` : "Vườn cherry của em"} subtitle="+1 quả mỗi bài nộp đúng hạn · +1 quả mỗi tuần đi học đủ buổi" />
      <Card className="bg-soft overflow-hidden p-4">
        <svg viewBox="0 0 320 260" className="w-full" role="img" aria-label={`Cây có ${g.fruits} quả cherry`}>
          <ellipse cx="160" cy="246" rx="120" ry="10" fill="var(--c-leaf)" opacity="0.18" />
          <path d="M150 250 Q148 200 154 170 L166 170 Q172 200 170 250 Z" fill="#92400E" />
          <path d="M158 190 Q130 170 118 150 M162 185 Q192 165 206 146" stroke="#92400E" strokeWidth="7" fill="none" strokeLinecap="round" />
          {[
            [160, 112, 92],
            [100, 132, 56],
            [222, 130, 58],
            [128, 82, 52],
            [196, 80, 54],
          ].map(([cx, cy, r], i) => (
            <motion.circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill={i % 2 ? "#22C55E" : "#16A34A"}
              initial={reduce ? false : { scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.95 }}
              transition={{ type: "spring", stiffness: 160, damping: 14, delay: i * 0.06 }}
              style={{ transformOrigin: `${cx}px ${cy}px` }}
            />
          ))}
          {Array.from({ length: shown }, (_, i) => {
            const p = fruitSpot(i);
            return (
              <motion.g
                key={i}
                initial={reduce ? false : { y: -30, opacity: 0, scale: 0.4 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.35 + i * 0.035 }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              >
                <path d={`M${p.x} ${p.y - 6} q2 -6 6 -8`} stroke="#14532D" strokeWidth="1.4" fill="none" />
                <circle cx={p.x} cy={p.y} r="6.5" fill="#E11D48" />
                <circle cx={p.x - 2} cy={p.y - 2} r="1.8" fill="#fff" opacity="0.6" />
              </motion.g>
            );
          })}
        </svg>
        <div className="mt-2 flex items-center justify-center gap-2">
          <CherryIcon size={30} />
          <span className="text-4xl font-extrabold tabular">
            <CountUp value={g.fruits} />
          </span>
          <span className="font-semibold text-muted">quả</span>
        </div>
        <p className="mt-1 text-center text-sm text-muted">
          {progress.onTime} bài nộp đúng hạn · {progress.fullWeeks} tuần đi học đầy đủ
        </p>
        {g.next && (
          <div className="mx-auto mt-3 max-w-sm">
            <div className="h-2.5 overflow-hidden rounded-full bg-surface">
              <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${g.progress * 100}%` }} transition={{ duration: 1.2, delay: 0.4 }} />
            </div>
            <p className="mt-1 text-center text-caption text-muted">
              Còn {g.next.at - g.fruits} quả để mở {g.next.emoji} {g.next.name}
            </p>
          </div>
        )}
      </Card>

      <SectionTitle>Huy hiệu</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BADGES.map((b, i) => {
          const on = g.fruits >= b.at;
          return (
            <motion.div
              key={b.at}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className={cn("rounded-card border p-4 text-center", on ? "border-primary/30 bg-surface shadow-card" : "border-dashed border-line-strong bg-surface/50")}
            >
              <motion.div
                className={cn("text-4xl", !on && "grayscale opacity-40")}
                animate={on && !reduce ? { rotate: [0, -8, 8, 0] } : {}}
                transition={{ duration: 1.2, delay: 0.6 + i * 0.1 }}
              >
                {b.emoji}
              </motion.div>
              <p className="mt-1 font-bold">{b.name}</p>
              <p className="text-caption text-muted">{on ? b.text : `Mở ở ${b.at} quả`}</p>
              {!on && <Lock className="mx-auto mt-1 size-3.5 text-muted" />}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────── Điểm ───────────────

export function ScoresView({ progress, isParent, childName, frame }: { progress: StudentProgress; isParent: boolean; childName: string; frame: FrameProps }) {
  const data = progress.scores.map((s) => ({ ...s, label: shortDate(s.date) }));
  return (
    <div className="space-y-4">
      <PageHeader title={isParent ? `Điểm của ${childName}` : "Điểm của em"} subtitle="Chỉ so với chính mình — không xếp hạng" />
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <Mascot mood={progress.comparison.tone === "up" ? "celebrate" : "happy"} size={64} />
          <p className="font-semibold leading-snug">{progress.comparison.text}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-control bg-surface-subtle p-3">
            <p className="text-caption text-muted">Tháng này</p>
            <p className="text-2xl font-extrabold text-primary tabular">{progress.thisAvg === null ? "—" : formatScore(progress.thisAvg)}</p>
          </div>
          <div className="rounded-control bg-surface-subtle p-3">
            <p className="text-caption text-muted">Tháng trước</p>
            <p className="text-2xl font-extrabold text-muted tabular">{progress.lastAvg === null ? "—" : formatScore(progress.lastAvg)}</p>
          </div>
        </div>
      </Card>

      {data.length === 0 ? (
        <EmptyState mood="sleepy" title="Chưa có bài nào được chấm" description="Nộp bài là cô chấm và điểm sẽ hiện ở đây." />
      ) : (
        <>
          <Card className="p-4">
            <p className="mb-2 text-sm font-bold text-muted">Điểm các bài (thang 10)</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 4" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} />
                  <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 11 }} />
                  <ReferenceLine y={5} stroke="var(--chart-grid)" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload as (typeof data)[number];
                      return (
                        <div className="rounded-control border border-line bg-surface-raised px-3 py-2 text-sm shadow-pop">
                          <p className="font-bold">{p.title}</p>
                          <p className="text-muted">
                            {p.label} · <b className="text-foreground">{formatScore(p.score)}</b>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Line type="monotone" dataKey="score" stroke="var(--chart-income)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--chart-income)", strokeWidth: 2, stroke: "var(--c-surface)" }} animationDuration={1000} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="divide-y divide-line">
            {[...data].reverse().map((s, i) => (
              <div key={`${s.date}-${i}`} className="flex items-center gap-3 p-3.5">
                <ClipboardCheck className="size-5 text-muted" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.title}</p>
                  <p className="text-caption text-muted">{s.label}</p>
                </div>
                <span className={cn("text-lg font-extrabold tabular", s.score < 5 ? "text-amber" : "text-leaf")}>{formatScore(s.score)}</span>
              </div>
            ))}
          </Card>
          <Link href={portalHref(frame, "/bai-tap")} className="flex items-center justify-center gap-1 text-sm font-semibold text-primary">
            Xem nhận xét từng bài <ChevronRight className="size-4" />
          </Link>
        </>
      )}
    </div>
  );
}

// ─────────────── Học phí (phụ huynh) ───────────────

export function FeesView({ fees, childName }: { fees: PortalFees; childName: string }) {
  return (
    <div className="space-y-4">
      <PageHeader title="Học phí" subtitle={`Của con ${childName}`} />
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
        <Card variant={fees.balance > 0 ? "hero" : "leaf"} className="relative overflow-hidden p-5">
          <div className="sparkle-overlay absolute inset-0" />
          <Wallet className="absolute -right-2 -top-2 size-24 text-white/15" />
          <p className="relative text-sm font-semibold text-white/85">{fees.balance > 0 ? "Cần đóng" : fees.balance < 0 ? "Đóng dư (trừ vào kỳ sau)" : "Đã đóng đủ"}</p>
          <p className="relative mt-1 text-[2.25rem] font-extrabold leading-none tabular">
            <CountUp value={Math.abs(fees.balance)} format={formatVnd} />
          </p>
        </Card>
      </motion.div>

      <SectionTitle>Phiếu học phí</SectionTitle>
      {fees.invoices.length === 0 ? (
        <EmptyState mood="happy" title="Chưa có phiếu nào" description="Đủ buổi học là cô sẽ gửi phiếu ạ." />
      ) : (
        <Card className="divide-y divide-line">
          {fees.invoices.map((inv) => (
            <a key={inv.id} href={`/p/${inv.token}`} className="flex items-center gap-3 p-4 transition hover:bg-surface-subtle">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {inv.code} · {inv.sessionCount} buổi
                </p>
                <p className="text-caption text-muted">{formatDate(inv.issuedAt)}</p>
              </div>
              <InvoiceStateChip state={inv.state} />
              <span className="w-24 text-right font-bold tabular">{formatVnd(inv.state === "PAID" ? inv.amount : inv.totalDue)}</span>
              <ChevronRight className="size-4 text-muted" />
            </a>
          ))}
        </Card>
      )}

      <SectionTitle>Đã đóng</SectionTitle>
      {fees.payments.length === 0 ? (
        <Card variant="outline" className="p-5 text-center text-sm text-muted">
          Chưa có khoản nào.
        </Card>
      ) : (
        <Card className="divide-y divide-line">
          {fees.payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-4">
              <CalendarCheck2 className="size-5 text-leaf" />
              <span className="min-w-0 flex-1 text-sm">
                {formatDate(p.paidAt)} · {p.method === "CASH" ? "Tiền mặt" : "Chuyển khoản"}
              </span>
              <span className="font-bold text-leaf tabular">{formatVnd(p.amount)}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
