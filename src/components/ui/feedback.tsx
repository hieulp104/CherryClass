"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, Send, Hourglass, type LucideIcon } from "lucide-react";

import { Mascot, type MascotMood } from "@/components/brand/mascot";
import type { InvoiceDisplayState } from "@/modules/billing/billing.core";
import { cn } from "@/lib/utils";

// ─────────────── Chip trạng thái: luôn có icon + chữ, không chỉ màu ───────────────

export type ChipTone = "leaf" | "amber" | "overdue" | "primary" | "sky" | "grape" | "muted";

const TONE: Record<ChipTone, string> = {
  leaf: "bg-leaf-soft text-leaf",
  amber: "bg-amber-soft text-amber",
  overdue: "bg-overdue-soft text-overdue ring-1 ring-overdue/25",
  primary: "bg-primary-soft text-primary-deep",
  sky: "bg-sky-soft text-sky",
  grape: "bg-grape-soft text-grape",
  muted: "bg-surface-subtle text-muted",
};

export function Chip({
  tone = "muted",
  icon: Icon,
  children,
  className,
}: {
  tone?: ChipTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3.5" strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/** Trạng thái hiển thị của phiếu thu — tính ở billing.core, đây chỉ là cách vẽ. */
export type { InvoiceDisplayState };

export const INVOICE_STATE_META: Record<InvoiceDisplayState, { label: string; tone: ChipTone; icon: LucideIcon }> = {
  READY: { label: "Cần gửi", tone: "primary", icon: Send },
  WAITING: { label: "Chờ đóng", tone: "amber", icon: Clock },
  OVERDUE: { label: "Quá hạn", tone: "overdue", icon: AlertTriangle },
  PARTIAL: { label: "Đóng thiếu", tone: "amber", icon: CircleDashed },
  CLAIMED: { label: "Chờ xác nhận", tone: "sky", icon: Hourglass },
  PAID: { label: "Đã thu", tone: "leaf", icon: CheckCircle2 },
  VOID: { label: "Đã hủy", tone: "muted", icon: Ban },
};

export function InvoiceStateChip({ state, className }: { state: InvoiceDisplayState; className?: string }) {
  const meta = INVOICE_STATE_META[state];
  return (
    <Chip tone={meta.tone} icon={meta.icon} className={className}>
      {meta.label}
    </Chip>
  );
}

// ─────────────── Skeleton theo hình nội dung ───────────────

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton rounded-control", className)} style={style} />;
}

export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-card border border-line bg-surface p-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-card border border-line bg-surface p-5">
          <Skeleton className="size-10 rounded-[12px]" />
          <Skeleton className="mt-4 h-8 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ─────────────── Màn trống có Bé Cherry ───────────────

export function EmptyState({
  mood = "sleepy",
  title,
  description,
  action,
  className,
}: {
  mood?: MascotMood;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      <Mascot mood={mood} size={104} />
      <p className="mt-2 text-lg font-bold">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </motion.div>
  );
}

/** Hộp thông báo nhỏ trong trang. */
export function Notice({
  tone = "amber",
  icon: Icon = AlertTriangle,
  children,
  className,
}: {
  tone?: ChipTone;
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-2.5 rounded-control px-3.5 py-3 text-sm", TONE[tone], className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-foreground/90">{children}</div>
    </div>
  );
}
