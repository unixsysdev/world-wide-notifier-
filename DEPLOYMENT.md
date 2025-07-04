# 🚀 Production Deployment Guide

## Quick Production Setup

### 1. **Generate Secure Keys**
```bash
make generate-keys
```

### 2. **Create Environment File**
```bash
cp .env.example .env
nano .env
```

**Production .env settings:**
```bash
# Deployment
HOSTNAME=mon.duckerhub.com
API_URL=https://mon.duckerhub.com/api

# Security (use generated keys)
JWT_SECRET=your_generated_jwt_secret_32_chars
INTERNAL_API_KEY=your_generated_internal_api_key_32_chars

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email
SENDGRID_API_KEY=your_sendgrid_api_key
NOTIFICATION_EMAIL=your_email@domain.com

# Optional
TEAMS_WEBHOOK=your_teams_webhook_url
```

### 3. **Setup Nginx (Run as root)**
```bash
sudo ./setup-nginx.sh
```

### 4. **Start Services**
```bash
make up
```

### 5. **Test Everything**
```bash
# Test frontend
curl -I https://mon.duckerhub.com

# Test API
curl https://mon.duckerhub.com/api/health

# Test authentication
curl https://mon.duckerhub.com/api/auth/me
```

## 🔒 Security Architecture

```
Internet → [Nginx] → [Frontend:3000] (/)
                  → [API:8000] (/api/*)
                      ↓ (Internal API Keys)
                  [Browser][LLM][Notification][DB][Redis]
                      ↑ (All Internal - No External Access)
```

## 📍 URL Structure

- **Frontend**: `https://mon.duckerhub.com/`
- **API**: `https://mon.duckerhub.com/api/*`
- **Login**: `https://mon.duckerhub.com/api/auth/google`
- **Health Check**: `https://mon.duckerhub.com/api/health`

## 🔧 Local Development

For local development, use:
```bash
# .env for local
HOSTNAME=localhost
API_URL=http://localhost:8000

# Start services
make up
```

- **Frontend**: `http://localhost:3000`
- **API**: `http://localhost:8000`

## 🧪 Testing Commands

```bash
# Check all services
make health

# View logs
make logs

# Stop services
make down

# Clean everything
make clean
```

## 🚨 Troubleshooting

### Service Not Starting
```bash
# Check logs
docker-compose logs service_name

# Restart specific service
docker-compose restart service_name
```

### Nginx Issues
```bash
# Check nginx status
sudo systemctl status nginx

# Test nginx config
sudo nginx -t

# View nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues
```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew
```

## 📋 Maintenance

### Update Application
```bash
git pull origin main
make down
make build
make up
```

### Backup Database
```bash
docker-compose exec postgres pg_dump -U monitoring_user monitoring_db > backup.sql
```

### Monitor Resources
```bash
# Check container resources
docker stats

# Check disk usage
docker system df
```

## 🎯 Single Deployment Model

This setup uses **one secure docker-compose.yml** for both local and production:

- **Local**: Set `HOSTNAME=localhost` and `API_URL=http://localhost:8000`
- **Production**: Set `HOSTNAME=mon.duckerhub.com` and `API_URL=https://mon.duckerhub.com/api`

No need for multiple docker-compose files - just change environment variables!
