-- CreateEnum
CREATE TYPE "EffortUnit" AS ENUM ('hours', 'days');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "estimate_submitted_at" TIMESTAMP(3),
ADD COLUMN     "estimate_submitted_by_id" TEXT,
ADD COLUMN     "estimate_unit" "EffortUnit",
ADD COLUMN     "estimate_value" DOUBLE PRECISION,
ADD COLUMN     "on_hold_reason_id" TEXT;

-- AlterTable: updated_at needs a value for existing rows before it can go NOT NULL — using
-- created_at's default (CURRENT_TIMESTAMP) for the ADD COLUMN step covers that in one pass,
-- since no row-by-row backfill logic is needed (it's the same "now" for every existing row).
ALTER TABLE "time_logs" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Prisma's @updatedAt is an application-layer directive, not a DB-level default — drop it after
-- the backfill above so the schema matches exactly what `prisma migrate diff` expects going
-- forward (created_at legitimately keeps its DB default; updated_at does not).
ALTER TABLE "time_logs" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "workflow_statuses" ADD COLUMN     "requires_hold_reason" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requires_estimate_before_entry" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "on_hold_reasons" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "on_hold_reasons_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_on_hold_reason_id_fkey" FOREIGN KEY ("on_hold_reason_id") REFERENCES "on_hold_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_estimate_submitted_by_id_fkey" FOREIGN KEY ("estimate_submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
