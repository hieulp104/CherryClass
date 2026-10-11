"use client";

import { AnimatePresence, motion } from "motion/react";
import { Moon, Sun } from "lucide-react";

import { useStoredValue } from "@/lib/use-external";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark";
const LABEL: Record<Mode, string> = { light: "Sáng", dark: "Tối" };
const EVENT = "tc-theme-changed";

/** Giao diện đang hiển thị: chọn tay nếu có, chưa chọn thì theo máy (CSS tự theo, ở đây chỉ để biết icon). */
function readMode(): Mode {
  try {
    const t = localStorage.getItem("tc-theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    // trình duyệt chặn localStorage
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useThemeMode() {
  const mode = useStoredValue<Mode>(EVENT, readMode, "light");
  const apply = (m: Mode) => {
    document.documentElement.dataset.theme = m;
    try {
      localStorage.setItem("tc-theme", m);
    } catch {
      // trình duyệt chặn localStorage — vẫn đổi được trong phiên này
    }
    // Thanh trình duyệt đổi màu theo (hàm khai báo trong script đầu trang, app/layout.tsx).
    (window as { __tcThemeColor?: (m: Mode) => void }).__tcThemeColor?.(m);
    window.dispatchEvent(new Event(EVENT));
  };
  return { mode, toggle: () => apply(mode === "dark" ? "light" : "dark") };
}

/**
 * Đổi Sáng ⇄ Tối. Dạng icon (thanh trên): hiện cái SẼ chuyển sang — đang sáng thì mặt trăng.
 * Dạng có chữ (trong menu): hiện giao diện đang dùng.
 */
export function ThemeToggle({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  const { mode, toggle } = useThemeMode();
  const next: Mode = mode === "dark" ? "light" : "dark";
  const shown = withLabel ? mode : next;
  const Icon = shown === "dark" ? Moon : Sun;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Chuyển sang giao diện ${LABEL[next].toLowerCase()}`}
      title={`Giao diện ${LABEL[next].toLowerCase()}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full text-sm font-semibold text-muted transition hover:bg-surface-subtle hover:text-foreground active:scale-95",
        withLabel ? "bg-surface-subtle px-3 py-2" : "size-10 justify-center",
        className,
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={mode}
          initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Icon className="size-[18px]" />
        </motion.span>
      </AnimatePresence>
      {withLabel && <span>{LABEL[mode]}</span>}
    </button>
  );
}
