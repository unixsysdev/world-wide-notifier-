CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    google_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    -- Subscription management
    subscription_tier VARCHAR(50) DEFAULT 'free', -- free, premium, premium_plus
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'active', -- active, canceled, past_due, etc.
    subscription_created_at TIMESTAMP,
    subscription_updated_at TIMESTAMP,
    -- Alert limits based on tier
    daily_alert_count INTEGER DEFAULT 0,
    daily_alert_reset_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs table
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sources JSONB NOT NULL, -- Array of source URLs/configs
    prompt TEXT NOT NULL, -- AI analysis prompt
    frequency_minutes INTEGER NOT NULL DEFAULT 60 CHECK (frequency_minutes >= 1),
    is_active BOOLEAN DEFAULT TRUE,
    threshold_score INTEGER DEFAULT 75,
    -- Alert frequency control
    notification_channel_ids JSONB DEFAULT '[]', -- Array of channel IDs for this job
    alert_cooldown_minutes INTEGER DEFAULT 60, -- Minimum time between alerts for same content
    max_alerts_per_hour INTEGER DEFAULT 5, -- Rate limiting for alerts
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job runs table
CREATE TABLE job_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'running', -- running, completed, failed
    sources_processed INTEGER DEFAULT 0,
    alerts_generated INTEGER DEFAULT 0,
    error_message TEXT,
    analysis_summary JSONB -- AI analysis results and details
);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    job_run_id UUID NOT NULL REFERENCES job_runs(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    source_url VARCHAR(1000),
    relevance_score INTEGER NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    -- Alert acknowledgment and repeat management
    is_acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP,
    acknowledged_by UUID REFERENCES users(id),
    acknowledgment_token VARCHAR(255), -- For email-based acknowledgment
    -- Notification management
    notification_channels JSONB, -- Array of channel IDs to use for this alert
    repeat_count INTEGER DEFAULT 0,
    last_repeated_at TIMESTAMP,
    next_repeat_at TIMESTAMP,
    repeat_frequency_minutes INTEGER DEFAULT 60, -- How often to repeat if not acknowledged
    max_repeats INTEGER DEFAULT 5, -- Maximum number of repeats
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sources health table
CREATE TABLE source_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_url VARCHAR(1000) NOT NULL,
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'healthy', -- healthy, slow, failed
    response_time_ms INTEGER,
    error_message TEXT,
    consecutive_failures INTEGER DEFAULT 0
);

-- Notification channels table
CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel_type VARCHAR(50) NOT NULL, -- email, teams, slack, etc.
    config JSONB NOT NULL, -- Channel-specific configuration
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job notification settings table
CREATE TABLE job_notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    notification_channel_ids JSONB NOT NULL DEFAULT '[]', -- Array of channel IDs
    repeat_frequency_minutes INTEGER DEFAULT 60,
    max_repeats INTEGER DEFAULT 5,
    require_acknowledgment BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- SHA-256 hash of the actual key
    key_prefix VARCHAR(20) NOT NULL, -- First 8 chars for display (e.g., "ak_live_12345678")
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    rate_limit_per_minute INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User subscription events log
CREATE TABLE subscription_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- subscription_created, subscription_updated, payment_succeeded, etc.
    stripe_event_id VARCHAR(255),
    event_data JSONB,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_active ON jobs(is_active);
CREATE INDEX idx_job_runs_job_id ON job_runs(job_id);
CREATE INDEX idx_alerts_job_id ON alerts(job_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_acknowledged ON alerts(is_acknowledged);
CREATE INDEX idx_alerts_next_repeat ON alerts(next_repeat_at);
CREATE INDEX idx_source_health_url ON source_health(source_url);
CREATE INDEX idx_notification_channels_user_id ON notification_channels(user_id);
CREATE INDEX idx_job_notification_settings_job_id ON job_notification_settings(job_id);
CREATE INDEX idx_subscription_events_user_id ON subscription_events(user_id);
CREATE INDEX idx_users_subscription_tier ON users(subscription_tier);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);
