-- CreateEnum
CREATE TYPE "ReportVisibility" AS ENUM ('private', 'shared_roles', 'shared_org');

-- CreateEnum
CREATE TYPE "ReportFrequency" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "ReportExportFormat" AS ENUM ('csv', 'xlsx', 'pdf');

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "visibility" "ReportVisibility" NOT NULL DEFAULT 'private',
    "shared_with_role_ids" TEXT[],
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "saved_report_id" TEXT NOT NULL,
    "frequency" "ReportFrequency" NOT NULL,
    "send_at" TEXT NOT NULL,
    "day_of_week" INTEGER,
    "day_of_month" INTEGER,
    "recipient_user_ids" TEXT[],
    "recipient_role_ids" TEXT[],
    "export_format" "ReportExportFormat" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_aggregate_cache" (
    "id" TEXT NOT NULL,
    "metric_key" TEXT NOT NULL,
    "department_id" TEXT,
    "dimension_value" TEXT NOT NULL,
    "period_date" DATE NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "refreshed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_aggregate_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_aggregate_cache_metric_key_period_date_idx" ON "report_aggregate_cache"("metric_key", "period_date");

-- CreateIndex
CREATE UNIQUE INDEX "report_aggregate_cache_metric_key_department_id_dimension_v_key" ON "report_aggregate_cache"("metric_key", "department_id", "dimension_value", "period_date");

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_aggregate_cache" ADD CONSTRAINT "report_aggregate_cache_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
