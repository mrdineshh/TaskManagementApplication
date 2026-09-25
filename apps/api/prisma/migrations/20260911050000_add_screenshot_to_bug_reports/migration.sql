-- Add screenshot_base64 column to bug_reports table
-- This is nullable so existing rows are unaffected.
ALTER TABLE "bug_reports" ADD COLUMN IF NOT EXISTS "screenshot_base64" TEXT;
