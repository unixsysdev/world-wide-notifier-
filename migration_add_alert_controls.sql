-- Migration to add alert control fields to jobs table
-- Run this if you have an existing database

-- Add new columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notification_channel_ids JSONB DEFAULT '[]';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS alert_cooldown_minutes INTEGER DEFAULT 60;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_alerts_per_hour INTEGER DEFAULT 5;

-- Update existing jobs with default values
UPDATE jobs SET 
    notification_channel_ids = '[]',
    alert_cooldown_minutes = 60,
    max_alerts_per_hour = 5
WHERE notification_channel_ids IS NULL;

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_jobs_alert_cooldown ON jobs(alert_cooldown_minutes);
CREATE INDEX IF NOT EXISTS idx_jobs_max_alerts_per_hour ON jobs(max_alerts_per_hour);

-- Add comment explaining the new fields
COMMENT ON COLUMN jobs.notification_channel_ids IS 'Array of notification channel IDs to use for this job';
COMMENT ON COLUMN jobs.alert_cooldown_minutes IS 'Minimum time between alerts for the same content to prevent duplicates';
COMMENT ON COLUMN jobs.max_alerts_per_hour IS 'Maximum number of alerts per hour to prevent spam';
