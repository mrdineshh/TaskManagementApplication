-- AlterTable
ALTER TABLE "workflow_statuses" ADD COLUMN IF NOT EXISTS "is_review_status" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "timer_started_at" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "total_logged_minutes" INTEGER NOT NULL DEFAULT 0;
