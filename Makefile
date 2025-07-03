# Development commands
.PHONY: build up down logs clean

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

# Check service health
health:
	@echo "Checking service health..."
	@curl -s http://localhost:8000/health | jq .
	@curl -s http://localhost:8001/health | jq .
	@curl -s http://localhost:8002/health | jq .
