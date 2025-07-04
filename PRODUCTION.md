# Production Deployment Guide

## 🚀 Environment Variables for Production

### **Required Changes for Production:**

```bash
# Frontend URL (your domain)
FRONTEND_URL=https://mon.duckerhub.com

# API URL (your domain + API path)
API_URL=https://mon.duckerhub.com/api

# Hostname (your domain without protocol)
HOSTNAME=mon.duckerhub.com
```

### **Database Configuration:**
```bash
# Production database URL
DATABASE_URL=postgresql://username:password@your-db-host:5432/monitoring_db

# Production Redis URL
REDIS_URL=redis://username:password@your-redis-host:6379
```

### **Complete Production .env Template:**
```bash
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_production_google_client_id
GOOGLE_CLIENT_SECRET=your_production_google_client_secret

# AI Service API Keys
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_key

# Email Configuration
SENDGRID_API_KEY=your_sendgrid_api_key
NOTIFICATION_EMAIL=notifications@mon.duckerhub.com

# Teams Webhook (optional)
TEAMS_WEBHOOK=your_teams_webhook_url

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PREMIUM_PRICE_ID=price_your_premium_price_id
STRIPE_PREMIUM_PLUS_PRICE_ID=price_your_premium_plus_price_id

# Production URLs
FRONTEND_URL=https://mon.duckerhub.com
API_URL=https://mon.duckerhub.com/api
HOSTNAME=mon.duckerhub.com

# Database & Redis
DATABASE_URL=postgresql://username:password@your-db-host:5432/monitoring_db
REDIS_URL=redis://username:password@your-redis-host:6379

# Security
JWT_SECRET=your_very_secure_jwt_secret_minimum_32_characters
INTERNAL_API_KEY=your_very_secure_internal_api_key_minimum_32_characters
```

## 🔒 Security Checklist

- [ ] Use HTTPS URLs only
- [ ] Generate secure JWT_SECRET (32+ characters)
- [ ] Generate secure INTERNAL_API_KEY (32+ characters)
- [ ] Use production Stripe keys (pk_live_, sk_live_)
- [ ] Set up proper database security
- [ ] Configure Redis security
- [ ] Set up proper CORS in production

## 🌐 Nginx Configuration Example

```nginx
server {
    listen 80;
    server_name mon.duckerhub.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name mon.duckerhub.com;
    
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;
    
    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 📦 Deployment Steps

1. **Copy environment file:**
   ```bash
   cp .env.example .env
   # Edit .env with production values
   ```

2. **Build and deploy:**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

3. **Initialize database:**
   ```bash
   make init-db
   ```

4. **Verify health:**
   ```bash
   curl https://mon.duckerhub.com/api/health
   ```

## ⚠️ Important Notes

- **No localhost references** remain in the codebase
- All URLs are configurable via environment variables
- Frontend automatically uses API_URL from environment
- Stripe URLs dynamically use FRONTEND_URL
- Database and Redis URLs are configurable
