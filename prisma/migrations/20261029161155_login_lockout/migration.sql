-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failed_logins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "locked_until" TIMESTAMP(3),
ADD COLUMN     "temp_password_expires_at" TIMESTAMP(3);

-- Tài khoản đang giữ mật khẩu tạm: cho thêm 7 ngày kể từ lúc nâng cấp.
-- Prisma lưu giờ UTC trong cột TIMESTAMP — không dùng CURRENT_TIMESTAMP (theo múi giờ của DB, ở đây là giờ VN).
UPDATE "users" SET "temp_password_expires_at" = (now() AT TIME ZONE 'UTC') + INTERVAL '7 days' WHERE "must_change_password" = true;
