/**
 * Khởi tạo bản chạy thật — KHÔNG xóa gì, chạy lại an toàn (đã có thì bỏ qua).
 * Chỉ tạo tài khoản cô giáo và danh mục chi phí. Khác với seed.ts: seed XÓA SẠCH rồi tạo dữ liệu mẫu, chỉ dùng cho dev.
 *
 *   TEACHER_EMAIL=... TEACHER_NAME="cô Hà" node bootstrap.mjs
 *
 * Mật khẩu tạm in ra MỘT lần, hết hạn sau 7 ngày, đăng nhập lần đầu phải đổi.
 */
import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { DEFAULT_SETTINGS, saveSetting } from "../src/modules/settings/settings.service";
import { prisma } from "../src/shared/prisma/prisma.service";

const CATEGORIES = [
  { name: "Photo đề", icon: "printer", color: "#0EA5E9" },
  { name: "Thuê phòng", icon: "home", color: "#8B5CF6" },
  { name: "Điện nước", icon: "zap", color: "#F59E0B" },
  { name: "Quà cho học sinh", icon: "gift", color: "#E11D48" },
  { name: "Văn phòng phẩm", icon: "pencil", color: "#16A34A" },
  { name: "Khác", icon: "shapes", color: "#64748B" },
];

const TEMP_PASSWORD_DAYS = 7;

async function main() {
  if ((await prisma.expenseCategory.count()) === 0) {
    await prisma.expenseCategory.createMany({ data: CATEGORIES.map((c, i) => ({ ...c, sortOrder: i })) });
    console.log("Đã tạo danh mục chi phí.");
  }

  if ((await prisma.user.count({ where: { role: "TEACHER" } })) > 0) {
    console.log("Đã có tài khoản cô giáo — không tạo thêm, không đổi mật khẩu.");
    return;
  }

  const email = process.env.TEACHER_EMAIL?.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Cần đặt TEACHER_EMAIL là một email hợp lệ.");
  const name = process.env.TEACHER_NAME?.trim() || DEFAULT_SETTINGS.teacherName;

  const password = randomBytes(9).toString("base64url");
  await prisma.user.create({
    data: {
      email,
      username: email,
      passwordHash: await bcrypt.hash(password, 10),
      displayName: name,
      role: "TEACHER",
      mustChangePassword: true,
      tempPasswordExpiresAt: new Date(Date.now() + TEMP_PASSWORD_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  await saveSetting("teacherName", name);

  console.log(`Đã tạo tài khoản cô giáo.\n  Đăng nhập: ${email}\n  Mật khẩu tạm: ${password}\nMật khẩu chỉ hiện lần này, hết hạn sau ${TEMP_PASSWORD_DAYS} ngày.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
