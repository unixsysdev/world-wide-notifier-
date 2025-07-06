# World Wide Notifier

A distributed AI-powered web monitoring system that automatically tracks content changes across multiple websites and generates intelligent alerts based on custom criteria. Built with a microservices architecture for scalability and reliability.

## 🚀 **Live Demo**
**Try it now: [https://mon.duckerhub.com](https://mon.duckerhub.com)**

✅ **Fully Operational Production System**
- Real-time job processing and email notifications
- Complete API access with authentication
- Premium Plus features available
- Load tested with 100+ concurrent jobs

Sign in with Google to start monitoring your websites with AI-powered analysis!

## What It Does

**World Wide Notifier** monitors websites for specific content changes and uses AI to analyze the significance of those changes. When content meets your defined criteria, it automatically sends notifications through multiple channels (email, Teams, Slack).

### 🎯 **Perfect For**
- **Business Intelligence**: Track competitor pricing, product launches, regulatory changes
- **Content Monitoring**: News tracking, social media mentions, technical documentation updates
- **Compliance**: Regulatory filings, policy changes, legal notices
- **Marketing**: Brand monitoring, campaign tracking, industry insights
- **Development**: API changes, service status updates, technical announcements

### Key Capabilities

- **Intelligent Web Scraping**: Uses Playwright to render JavaScript-heavy sites with realistic browser fingerprinting
- **AI Content Analysis**: Leverages OpenAI/Claude to understand content meaning and score relevance
- **Multi-Channel Notifications**: Sends alerts via email, Microsoft Teams, and Slack
- **Flexible Scheduling**: Monitor sites from every minute to daily intervals
- **Historical Data**: Full execution history with raw content and AI analysis stored
- **REST API**: Complete programmatic access with API key management
- **User Authentication**: Google OAuth with tier-based access control

## Architecture

### Microservices Design
```
Frontend (React) → API Service (FastAPI) → Job Queue (Redis)
                                        ↓
Worker Manager → Browser Service (Playwright)
              → LLM Service (OpenAI/Claude)
              → Notification Service (Email/Teams/Slack)
              → Data Storage (PostgreSQL + MongoDB)
```

### Service Breakdown

| Service | Technology | Purpose |
|---------|------------|---------|
| **Frontend** | React + Tailwind | Web interface for job management |
| **API Service** | FastAPI + JWT | Authentication, job CRUD, API endpoints |
| **Browser Service** | Playwright | Web scraping with JS rendering |
| **Worker Manager** | Python + Redis | Job scheduling and execution |
| **LLM Service** | OpenAI/Claude | Content analysis and scoring |
| **Notification Service** | SMTP/Webhooks | Multi-channel alerting |
| **PostgreSQL** | - | Job metadata and user data |
| **MongoDB** | - | Raw content and historical data |
| **Redis** | - | Job queue and rate limiting |

## Quick Start

### 1. Environment Setup
```bash
# Clone and setup environment
git clone <repository>
cd world-wide-notifier
cp .env.example .env
```

### 2. Configure Environment Variables
```bash
# Required API keys and configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
OPENAI_API_KEY=your_openai_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
JWT_SECRET=your_jwt_secret
HOSTNAME=localhost  # or your domain
```

### 3. Build and Deploy
```bash
# Build all services
make build

# Start all services
make up

# Initialize database
make init-db

# Check service health
make health
```

### 4. Access the Application
- **Web Interface**: http://localhost:3000 (or https://mon.duckerhub.com for live demo)
- **API Documentation**: http://localhost:8000/docs
- **API Endpoint**: http://localhost:8000/api/v1/ (or https://mon.duckerhub.com/api/v1/ for live demo)

## API Usage

### Authentication
Create an API key in the web interface, then use it for all API calls:

```bash
export API_KEY="ak_live_your_generated_key"
```

### Example API Calls

**Production API Examples (using https://mon.duckerhub.com):**

```bash
# List all monitoring jobs
curl -H "Authorization: Bearer $API_KEY" \
  https://mon.duckerhub.com/api/v1/jobs

# Create a new monitoring job
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monitor Product Launch",
    "sources": ["https://company.com/news"],
    "prompt": "Alert when new product launches are announced",
    "frequency_minutes": 60,
    "threshold_score": 80
  }' \
  https://mon.duckerhub.com/api/v1/jobs

# Trigger immediate job execution
curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  https://mon.duckerhub.com/api/v1/jobs/{job_id}/run

# Get job execution history
curl -H "Authorization: Bearer $API_KEY" \
  https://mon.duckerhub.com/api/v1/jobs/{job_id}/runs

# Get all alerts
curl -H "Authorization: Bearer $API_KEY" \
  https://mon.duckerhub.com/api/v1/alerts
```

## Key Features

### 🤖 **AI-Powered Analysis**
- Content analysis using OpenAI GPT or Claude
- Customizable prompts for specific monitoring needs
- Scoring system (0-100) for content relevance
- Automatic duplicate detection

### 🌐 **Advanced Web Scraping**
- JavaScript rendering with Playwright
- Realistic browser fingerprinting
- Anti-detection measures
- Support for dynamic content

### 📊 **Historical Data**
- Complete execution history
- Raw HTML content storage
- LLM analysis results
- Performance metrics

### 🔐 **Security & Access Control**
- Google OAuth authentication
- API key management with rate limiting
- Tier-based access control
- User data isolation

### 🚨 **Multi-Channel Notifications**
- Email notifications via SendGrid
- Microsoft Teams webhooks
- Slack integration
- Customizable notification thresholds

## Subscription Tiers

| Feature | Free | Premium | Premium Plus |
|---------|------|---------|--------------|
| **Jobs** | 3 | 10 | Unlimited |
| **Frequency** | Hourly | 10 minute | 1 minute |
| **Alerts/Day** | 3 | 100 | Unlimited |
| **API Keys** | 2 | 5 | 10 |
| **Rate Limit** | 60/min | 120/min | 300/min |

## Development

### Development Mode
```bash
# Start in development mode with hot reload
make dev

# View logs from all services
make logs

# Clean up containers and volumes
make clean

# Check individual service health
curl http://localhost:8000/health
curl http://localhost:8001/health
curl http://localhost:8002/health
```

### Service Ports
- **Frontend**: 3000
- **API Service**: 8000
- **Browser Service**: 8001
- **LLM Service**: 8002
- **Notification Service**: 8003
- **PostgreSQL**: 5432
- **MongoDB**: 27017
- **Redis**: 6379

### Adding New Features
1. **Backend Changes**: Modify relevant service in its directory
2. **Frontend Changes**: Update React components in `frontend/src/`
3. **Database Changes**: Add migrations to `init.sql`
4. **API Changes**: Update OpenAPI documentation in FastAPI services

## Use Cases

### 1. **E-commerce Monitoring**
Monitor competitor pricing, product availability, or new product launches.

### 2. **News & Media Tracking**
Track specific topics, companies, or events across news websites.

### 3. **Regulatory Compliance**
Monitor government websites for regulatory changes affecting your industry.

### 4. **Social Media Monitoring**
Track brand mentions, sentiment, or trending topics (where APIs are available).

### 5. **Technical Documentation**
Monitor API documentation, changelogs, or technical specifications.

## Technical Details

### Data Flow
1. **Job Creation**: Users create monitoring jobs via web interface or API
2. **Scheduling**: Jobs are queued in Redis based on frequency settings
3. **Execution**: Worker Manager fetches jobs and coordinates execution
4. **Scraping**: Browser Service fetches and renders web content
5. **Analysis**: LLM Service analyzes content against custom prompts
6. **Storage**: Results stored in PostgreSQL (metadata) and MongoDB (raw data)
7. **Alerting**: Notification Service sends alerts when thresholds are met

### Scalability
- **Horizontal Scaling**: Each service can be scaled independently
- **Load Balancing**: API gateway pattern with FastAPI
- **Queue Management**: Redis-based job queue with worker pools
- **Database Sharding**: MongoDB for large historical data storage

### Monitoring & Observability
- **Health Checks**: Each service exposes health endpoints
- **Logging**: Structured logging across all services
- **Metrics**: Built-in performance monitoring
- **Error Handling**: Comprehensive error tracking and recovery

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

For issues, feature requests, or questions, please create an issue in the GitHub repository.
