"use client";

import Link, { type LinkProps } from "next/link";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const cardVariants = cva("min-w-0 rounded-card", {
  variants: {
    variant: {
      default: "border border-line bg-surface shadow-card",
      subtle: "bg-surface-subtle",
      hero: "bg-hero text-white shadow-pop",
      leaf: "bg-leaf-gradient text-white shadow-pop",
      sunset: "bg-sunset text-white shadow-pop",
      outline: "border border-dashed border-line-strong",
    },
  },
  defaultVariants: { variant: "default" },
});

export type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

export function Card({ className, variant, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant }), className)} {...props} />;
}

/** Thẻ xuất hiện có hiệu ứng trượt lên — dùng cho danh sách, `index` để xếp tầng. */
export function MotionCard({
  className,
  variant,
  index = 0,
  ...props
}: HTMLMotionProps<"div"> & VariantProps<typeof cardVariants> & { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 24, delay: Math.min(index, 10) * 0.045 }}
      className={cn(cardVariants({ variant }), className)}
      {...props}
    />
  );
}

/** Gắn vị trí con trỏ vào --mx/--my để lớp `.spotlight` vẽ quầng sáng theo chuột. */
export function trackSpotlight(e: React.PointerEvent<HTMLElement>) {
  if (e.pointerType !== "mouse") return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--mx", `${e.clientX - r.left}px`);
  el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/** Thẻ là link: nhấc nhẹ khi rê chuột, quầng sáng theo con trỏ, lún khi nhấn. */
export function CardLink({
  className,
  variant,
  onPointerMove,
  ...props
}: LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  VariantProps<typeof cardVariants>) {
  return (
    <Link
      onPointerMove={(e) => {
        trackSpotlight(e);
        onPointerMove?.(e);
      }}
      className={cn(
        cardVariants({ variant }),
        "spotlight block transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop active:scale-[0.98]",
        className,
      )}
      {...props}
    />
  );
}
