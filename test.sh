# Quick Production Test Commands
# Run these individually to test specific functionality

# 1. Health Check
curl -s https://mon.duckerhub.com/api/api/health | jq .

# 2. Test API Key Authentication
curl -H "Authorization: Bearer ak_live_9U2jGYlAfxYabP4QrGboM47yNYnOsTuxF6HCIaP2PBY" https://mon.duckerhub.com/api/api/v1/jobs

# 3. Test Invalid API Key (should return 401)
curl -H "Authorization: Bearer invalid_key" https://mon.duckerhub.com/api/api/v1/jobs

# 4. Create a Simple Test Job
curl -X POST \
  -H "Authorization: Bearer ak_live_9U2jGYlAfxYabP4QrGboM47yNYnOsTuxF6HCIaP2PBY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Quick Test", "sources": ["https://httpbin.org/json"], "prompt": "Test monitoring", "frequency_minutes": 60, "threshold_score": 50}' \
  https://mon.duckerhub.com/api/api/v1/jobs

# 5. Check Web UI (should load)
curl -s https://mon.duckerhub.com | head -10

# 6. Test OpenAPI Documentation
curl -s https://mon.duckerhub.com/api/api/docs | head -10

# 7. Test Service Health Endpoints
curl -s https://mon.duckerhub.com/api/api/health
curl -s https://mon.duckerhub.com:8001/health  # Browser service
curl -s https://mon.duckerhub.com:8002/health  # LLM service

# 8. Test Rate Limiting (run multiple times quickly)
for i in {1..10}; do curl -s -w "HTTP %{http_code} " -H "Authorization: Bearer ak_live_9U2jGYlAfxYabP4QrGboM47yNYnOsTuxF6HCIaP2PBY" https://mon.duckerhub.com/api/api/v1/jobs -o /dev/null; done
