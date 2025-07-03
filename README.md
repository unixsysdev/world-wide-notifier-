# AI Monitoring System

A comprehensive AI-powered monitoring system that tracks multiple sources and generates intelligent alerts based on custom criteria.

## Architecture

- **Frontend**: React app with Tailwind CSS
- **API Service**: FastAPI backend with Google Auth
- **Browser Service**: Playwright-based realistic web scraping
- **Worker Manager**: Job scheduling and processing
- **LLM Service**: OpenAI/Claude integration for content analysis
- **Notification Service**: Multi-channel alerting (Email, Slack, etc.)
- **Database**: PostgreSQL for persistence
- **Queue**: Redis for job management

## Quick Start

1. **Setup Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
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
   - Frontend: http://duckerhub.com:3000
   - API: http://duckerhub.com:8000
   - API Docs: http://duckerhub.com:8000/docs

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
- Email and Slack notifications
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

## Configuration

See `.env` for required environment variables:
- Google OAuth credentials
- OpenAI/Anthropic API keys
- SMTP configuration
- Slack webhook URLs

## Next Steps

1. Add Google OAuth integration
2. Implement user management
3. Add more notification channels
4. Enhance source validation
5. Add monitoring dashboard
6. Implement rate limiting
7. Add source health monitoring
