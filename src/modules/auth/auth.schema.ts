import { z } from "zod";

import { normalizePhone } from "@/lib/utils";

/**
 * Chuẩn hóa tên đăng nhập: email / mã học sinh viết thường; SĐT bỏ khoảng trắng, dấu chấm, +84.
 * Form đăng nhập và lúc cấp tài khoản PHẢI dùng chung hàm này — lệch nhau là không đăng nhập được.
 */
export function normalizeLogin(raw: string): string {
  const v = raw.trim().toLowerCase();
  if (/^[+\d][\d\s.\-()]{7,}$/.test(v)) return normalizePhone(v);
  return v;
}

export const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .min(1, "Nhập email, số điện thoại hoặc mã học sinh giúp em nhé")
    .transform(normalizeLogin),
  password: z.string().min(1, "Nhập mật khẩu giúp em nhé"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Nhập mật khẩu hiện tại"),
    next: z.string().min(6, "Mật khẩu mới ít nhất 6 ký tự").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "Hai lần nhập mật khẩu mới chưa giống nhau", path: ["confirm"] })
  .refine((v) => v.next !== v.current, { message: "Mật khẩu mới phải khác mật khẩu cũ", path: ["next"] });
