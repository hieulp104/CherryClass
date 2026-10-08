"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";

import { CherryIcon } from "@/components/brand/mascot";
import { cn, formatNumber } from "@/lib/utils";

// ─────────────── Số đếm chạy ───────────────

/** Số chạy từ 0 lên `value` khi xuất hiện trên màn hình. `format` mặc định có dấu chấm nghìn. */
export function CountUp({
  value,
  format = formatNumber,
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [animated, setAnimated] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(from.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setAnimated(Math.round(v)),
    });
    from.current = value;
    return () => controls.stop();
  }, [inView, value, duration, reduce]);

  // Giảm chuyển động → hiện thẳng số cuối, không chạy.
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {format(reduce ? value : animated)}
    </span>
  );
}

// ─────────────── Hàng cherry tiến độ chu kỳ ───────────────

/**
 * 7/10 quả cherry: quả đã học tô đỏ, quả chưa học viền nét đứt.
 * `pending` = số quả sẽ được thêm sau buổi này (nhấp nháy). `glow` khi đủ chu kỳ.
 */
export function CherryProgress({
  count,
  cycle,
  pending = 0,
  size = 16,
  glow = false,
  className,
}: {
  count: number;
  cycle: number;
  pending?: number;
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const filled = Math.min(count, cycle);
  const upcoming = Math.min(pending, cycle - filled);
  return (
    <div
      className={cn("flex flex-wrap items-center gap-[2px]", className)}
      aria-label={`${filled + upcoming}/${cycle} buổi trong chu kỳ`}
    >
      {Array.from({ length: cycle }, (_, i) => {
        const isFilled = i < filled;
        const isPending = !isFilled && i < filled + upcoming;
        return (
          <motion.span
            key={i}
            initial={false}
            animate={
              isPending && !reduce
                ? { scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }
                : { scale: 1, opacity: 1 }
            }
            transition={isPending ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}
            className="text-muted"
          >
            <CherryIcon filled={isFilled || isPending} size={size} glow={glow && (isFilled || isPending)} />
          </motion.span>
        );
      })}
    </div>
  );
}

/**
 * Bản nhẹ của CherryProgress cho danh sách dài (150 em): chấm tròn thay vì SVG,
 * nhẹ hơn ~20 lần về HTML.
 */
export function CherryDots({ count, cycle, className }: { count: number; cycle: number; className?: string }) {
  const filled = Math.min(count, cycle);
  return (
    <span className={cn("inline-flex items-center gap-[3px]", className)} aria-label={`${filled}/${cycle} buổi trong chu kỳ`}>
      {Array.from({ length: cycle }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < filled ? "bg-primary" : "bg-line-strong")} />
      ))}
    </span>
  );
}

// ─────────────── Pháo giấy hình cherry ───────────────

type Piece = { id: number; x: number; delay: number; rotate: number; drift: number; duration: number; kind: "cherry" | "dot"; color: string };

const COLORS = ["#E11D48", "#F59E0B", "#16A34A", "#FB7185", "#0EA5E9", "#A78BFA"];

/**
 * Bắn pháo giấy (cherry + chấm màu) rơi từ trên xuống. Đặt `fire` đổi giá trị (vd tăng số) để bắn lại.
 * Tự tắt khi bật "giảm chuyển động".
 */
export function CherryConfetti({ fire, count = 36 }: { fire: number; count?: number }) {
  const reduce = useReducedMotion();
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (!fire || reduce) return;
    // Sinh hạt trong callback khung hình kế tiếp (không setState đồng bộ trong effect).
    const raf = requestAnimationFrame(() =>
      setPieces(
        Array.from({ length: count }, (_, i) => ({
          id: fire * 1000 + i,
          x: Math.random() * 100,
          delay: Math.random() * 0.35,
          rotate: (Math.random() - 0.5) * 720,
          drift: (Math.random() - 0.5) * 30,
          duration: 2.2 + Math.random() * 0.6,
          kind: i % 3 === 0 ? "cherry" : "dot",
          color: COLORS[i % COLORS.length],
        })),
      ),
    );
    const t = setTimeout(() => setPieces([]), 2900);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [fire, count, reduce]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute top-0"
          style={{ left: `${p.x}%` }}
          initial={{ y: -40, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: `${p.drift}vw`, rotate: p.rotate, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.2, 0.6, 0.4, 1] }}
        >
          {p.kind === "cherry" ? (
            <CherryIcon size={22} />
          ) : (
            <span className="block h-2.5 w-1.5 rounded-sm" style={{ background: p.color }} />
          )}
        </motion.div>
      ))}
    </div>
  );
}

// ─────────────── Xuất hiện tầng lớp ───────────────

/** Bọc danh sách để các con trượt lên lần lượt. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 280, damping: 24 } },
};

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}
