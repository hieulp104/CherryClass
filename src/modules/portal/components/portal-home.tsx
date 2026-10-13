"use client";

import Link from "next/link";
import { motion, type Variants } from "motion/react";
import { CalendarDays, CheckCircle2, ChevronRight, GraduationCap, Sprout, TrendingUp, Wallet } from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { Card, trackSpotlight } from "@/components/ui/card";
import { Chip, EmptyState, PingBadge } from "@/components/ui/feedback";
import { CountUp } from "@/components/ui/fx";
import { IconTile } from "@/components/ui/page";
import { formatScore, friendlyReminder, selfComparison } from "@/modules/assignments/assignments.core";
import { SUBMISSION_STATE_META } from "@/modules/assignments/components/assignment-detail";
import { portalHref, type FrameProps } from "@/modules/portal/components/portal-frame";
import type { PortalHome } from "@/modules/portal/portal.service";
import { fullDate, shortDate, weekdayOf, WEEKDAY_LONG } from "@/lib/dates";
import { cn, formatVnd, givenName, greetingFor } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};

export function PortalHomeView({
  data,
  frame,
  hour,
  fees,
}: {
  data: PortalHome;
  frame: FrameProps;
  hour: number;
  /** Khoản cần đóng (phụ huynh) — một phiếu, số tiền đã gồm nợ cũ. */
  fees?: { toPay: { id: string; amount: number; waitingConfirm: boolean } | null } | null;
}) {
  const isParent = frame.base === "/phu-huynh";
  const child = givenName(data.basics.fullName);
  const todo = data.assignments
    .filter((a) => a.state === "TODO" || a.state === "DUE_SOON" || a.state === "MISSING")
    .sort((a, b) => a.hoursLeft - b.hoursLeft);
  const newGrades = data.assignments.filter((a) => a.newGrade);
  const next = data.sessions.find((s) => s.status !== "CANCELLED");
  const mood = newGrades.length ? "celebrate" : hour >= 22 || hour < 6 ? "sleepy" : "happy";
  const classLine = `${data.basics.classroom.name}${data.basics.shift ? ` · ${data.basics.shift.name}` : ""}`;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
      {/* ─────────── Dải đầu trang: lời chào · buổi học tới · đếm ngược / học phí ─────────── */}
      <motion.section
        variants={rise}
        className="bg-night relative isolate overflow-hidden rounded-sheet p-5 text-white shadow-pop ring-1 ring-inset ring-white/10 sm:p-7"
      >
        <div className="night-grid absolute inset-0 -z-10" aria-hidden />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-white/60">{isParent ? `Con ${child} · ${classLine}` : classLine}</p>
            <h1 className="mt-1 text-[1.75rem] font-extrabold leading-tight tracking-tight text-balance sm:text-[2.25rem]">
              {greetingFor(hour)}, {isParent ? frame.displayName : child}
            </h1>
          </div>
          <Mascot mood={mood} size={88} className="-mr-1 -mt-2 hidden sm:block" />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <GlassPanel icon={CalendarDays} label="Buổi học tới">
            {next ? (
              <>
                <p className="text-2xl font-extrabold tracking-tight">
                  {WEEKDAY_LONG[weekdayOf(next.date)]}, {shortDate(next.date)}
                </p>
                <p className="mt-0.5 text-sm text-white/70 tabular">
                  {next.startTime}–{next.endTime}
                </p>
              </>
            ) : (
              <p className="text-lg font-bold">Tuần này chưa có buổi nào</p>
            )}
          </GlassPanel>

          {isParent ? (
            <Link
              href={portalHref(frame, fees?.toPay && !fees.toPay.waitingConfirm ? `/hoc-phi/${fees.toPay.id}` : "/hoc-phi")}
              className="group block rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <GlassPanel icon={Wallet} label="Học phí" interactive alert={frame.children.find((c) => c.id === frame.studentId)?.feesDue ?? 0}>
                {fees?.toPay ? (
                  <>
                    <p className="text-2xl font-extrabold tracking-tight tabular">{formatVnd(fees.toPay.amount)}</p>
                    <p className="mt-0.5 text-sm text-white/70">{fees.toPay.waitingConfirm ? "Anh chị đã báo chuyển · chờ cô xác nhận" : "Cần đóng · bấm để xem mã QR"}</p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-extrabold tracking-tight">Đã đóng đủ</p>
                    <p className="mt-0.5 text-sm text-white/70">Xem lịch sử đóng tiền</p>
                  </>
                )}
              </GlassPanel>
            </Link>
          ) : data.exam ? (
            <GlassPanel icon={GraduationCap} label={`Thi vào lớp 10 · ${fullDate(data.exam.date)}`}>
              <p className="flex items-baseline gap-2">
                <span className="text-[2.25rem] font-extrabold leading-none tabular">
                  <CountUp value={data.exam.days} duration={1.4} />
                </span>
                <span className="font-bold text-white/80">ngày nữa</span>
              </p>
              <p className="mt-1 text-sm text-white/70">{data.exam.cheer}</p>
            </GlassPanel>
          ) : (
            <GlassPanel icon={Sprout} label="Vườn cherry">
              <p className="text-2xl font-extrabold tracking-tight tabular">{data.progress.garden.fruits} quả</p>
            </GlassPanel>
          )}
        </div>
      </motion.section>

      {/* ─────────── Ba số nhanh: một bảng liền ─────────── */}
      <motion.div
        variants={rise}
        className="grid grid-cols-1 gap-px overflow-hidden rounded-card border border-line bg-line shadow-card sm:grid-cols-3"
      >
        <GardenCell data={data} href={portalHref(frame, isParent ? "/diem" : "/vuon")} />
        <AttendanceCell data={data} />
        <StatCell href={portalHref(frame, "/diem")} icon={TrendingUp} tone="sky" label={isParent ? `Điểm của ${child}` : "So với chính em"}>
          <p className="mt-3 font-semibold leading-snug">
            {isParent ? selfComparison(data.progress.thisAvg, data.progress.lastAvg, child).text : data.progress.comparison.text}
          </p>
        </StatCell>
      </motion.div>

      {/* ─────────── Bài vở · Lịch tuần ─────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-4">
          {newGrades.length > 0 && (
            <motion.div variants={rise}>
              <Card className="p-5">
                <h2 className="text-lg font-bold tracking-tight">Cô vừa chấm</h2>
                <ul className="mt-3 divide-y divide-line">
                  {newGrades.map((a) => (
                    <li key={a.id}>
                      <Link
                        href={portalHref(frame, `/bai-tap/${a.assignmentId}`)}
                        className="group -mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition-colors hover:bg-surface-subtle"
                      >
                        <IconTile icon={<CheckCircle2 className="size-4" />} tone="leaf" className="size-9 rounded-[11px]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{a.title}</span>
                          <span className="block text-sm text-muted">Xem nhận xét của cô</span>
                        </span>
                        {a.score !== null && <span className="text-2xl font-extrabold text-leaf tabular">{formatScore(a.score)}</span>}
                        <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          )}

          <motion.div variants={rise}>
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
                {isParent ? `Bài ${child} cần nộp` : "Việc của em"}
                {todo.length > 0 && <Chip tone="primary">{todo.length}</Chip>}
              </h2>
              {todo.length === 0 ? (
                <EmptyState
                  mood="celebrate"
                  title={isParent ? "Con đã nộp hết bài rồi ạ" : "Hết bài rồi, giỏi quá!"}
                  description={isParent ? undefined : "Nghỉ ngơi một chút, có bài mới em sẽ báo ngay."}
                />
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {todo.map((a) => {
                    const meta = SUBMISSION_STATE_META[a.state];
                    return (
                      <li key={a.id}>
                        <Link
                          href={portalHref(frame, `/bai-tap/${a.assignmentId}`)}
                          className="group -mx-2 block rounded-control px-2 py-3 transition-colors hover:bg-surface-subtle"
                        >
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate font-semibold">{a.title}</span>
                            <Chip tone={meta.tone} icon={meta.icon}>
                              {meta.label}
                            </Chip>
                          </span>
                          <span className="mt-1 block text-sm text-muted">{friendlyReminder(a.title, a.hoursLeft)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </motion.div>
        </div>

        <motion.div variants={rise} className="min-w-0">
          <Card className="h-full p-5">
            <h2 className="text-lg font-bold tracking-tight">Lịch tuần này</h2>
            {data.basics.schedule.length > 0 && <p className="mt-1 text-sm text-muted">Học {data.basics.schedule.join(" và ")}</p>}
            <ol className="mt-4 space-y-2">
              {data.sessions.map((s) => {
                const cancelled = s.status === "CANCELLED";
                const isNext = s.id === next?.id;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 rounded-control border px-3 py-2.5 text-sm",
                      cancelled ? "border-transparent bg-surface-subtle text-muted" : isNext ? "border-primary/30 bg-primary-soft/60" : "border-line",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-10 shrink-0 place-items-center rounded-[12px] text-center leading-none",
                        isNext ? "bg-primary text-on-primary" : "bg-surface-subtle",
                      )}
                    >
                      <span className="text-[15px] font-extrabold tabular">{s.date.slice(8, 10)}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block font-semibold", cancelled && "line-through")}>{WEEKDAY_LONG[weekdayOf(s.date)]}</span>
                      <span className="block text-caption text-muted tabular">
                        {cancelled ? `Nghỉ: ${s.cancelReason}` : `${s.startTime}–${s.endTime}`}
                      </span>
                    </span>
                    {isNext && <Chip tone="primary">Buổi tới</Chip>}
                  </li>
                );
              })}
              {data.sessions.length === 0 && <li className="text-sm text-muted">Tuần này chưa có buổi nào.</li>}
            </ol>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

/** Ô kính mờ trong dải đầu trang. */
function GlassPanel({
  icon: Icon,
  label,
  interactive,
  alert = 0,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  interactive?: boolean;
  /** Số phiếu cần đóng — chấm đỏ cạnh nhãn. */
  alert?: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "h-full rounded-card border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm",
        interactive && "transition-colors group-hover:bg-white/[0.11]",
      )}
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/70">
        <Icon className="size-4" />
        {label}
        <PingBadge count={alert} label={`${alert} phiếu cần đóng`} />
        {interactive && <ChevronRight className="ml-auto size-4 transition-transform group-hover:translate-x-0.5" />}
      </p>
      {children}
    </div>
  );
}

function StatCell({
  href,
  icon: Icon,
  tone,
  label,
  children,
}: {
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "leaf" | "sky" | "primary";
  label: string;
  children: React.ReactNode;
}) {
  const head = (
    <span className="flex items-center gap-2">
      <IconTile icon={<Icon className="size-4" />} tone={tone} className="size-7 rounded-[9px] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
      <span className="text-sm font-medium text-muted">{label}</span>
      {href && <ChevronRight className="ml-auto size-4 text-muted opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100" />}
    </span>
  );
  const cls = "group relative block min-w-0 bg-surface p-4 sm:p-5";
  return href ? (
    <Link href={href} onPointerMove={trackSpotlight} className={cn(cls, "spotlight transition-colors hover:bg-surface-raised")}>
      {head}
      {children}
    </Link>
  ) : (
    <div className={cls}>
      {head}
      {children}
    </div>
  );
}

function GardenCell({ data, href }: { data: PortalHome; href: string }) {
  const g = data.progress.garden;
  return (
    <StatCell href={href} icon={Sprout} tone="leaf" label="Vườn cherry">
      <p className="mt-3 flex items-center gap-2">
        <CherryIcon size={26} />
        <span className="text-3xl font-extrabold leading-none tabular">
          <CountUp value={g.fruits} />
        </span>
        <span className="text-muted">quả</span>
      </p>
      {g.next && (
        <>
          <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-subtle">
            <motion.span
              className="block h-full origin-left rounded-full bg-primary"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: g.progress }}
              transition={{ duration: 1, delay: 0.4, ease: EASE }}
            />
          </span>
          <span className="mt-1.5 block text-caption text-muted">
            Còn {g.next.at - g.fruits} quả nữa mở huy hiệu “{g.next.name}”
          </span>
        </>
      )}
    </StatCell>
  );
}

function AttendanceCell({ data }: { data: PortalHome }) {
  const { rate, recent } = data.attendance;
  const dots = [...recent].reverse().slice(-12);
  return (
    <StatCell icon={CheckCircle2} tone="primary" label="Chuyên cần">
      <p className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-extrabold leading-none tabular">{rate === null ? "—" : `${Math.round(rate * 100)}%`}</span>
        {rate !== null && <span className="text-sm text-muted">{recent.length} buổi gần nhất</span>}
      </p>
      {dots.length > 0 && (
        <span className="mt-3 flex gap-1" aria-label="Các buổi gần đây">
          {dots.map((a, i) => {
            const label = a.status === "PRESENT" ? "có mặt" : a.status === "EXCUSED" ? "vắng có phép" : "vắng không phép";
            return (
              <motion.span
                key={a.id}
                title={`${fullDate(a.date)} · ${label}${a.note ? ` · ${a.note}` : ""}`}
                aria-label={`${fullDate(a.date)}: ${label}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.03 }}
                className={cn(
                  "h-5 flex-1 rounded-[5px]",
                  a.status === "PRESENT" ? "bg-leaf/80" : a.status === "EXCUSED" ? "bg-amber" : "bg-overdue",
                )}
              />
            );
          })}
        </span>
      )}
      {dots.some((d) => d.status !== "PRESENT") && (
        <span className="mt-1.5 block text-caption text-muted">Xanh: có mặt · Vàng: vắng có phép · Đỏ: vắng không phép</span>
      )}
    </StatCell>
  );
}
