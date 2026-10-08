"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, Undo2 } from "lucide-react";

import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/**
 * Toast + Hoàn tác. `toast.undoable(...)` hiện thanh đếm ngược 5 giây kèm nút "Hoàn tác";
 * hết giờ mà không bấm thì gọi `onCommit` (nếu có).
 */

type ToastKind = "success" | "error" | "info";

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: ReactNode;
  undo?: () => void;
  duration: number;
};

type ToastApi = {
  success: (message: ReactNode) => void;
  error: (message: ReactNode) => void;
  info: (message: ReactNode) => void;
  undoable: (message: ReactNode, opts: { onUndo: () => void; onCommit?: () => void; duration?: number }) => void;
  /** Đóng mọi toast (vd sau khi chốt buổi — "Hoàn tác" lúc đó không còn ý nghĩa). */
  dismissAll: () => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải nằm trong <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (item: Omit<ToastItem, "id">, onExpire?: () => void) => {
      const id = ++seq.current;
      // Tối đa 3 toast — cái cũ nhất bị đẩy ra (và vẫn được commit).
      setItems((list) => [...list.slice(-2), { ...item, id }]);
      timers.current.set(
        id,
        setTimeout(() => {
          remove(id);
          onExpire?.();
        }, item.duration),
      );
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => {
        haptic(12);
        push({ kind: "success", message, duration: 2600 });
      },
      error: (message) => {
        haptic([30, 40, 30]);
        push({ kind: "error", message, duration: 4500 });
      },
      info: (message) => push({ kind: "info", message, duration: 3000 }),
      dismissAll: () => {
        for (const t of timers.current.values()) clearTimeout(t);
        timers.current.clear();
        setItems([]);
      },
      undoable: (message, { onUndo, onCommit, duration = 5000 }) => {
        haptic(10);
        let undone = false;
        push(
          {
            kind: "info",
            message,
            duration,
            undo: () => {
              undone = true;
              onUndo();
            },
          },
          () => {
            if (!undone) onCommit?.();
          },
        );
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 24, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              className={cn(
                "pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[18px] border px-4 py-3 shadow-pop backdrop-blur",
                t.kind === "error"
                  ? "border-overdue/30 bg-overdue-soft"
                  : "border-line bg-surface-raised/95",
              )}
            >
              <div className="flex items-center gap-3">
                {t.kind === "success" && <CheckCircle2 className="size-5 shrink-0 text-leaf" />}
                {t.kind === "error" && <AlertTriangle className="size-5 shrink-0 text-overdue" />}
                {t.kind === "info" && !t.undo && <Info className="size-5 shrink-0 text-sky" />}
                <div className="min-w-0 flex-1 text-sm font-medium">{t.message}</div>
                {t.undo && (
                  <button
                    type="button"
                    onClick={() => {
                      t.undo?.();
                      remove(t.id);
                      haptic(8);
                    }}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-soft px-3 py-1.5 text-sm font-bold text-primary-deep active:scale-95"
                  >
                    <Undo2 className="size-4" /> Hoàn tác
                  </button>
                )}
              </div>
              {t.undo && (
                <motion.span
                  className="absolute bottom-0 left-0 h-1 bg-primary"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: t.duration / 1000, ease: "linear" }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
