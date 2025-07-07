-- Migration: Add deleted and deleted_at columns to failed_jobs table
-- Date: 2025-01-07
-- Purpose: Support soft deletion of failed jobs for better UX

-- Add the new columns
ALTER TABLE failed_jobs 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_failed_jobs_deleted ON failed_jobs(deleted);

-- Update any existing records to have deleted = FALSE (just to be explicit)
UPDATE failed_jobs SET deleted = FALSE WHERE deleted IS NULL;

-- Verify the migration
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'failed_jobs' 
AND column_name IN ('deleted', 'deleted_at');
