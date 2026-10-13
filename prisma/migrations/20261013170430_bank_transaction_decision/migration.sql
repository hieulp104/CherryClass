-- AlterTable
ALTER TABLE "bank_transactions" ADD COLUMN     "decision" TEXT NOT NULL DEFAULT 'UNMATCHED',
ADD COLUMN     "dismissed_at" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT;
