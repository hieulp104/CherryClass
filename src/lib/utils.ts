import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gộp class Tailwind, class sau ghi đè class trước khi trùng nhóm. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "1600000" → "1.600.000". Chỉ nhóm nghìn, không kèm đơn vị. */
export function formatNumber(value: number): string {
  const sign = value < 0 ? "-" : "";
  return sign + String(Math.abs(Math.trunc(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Tiền VND theo cách cô giáo và phụ huynh quen viết: 1600000 → "1.600.000đ".
 * Không dùng Intl currency vì nó ra "1.600.000 ₫" có khoảng trắng hẹp, khó đọc trên điện thoại.
 */
export function formatVnd(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${formatNumber(value)}đ`;
}

/** Rút gọn cho thẻ số liệu: 12.400.000 → "12,4tr", 850.000 → "850k". */
export function formatVndShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${m.toFixed(m >= 100 ? 0 : 1).replace(/\.0$/, "").replace(".", ",")}tr`;
  }
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)}k`;
  return `${sign}${abs}đ`;
}

/** Ngày theo giờ Việt Nam: "20/07/2026". */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/** Ngày giờ: "20/07/2026 14:30". */
export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(d);
}

/** "5 phút trước", "3 ngày trước"; quá 7 ngày thì ra ngày cụ thể. */
export function formatRelativeTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.floor((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days <= 7) return `${days} ngày trước`;
  return formatDate(d);
}

/**
 * Bỏ dấu tiếng Việt, chữ thường, gộp khoảng trắng — để tìm "nguyen van an" ra "Nguyễn Văn An".
 * "đ" không phải dấu kết hợp trong Unicode nên phải thay riêng.
 */
export function removeDiacritics(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chữ cái avatar = chữ đầu của TÊN (từ cuối): "Nguyễn Văn An" → "A". */
export function avatarLetter(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts.at(-1)?.[0] ?? "?").toUpperCase();
}

/** Tên gọi thân mật = từ cuối: "Nguyễn Văn An" → "An". */
export function givenName(fullName: string): string {
  return fullName.trim().split(/\s+/).at(-1) ?? fullName;
}

/** Hue pastel cố định theo chuỗi (id) — mỗi em một màu, không đổi giữa các lần tải. */
export function hueFromString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h % 360;
}

/** SĐT về dạng chỉ chữ số: "0912 345.678" → "0912345678". */
export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "").replace(/^\+84/, "0");
}

export const PHONE_PATTERN = /^0\d{9,10}$/;

/** "Chào buổi sáng/trưa/chiều/tối" theo giờ VN. */
export function greetingFor(hour: number): string {
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 13) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}
