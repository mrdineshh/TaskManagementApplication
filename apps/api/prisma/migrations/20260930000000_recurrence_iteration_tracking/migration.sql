-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "recurrence_index" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "tasks" ADD COLUMN "recurrence_parent_id" TEXT;
