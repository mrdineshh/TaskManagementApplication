-- CreateTable
CREATE TABLE "scorecard_config" (
    "id" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scorecard_config_pkey" PRIMARY KEY ("id")
);

