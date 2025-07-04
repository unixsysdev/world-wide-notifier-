.PHONY: build up down logs clean generate-keys prod-setup health

# Build all services
build:
	docker-compose build

# Start all services
up:
	docker-compose up -d

# Stop all services
down:
	docker-compose down

# View logs
logs:
	docker-compose logs -f

# Clean up everything
clean:
	docker-compose down -v
	docker system prune -f

# Development mode (with file watching)
dev:
	docker-compose up

# Initialize database
init-db:
	docker-compose exec postgres psql -U monitoring_user -d monitoring_db -f /docker-entrypoint-initdb.d/init.sql

# Generate secure keys for production
generate-keys:
	@echo "# Add these to your .env file for production:"
	@echo "JWT_SECRET=$$(openssl rand -base64 32)"
	@echo "INTERNAL_API_KEY=$$(openssl rand -base64 32)"

# Production setup helper
prod-setup:
	@echo "🚀 Production Setup Instructions:"
	@echo ""
	@echo "1. Generate secure keys:"
	@echo "   make generate-keys"
	@echo ""
	@echo "2. Create .env file:"
	@echo "   cp .env.example .env"
	@echo "   nano .env"
	@echo ""
	@echo "3. Set production values in .env:"
	@echo "   HOSTNAME=mon.duckerhub.com"
	@echo "   API_URL=https://mon.duckerhub.com/api"
	@echo "   JWT_SECRET=your_generated_secret"
	@echo "   INTERNAL_API_KEY=your_generated_key"
	@echo "   # ... add your other API keys"
	@echo ""
	@echo "4. Setup nginx:"
	@echo "   sudo ./setup-nginx.sh"
	@echo ""
	@echo "5. Start services:"
	@echo "   make up"
	@echo ""
	@echo "6. Test:"
	@echo "   curl https://mon.duckerhub.com/api/health"

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost:8000/health | jq . || echo "❌ API Service not responding"
	@curl -s http://localhost:8001/health | jq . || echo "❌ Browser Service not responding"
	@curl -s http://localhost:8002/health | jq . || echo "❌ LLM Service not responding"

# Run E2E tests
test:
	docker-compose --profile test build test_service
	docker-compose --profile test run --rm test_service

# Watch test logs
test-logs:
	docker-compose --profile test logs -f test_service
