"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Hộp thoại đáp ứng: điện thoại = bottom sheet kéo xuống để đóng; màn rộng = hộp giữa màn hình.
 * Luôn bọc trong <AnimatePresence> bằng prop `open` để có hiệu ứng vào/ra.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const drag = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-overlay backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === "string" ? title : undefined}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            drag="y"
            dragControls={drag}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-sheet border border-line bg-surface-raised shadow-pop sm:rounded-sheet",
              size === "sm" && "sm:max-w-md",
              size === "md" && "sm:max-w-xl",
              size === "lg" && "sm:max-w-3xl",
            )}
          >
            <div
              className="flex cursor-grab touch-none justify-center pt-2.5 sm:hidden"
              onPointerDown={(e) => drag.start(e)}
            >
              <span className="h-1.5 w-11 rounded-full bg-line-strong" />
            </div>
            <header
              className="flex items-start justify-between gap-3 px-5 pb-3 pt-3 sm:px-6 sm:pt-5"
              onPointerDown={(e) => drag.start(e)}
            >
              <div className="min-w-0">
                <h2 className="text-h2 font-bold tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-subtle text-muted transition hover:text-foreground active:scale-90"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
            {footer && <footer className="pb-safe border-t border-line bg-surface-raised px-5 py-3 sm:px-6">{footer}</footer>}
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
