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

/** Thẻ là link, có hiệu ứng nhấn. */
export function CardLink({
  className,
  variant,
  ...props
}: LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  VariantProps<typeof cardVariants>) {
  return (
    <Link
      className={cn(
        cardVariants({ variant }),
        "block transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-pop active:scale-[0.98]",
        className,
      )}
      {...props}
    />
  );
}
