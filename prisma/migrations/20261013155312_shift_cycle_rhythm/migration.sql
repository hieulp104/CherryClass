-- AlterTable
ALTER TABLE "classrooms" ADD COLUMN     "cycle_length" INTEGER;

-- AlterTable
ALTER TABLE "shifts" ADD COLUMN     "cycle_mark" TEXT;

-- Đặt mốc khép kỳ cho dữ liệu đang có.
-- Trước đây mỗi em tự đếm riêng nên các em trong một ca có thể lệch nhịp. "Tiến độ của ca" lấy theo
-- số buổi chưa vào phiếu mà ĐA SỐ học sinh đang học của ca đang có (hòa thì lấy số lớn hơn).
-- Mốc = buổi đã xong đứng ngay trước chừng ấy buổi gần nhất. Như vậy kỳ đang chạy của đa số giữ nguyên;
-- em ít buổi hơn (mới vào) sẽ có phiếu ngắn, cùng lúc với cả ca. Không phát sinh phiếu nào lúc chuyển đổi.
WITH counts AS (
  SELECT st."shift_id", st."id",
         COUNT(a."id") FILTER (WHERE a."billable" AND il."id" IS NULL) AS un
  FROM "students" st
  LEFT JOIN "attendances" a ON a."student_id" = st."id"
  LEFT JOIN "invoice_lines" il ON il."attendance_id" = a."id"
  WHERE st."deleted_at" IS NULL AND st."status" = 'ACTIVE' AND st."shift_id" IS NOT NULL
  GROUP BY st."shift_id", st."id"
),
modes AS (
  SELECT "shift_id", un,
         ROW_NUMBER() OVER (PARTITION BY "shift_id" ORDER BY COUNT(*) DESC, un DESC) AS rn
  FROM counts
  GROUP BY "shift_id", un
),
completed AS (
  SELECT s."shift_id", to_char(s."date", 'YYYY-MM-DD') || ' ' || s."start_time" AS k,
         ROW_NUMBER() OVER (PARTITION BY s."shift_id" ORDER BY s."date" DESC, s."start_time" DESC) AS back
  FROM "sessions" s
  WHERE s."status" = 'COMPLETED'
)
UPDATE "shifts" AS sh
SET "cycle_mark" = c.k
FROM modes m
JOIN completed c ON c."shift_id" = m."shift_id" AND c.back = m.un + 1
WHERE m.rn = 1 AND sh."id" = m."shift_id";
