-- Add analysis_summary column to job_runs table to store LLM feedback
ALTER TABLE job_runs ADD COLUMN IF NOT EXISTS analysis_summary JSONB;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_job_runs_job_id_started_at ON job_runs(job_id, started_at DESC);

-- Add comment for documentation
COMMENT ON COLUMN job_runs.analysis_summary IS 'JSON object containing LLM analysis results and feedback for debugging purposes';
