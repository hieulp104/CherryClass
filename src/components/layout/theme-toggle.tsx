"use client";

import { AnimatePresence, motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";

import { useStoredValue } from "@/lib/use-external";
import { cn } from "@/lib/utils";

type Mode = "system" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "Theo máy", light: "Sáng", dark: "Tối" };
const EVENT = "tc-theme-changed";

function readMode(): Mode {
  try {
    const t = localStorage.getItem("tc-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function useThemeMode() {
  const mode = useStoredValue<Mode>(EVENT, readMode, "system");
  const apply = (m: Mode) => {
    const root = document.documentElement;
    if (m === "system") delete root.dataset.theme;
    else root.dataset.theme = m;
    try {
      if (m === "system") localStorage.removeItem("tc-theme");
      else localStorage.setItem("tc-theme", m);
    } catch {
      // trình duyệt chặn localStorage — vẫn đổi được trong phiên này
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { mode, cycle: () => apply(NEXT[mode]) };
}

export function ThemeToggle({ withLabel = false, className }: { withLabel?: boolean; className?: string }) {
  const { mode, cycle } = useThemeMode();
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Giao diện: ${LABEL[mode]}`}
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-surface-subtle px-3 py-2 text-sm font-semibold text-muted transition hover:text-foreground active:scale-95",
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
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
      {withLabel && <span>{LABEL[mode]}</span>}
    </button>
  );
}
