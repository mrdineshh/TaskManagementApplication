-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "head_user_id" TEXT;

-- AlterTable: work_country/work_state are added nullable, backfilled, then locked to NOT NULL —
-- can't add a NOT NULL column directly onto a table with existing rows (hits existing seeded
-- users). "Unknown" is a deliberately obvious placeholder so backfilled rows are easy to find
-- and correct via the Admin UI, not a real region.
ALTER TABLE "users" ADD COLUMN     "active_role_id" TEXT,
ADD COLUMN     "manager_id" TEXT,
ADD COLUMN     "work_country" TEXT,
ADD COLUMN     "work_state" TEXT;

UPDATE "users" SET "work_country" = 'Unknown', "work_state" = 'Unknown' WHERE "work_country" IS NULL;

ALTER TABLE "users" ALTER COLUMN "work_country" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "work_state" SET NOT NULL;

-- CreateTable
CREATE TABLE "holiday_calendars" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendars_country_state_key" ON "holiday_calendars"("country", "state");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_calendar_id_date_key" ON "holidays"("calendar_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "departments_head_user_id_key" ON "departments"("head_user_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_user_id_fkey" FOREIGN KEY ("head_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_active_role_id_fkey" FOREIGN KEY ("active_role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "holiday_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
