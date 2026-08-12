-- DropForeignKey
ALTER TABLE "activity_log_entries" DROP CONSTRAINT "activity_log_entries_actor_id_fkey";

-- AlterTable
ALTER TABLE "activity_log_entries" ALTER COLUMN "actor_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "activity_log_entries" ADD CONSTRAINT "activity_log_entries_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
