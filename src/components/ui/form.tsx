"use client";

import { forwardRef, useState, type ChangeEvent, type ReactNode } from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-control border border-line-strong bg-surface px-3.5 text-foreground placeholder:text-muted/70 transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(fieldBase, "min-h-11 py-2", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, ...props },
  ref,
) {
  return <select ref={ref} className={cn(fieldBase, "min-h-11 appearance-auto py-2", className)} {...props} />;
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-caption font-medium text-overdue">{error}</p>
      ) : hint ? (
        <p className="text-caption text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Công tắc bật/tắt có hiệu ứng trượt. Dùng `name` để gửi kèm form ("on" khi bật). */
export function Switch({
  checked,
  onChange,
  name,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4", disabled && "opacity-60")}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block font-semibold">{label}</span>}
          {description && <span className="block text-caption text-muted">{description}</span>}
        </span>
      )}
      {name && <input type="hidden" name={name} value={checked ? "on" : ""} />}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-leaf" : "bg-line-strong",
        )}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn("absolute top-1 size-5 rounded-full bg-white shadow", checked ? "right-1" : "left-1")}
        />
      </button>
    </label>
  );
}

/** "25000" → "25.000" — lấy từ QLNS: chèn dấu chấm nghìn ngay khi gõ để không nhầm 25.000 với 250.000. */
export function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Đọc lại số từ ô tiền: "1.600.000" → 1600000. */
export function parseMoney(value: FormDataEntryValue | string | null | undefined): number {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "defaultValue"> & {
    defaultValue?: number | string | null;
    onValueChange?: (value: number) => void;
  }
>(function MoneyInput({ defaultValue, onValueChange, className, ...props }, ref) {
  const [value, setValue] = useState(() => formatMoneyInput(defaultValue == null ? "" : String(defaultValue)));

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const field = event.target;
    const caret = field.selectionStart ?? field.value.length;
    const digitsBeforeCaret = field.value.slice(0, caret).replace(/\D/g, "").length;
    const formatted = formatMoneyInput(field.value);
    setValue(formatted);
    onValueChange?.(parseMoney(formatted));
    requestAnimationFrame(() => {
      let seen = 0;
      let position = digitsBeforeCaret === 0 ? 0 : formatted.length;
      for (let i = 0; i < formatted.length; i++) {
        if (formatted[i] !== ".") seen++;
        if (seen === digitsBeforeCaret) {
          position = i + 1;
          break;
        }
      }
      field.setSelectionRange(position, position);
    });
  }

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={handleChange}
        className={cn("pr-9 text-right font-semibold tabular", className)}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center font-semibold text-muted">
        đ
      </span>
    </div>
  );
});
