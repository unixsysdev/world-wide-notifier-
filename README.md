# AI Monitoring System

A comprehensive AI-powered monitoring system that tracks multiple sources and generates intelligent alerts based on custom criteria. Now with full API key management and external API access!

## Architecture

- **Frontend**: React app with Tailwind CSS and Google OAuth
- **API Service**: FastAPI backend with JWT authentication
- **Browser Service**: Playwright-based realistic web scraping
- **Worker Manager**: Job scheduling and processing
- **LLM Service**: OpenAI/Claude integration for content analysis
- **Notification Service**: User-specific multi-channel alerting
- **Database**: PostgreSQL for persistence
- **Queue**: Redis for job management

## Quick Start

1. **Setup Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   # Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, SENDGRID_API_KEY
   ```

2. **Build and Start**:
   ```bash
   make build
   make up
   ```

3. **Initialize Database**:
   ```bash
   make init-db
   ```

4. **Access the Application**:
   - Frontend: http://localhost:3000
   - API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Services

### Frontend (Port 3000)
- React-based web interface
- Job creation and management
- Real-time monitoring dashboard

### API Service (Port 8000)
- FastAPI backend
- Google OAuth authentication
- Job CRUD operations
- RESTful API endpoints

### Browser Service (Port 8001)
- Playwright-powered web scraping
- Realistic browser fingerprinting
- JavaScript rendering support
- Anti-detection measures

### Worker Manager
- Job scheduling and execution
- Source processing coordination
- Scalable worker pool management

### LLM Service (Port 8002)
- OpenAI GPT integration
- Content analysis and scoring
- Structured response parsing
- Configurable prompts

### Notification Service (Port 8003)
- Multi-channel alerting
- Email and Teams notifications
- Duplicate detection
- Customizable thresholds

## Development

```bash
# Start in development mode
make dev

# View logs
make logs

# Clean up
make clean

# Check service health
make health
```

## Authentication

The system uses Google OAuth for user authentication:
- Users sign in with their Google account
- JWT tokens are used for API authentication
- Each user has their own jobs and notification channels

## Notification Channels

Users can configure multiple notification channels:
- **Email**: Send alerts to specific email addresses
- **Microsoft Teams**: Send alerts to Teams channels via webhooks
- **Slack**: Send alerts to Slack channels via webhooks

## Configuration

See `.env` for required environment variables:
- Google OAuth credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- OpenAI/Anthropic API keys
- SMTP configuration (SENDGRID_API_KEY)
- JWT secret for authentication
- Hostname configuration for flexible deployment

## Latest Features (✨ New!)

### 🔑 **API Key Management**
- Complete API key management interface in the web UI
- Secure SHA-256 hashed key storage
- Tier-based rate limiting (60/120/300 requests per minute)
- Real-time usage statistics and monitoring

### 🌐 **External API Endpoints (v1)**
Full REST API for programmatic access:
- `GET /api/v1/jobs` - List all user jobs
- `POST /api/v1/jobs` - Create new monitoring job
- `PUT /api/v1/jobs/{id}` - Update existing job
- `DELETE /api/v1/jobs/{id}` - Delete job
- `POST /api/v1/jobs/{id}/run` - Trigger immediate execution
- `GET /api/v1/jobs/{id}/runs` - Get job execution history
- `GET /api/v1/jobs/{id}/alerts` - Get job-specific alerts
- `GET /api/v1/alerts` - Get all user alerts

### 📊 **Historical Data & Analytics**
Complete historical data storage and retrieval:
- `GET /api/v1/jobs/{id}/historical-data` - Get detailed execution history with raw data
- `GET /api/v1/jobs/{id}/runs/{run_id}/detailed` - Get complete run details including source HTML and LLM analysis
- `GET /jobs/{id}/historical-data` - Web interface for historical data
- `GET /jobs/{id}/runs/{run_id}/detailed` - Web interface for detailed run analysis
- **MongoDB Integration**: Raw HTML, LLM analysis, and execution metadata stored in MongoDB
- **PostgreSQL Integration**: Job metadata and summary data in PostgreSQL

### 🔐 **Security & Authentication**
- Bearer token authentication for all API endpoints
- Rate limiting with Redis backend
- User isolation and tier-based restrictions
- Secure key generation with cryptographic randomness

### 💳 **Subscription Tiers**
- **Free**: 3 jobs, hourly frequency, 3 alerts/day, 2 API keys
- **Premium**: 10 jobs, 1-min frequency, 100 alerts/day, 5 API keys
- **Premium Plus**: Unlimited jobs, 1-min frequency, unlimited alerts, 10 API keys

### 🎯 **UI/UX Improvements**
- Fixed navigation with proper URL routing
- Browser back/forward button support
- Persistent tab state across page refreshes
- Improved API key creation with secure modal display
- Real-time navigation between all views

## API Usage Example

```bash
# Create API key in web UI first, then:
export API_KEY="ak_live_your_generated_key"

# List jobs
curl -H "Authorization: Bearer $API_KEY" http://localhost:8000/api/v1/jobs

# Create job
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monitor News",
    "sources": ["https://example.com/news"],
    "prompt": "Monitor for market-moving news",
    "frequency_minutes": 60,
    "threshold_score": 75
  }' \
  http://localhost:8000/api/v1/jobs

# Trigger immediate job run
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  http://localhost:8000/api/v1/jobs/{job_id}/run
```

## Recent Bug Fixes

✅ **Fixed API Key Creation**: Resolved Pydantic validation error in API key endpoint
✅ **Fixed Navigation**: All tabs now maintain proper navigation state
✅ **Fixed URL Routing**: Browser back/forward buttons now work correctly
✅ **Fixed Duplicate Elements**: Removed duplicate API navigation buttons
✅ **Fixed Settings View**: Settings now maintains navigation tabs instead of separate view

## Development Status

🚀 **Production Ready**: Core monitoring system with full API access
🔧 **Active Development**: Continuous improvements and feature additions
📊 **Real-time Monitoring**: Live dashboard with comprehensive job management
🛡️ **Secure**: Enterprise-grade security with proper authentication and rate limiting
