-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskActionType" AS ENUM ('archive', 'delete');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaskActionRequestStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "task_action_requests" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "action_type" "TaskActionType" NOT NULL,
    "requester_id" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "status" "TaskActionRequestStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "reviewer_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "task_action_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_action_requests_task_id_idx" ON "task_action_requests"("task_id");
CREATE INDEX IF NOT EXISTS "task_action_requests_requester_id_idx" ON "task_action_requests"("requester_id");
CREATE INDEX IF NOT EXISTS "task_action_requests_status_idx" ON "task_action_requests"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "task_action_requests" ADD CONSTRAINT "task_action_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "task_action_requests" ADD CONSTRAINT "task_action_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "task_action_requests" ADD CONSTRAINT "task_action_requests_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
