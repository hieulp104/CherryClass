import {
  BookOpen,
  Car,
  Coffee,
  Gift,
  Home,
  Pencil,
  Printer,
  Shapes,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Icon danh mục chi — lưu tên trong DB, ánh xạ sang component ở đây (không import động cả bộ icon). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  printer: Printer,
  home: Home,
  zap: Zap,
  gift: Gift,
  pencil: Pencil,
  shapes: Shapes,
  book: BookOpen,
  coffee: Coffee,
  car: Car,
  wifi: Wifi,
};

export function CategoryIcon({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  const Icon = CATEGORY_ICONS[name] ?? Shapes;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[14px]"
      style={{ width: size, height: size, background: `${color}22`, color }}
    >
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} />
    </span>
  );
}
