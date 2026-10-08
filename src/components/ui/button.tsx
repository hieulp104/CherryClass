"use client";

import Link, { type LinkProps } from "next/link";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-control font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary shadow-[0_6px_16px_-6px_rgb(225_29_72/0.55)] hover:bg-primary-hover",
        soft: "bg-primary-soft text-primary-deep hover:brightness-[0.97]",
        outline: "border border-line-strong bg-surface text-foreground hover:bg-surface-subtle",
        ghost: "text-foreground hover:bg-surface-subtle",
        leaf: "bg-leaf text-white shadow-[0_6px_16px_-6px_rgb(22_163_74/0.55)] hover:brightness-95",
        danger: "border border-overdue/30 bg-overdue-soft text-overdue hover:brightness-[0.97]",
        white: "bg-white text-[#9F1239] shadow-md hover:bg-white/90",
        glass: "bg-white/20 text-white backdrop-blur hover:bg-white/30",
      },
      size: {
        sm: "min-h-9 px-3 text-sm",
        md: "min-h-11 px-4 text-[15px]",
        lg: "min-h-12 px-5 text-base",
        xl: "min-h-14 px-6 text-lg",
        icon: "size-11 p-0",
        "icon-sm": "size-9 p-0",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type MotionButtonProps = Omit<HTMLMotionProps<"button">, "children"> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    children?: React.ReactNode;
  };

/** Nút có hiệu ứng nhấn lún (spring). */
export const Button = forwardRef<HTMLButtonElement, MotionButtonProps>(function Button(
  { className, variant, size, block, loading, disabled, children, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
});

type ButtonLinkProps = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> &
  VariantProps<typeof buttonVariants>;

export function ButtonLink({ className, variant, size, block, ...props }: ButtonLinkProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), "active:scale-[0.97]", className)} {...props} />;
}

/** Nút thường không có motion — dùng trong danh sách dài để nhẹ. */
export function PlainButton({
  className,
  variant,
  size,
  block,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button className={cn(buttonVariants({ variant, size, block }), "active:scale-[0.97]", className)} {...props} />;
}
