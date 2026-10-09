"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { CalendarDays, ChevronRight, GraduationCap, PartyPopper, Sprout, TrendingUp, Wallet } from "lucide-react";

import { CherryIcon, Mascot } from "@/components/brand/mascot";
import { Card } from "@/components/ui/card";
import { Chip, EmptyState } from "@/components/ui/feedback";
import { CountUp } from "@/components/ui/fx";
import { SectionTitle } from "@/components/ui/page";
import { formatScore, friendlyReminder } from "@/modules/assignments/assignments.core";
import { SUBMISSION_STATE_META } from "@/modules/assignments/components/assignment-detail";
import { portalHref, type FrameProps } from "@/modules/portal/components/portal-frame";
import type { PortalHome } from "@/modules/portal/portal.service";
import { fullDate, shortDate, weekdayOf, WEEKDAY_LONG } from "@/lib/dates";
import { cn, formatVnd, givenName, greetingFor } from "@/lib/utils";

export function PortalHomeView({
  data,
  frame,
  hour,
  fees,
}: {
  data: PortalHome;
  frame: FrameProps;
  hour: number;
  fees?: { balance: number; unpaid: number } | null;
}) {
  const isParent = frame.base === "/phu-huynh";
  const child = givenName(data.basics.fullName);
  const todo = data.assignments
    .filter((a) => a.state === "TODO" || a.state === "DUE_SOON" || a.state === "MISSING")
    .sort((a, b) => a.hoursLeft - b.hoursLeft);
  const newGrades = data.assignments.filter((a) => a.newGrade);
  const g = data.progress.garden;

  return (
    <div className="space-y-5">
      <motion.section initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <Mascot mood={newGrades.length ? "celebrate" : hour >= 22 || hour < 6 ? "sleepy" : "happy"} size={78} />
        <div className="min-w-0">
          <h1 className="text-h1 font-extrabold leading-tight">
            {greetingFor(hour)}, {isParent ? frame.displayName : child}! {isParent ? "" : "👋"}
          </h1>
          <p className="text-sm text-muted">
            {isParent ? `Đang xem: con ${child} · ${data.basics.classroom.name}` : `${data.basics.classroom.name}${data.basics.shift ? ` · ${data.basics.shift.name}` : ""}`}
          </p>
        </div>
      </motion.section>

      {/* Đếm ngược thi vào 10 */}
      {data.exam && !isParent && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="bg-sunset relative overflow-hidden rounded-card p-5 text-white shadow-pop">
          <div className="sparkle-overlay absolute inset-0" />
          <GraduationCap className="absolute -right-3 -top-3 size-28 text-white/15" />
          <p className="relative text-sm font-semibold text-white/85">Thi vào lớp 10 · {fullDate(data.exam.date)}</p>
          <p className="relative mt-1 flex items-baseline gap-2">
            <span className="text-[3.25rem] font-extrabold leading-none tabular">
              <CountUp value={data.exam.days} duration={1.4} />
            </span>
            <span className="text-lg font-bold">ngày nữa</span>
          </p>
          <p className="relative mt-2 text-white/90">{data.exam.cheer}</p>
        </motion.div>
      )}

      {/* Điểm mới */}
      {newGrades.map((a, i) => (
        <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
          <Link href={portalHref(frame, `/bai-tap/${a.assignmentId}`)} className="flex items-center gap-3 rounded-card border border-leaf/30 bg-leaf-soft p-4 shadow-card active:scale-[0.99]">
            <PartyPopper className="size-6 shrink-0 text-leaf" />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Cô vừa chấm bài “{a.title}”</p>
              <p className="text-sm text-muted">Bấm để xem nhận xét của cô</p>
            </div>
            <span className="text-2xl font-extrabold text-leaf tabular">{a.score !== null ? formatScore(a.score) : ""}</span>
          </Link>
        </motion.div>
      ))}

      {/* Việc cần làm */}
      <div>
        <SectionTitle className="mt-2">{isParent ? `Bài ${child} cần nộp` : "Việc của em"}</SectionTitle>
        {todo.length === 0 ? (
          <EmptyState mood="celebrate" title={isParent ? "Con đã nộp hết bài rồi ạ" : "Hết bài rồi, giỏi quá! 🎉"} description={isParent ? undefined : "Nghỉ ngơi một chút, có bài mới em sẽ báo ngay."} />
        ) : (
          <ul className="space-y-2.5">
            {todo.map((a, i) => {
              const meta = SUBMISSION_STATE_META[a.state];
              return (
                <motion.li key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link
                    href={portalHref(frame, `/bai-tap/${a.assignmentId}`)}
                    className={cn(
                      "block rounded-card border bg-surface p-4 shadow-card transition active:scale-[0.99]",
                      a.state === "DUE_SOON" ? "border-amber/50" : a.state === "MISSING" ? "border-overdue/40" : "border-line",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 truncate font-bold">{a.title}</p>
                      <Chip tone={meta.tone} icon={meta.icon}>
                        {meta.label}
                      </Chip>
                    </div>
                    <p className="mt-1 text-sm text-muted">{friendlyReminder(a.title, a.hoursLeft)}</p>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Vườn cherry + so với chính mình */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={portalHref(frame, isParent ? "/diem" : "/vuon")} className="block">
          <Card className="h-full p-4 transition hover:shadow-pop active:scale-[0.99]">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
              <Sprout className="size-4 text-leaf" /> Vườn cherry
            </p>
            <div className="mt-2 flex items-center gap-2">
              <CherryIcon size={30} />
              <span className="text-3xl font-extrabold tabular">
                <CountUp value={g.fruits} />
              </span>
              <span className="text-muted">quả</span>
            </div>
            {g.next && (
              <>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle">
                  <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${g.progress * 100}%` }} transition={{ duration: 1 }} />
                </div>
                <p className="mt-1 text-caption text-muted">
                  Còn {g.next.at - g.fruits} quả nữa mở huy hiệu {g.next.emoji} {g.next.name}
                </p>
              </>
            )}
          </Card>
        </Link>
        <Link href={portalHref(frame, "/diem")} className="block">
          <Card className="h-full p-4 transition hover:shadow-pop active:scale-[0.99]">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
              <TrendingUp className="size-4 text-sky" /> {isParent ? `Điểm của ${child}` : "So với chính em"}
            </p>
            <p className="mt-2 font-semibold leading-snug">{data.progress.comparison.text}</p>
          </Card>
        </Link>
      </div>

      {/* Học phí (phụ huynh) */}
      {isParent && fees && (
        <Link href={portalHref(frame, "/hoc-phi")} className="block">
          <Card className="flex items-center gap-3 p-4 transition hover:shadow-pop active:scale-[0.99]">
            <Wallet className={cn("size-6", fees.balance > 0 ? "text-amber" : "text-leaf")} />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{fees.balance > 0 ? `Học phí cần đóng: ${formatVnd(fees.balance)}` : "Học phí đã đóng đủ 💚"}</p>
              <p className="text-sm text-muted">{fees.unpaid > 0 ? `${fees.unpaid} phiếu chưa đóng xong` : "Xem lịch sử đóng tiền"}</p>
            </div>
            <ChevronRight className="size-5 text-muted" />
          </Card>
        </Link>
      )}

      {/* Lịch học */}
      <div>
        <SectionTitle className="mt-2">Lịch học</SectionTitle>
        <Card className="p-4">
          {data.basics.schedule.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-sm">
              <CalendarDays className="size-4 text-muted" />
              {data.basics.schedule.map((s) => (
                <Chip key={s} tone="muted">
                  {s}
                </Chip>
              ))}
            </p>
          )}
          <ul className="mt-3 space-y-1.5">
            {data.sessions.map((s) => (
              <li key={s.id} className={cn("flex items-center justify-between rounded-control px-3 py-2 text-sm", s.status === "CANCELLED" ? "bg-surface-subtle text-muted line-through" : "bg-primary-soft/50")}>
                <span className="font-semibold">
                  {WEEKDAY_LONG[weekdayOf(s.date)]}, {shortDate(s.date)}
                </span>
                <span className="tabular">{s.status === "CANCELLED" ? `Nghỉ: ${s.cancelReason}` : `${s.startTime}–${s.endTime}`}</span>
              </li>
            ))}
            {data.sessions.length === 0 && <li className="text-sm text-muted">Tuần này chưa có buổi nào.</li>}
          </ul>
        </Card>
      </div>

      {/* Chuyên cần */}
      <div>
        <SectionTitle className="mt-2">Chuyên cần</SectionTitle>
        <Card className="p-4">
          <p className="text-sm text-muted">
            {data.attendance.rate === null ? "Chưa có buổi nào." : `Đi học ${Math.round(data.attendance.rate * 100)}% trong ${data.attendance.recent.length} buổi gần nhất`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...data.attendance.recent].reverse().map((a) => (
              <span
                key={a.id}
                title={`${fullDate(a.date)}${a.note ? ` · ${a.note}` : ""}`}
                className={cn(
                  "grid size-7 place-items-center rounded-[9px] text-[10px] font-bold",
                  a.status === "PRESENT" ? "bg-leaf-soft text-leaf" : a.status === "EXCUSED" ? "bg-amber-soft text-amber" : "bg-overdue-soft text-overdue",
                )}
              >
                {a.date.slice(8, 10)}
              </span>
            ))}
          </div>
          <p className="mt-2 text-caption text-muted">Xanh: có mặt · Vàng: vắng có phép · Đỏ: vắng không phép</p>
        </Card>
      </div>
    </div>
  );
}
