"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      className={cn("mb-5 flex flex-wrap items-end justify-between gap-3", className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        {back && (
          <Link
            href={back}
            aria-label="Quay lại"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-surface shadow-card transition active:scale-90"
          >
            <ChevronLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-h1 font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </motion.header>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 mt-7 flex flex-wrap items-center justify-between gap-x-3 gap-y-2", className)}>
      <h2 className="text-lg font-bold tracking-tight text-balance">{children}</h2>
      {action}
    </div>
  );
}

/** Thanh chọn kiểu viên thuốc, nền trượt theo mục đang chọn. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  layoutId = "segmented",
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  className?: string;
  layoutId?: string;
  /** Tên nhóm cho trình đọc màn hình, vd "Lọc theo lớp". */
  label?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-surface-subtle p-1", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={(e) => {
              onChange(o.value);
              // Thanh cuộn ngang trên điện thoại: kéo nút vừa chọn vào tầm nhìn.
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
            }}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active ? "text-primary-deep" : "text-muted hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-surface shadow-card"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative">{o.label}</span>
            {o.count !== undefined && o.count > 0 && (
              <span
                className={cn(
                  "relative min-w-5 rounded-full px-1.5 text-center text-[11px] font-bold leading-5",
                  active ? "bg-primary text-on-primary" : "bg-line text-muted",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Thẻ số liệu có icon tròn màu. */
export function IconTile({ icon, tone, className }: { icon: ReactNode; tone: "primary" | "leaf" | "amber" | "sky" | "grape" | "overdue"; className?: string }) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    leaf: "bg-leaf-soft text-leaf",
    amber: "bg-amber-soft text-amber",
    sky: "bg-sky-soft text-sky",
    grape: "bg-grape-soft text-grape",
    overdue: "bg-overdue-soft text-overdue",
  } as const;
  return <span className={cn("grid size-11 shrink-0 place-items-center rounded-[14px]", tones[tone], className)}>{icon}</span>;
}
