# 🔒 Security Configuration Guide

## Overview
This guide explains the security measures implemented in the production deployment to protect your AI monitoring system.

## 🚨 Critical Security Changes

### Before (Insecure)
- **All services exposed** on public ports (8000, 8001, 8002, 8003)
- **No authentication** between services
- **Frontend calling internal services directly**
- **Anyone could access internal APIs**

### After (Secure)
- **Only 2 services exposed**: API (8000) and Frontend (3000)
- **Internal API key authentication** for service-to-service communication
- **All internal services hidden** behind Docker networking
- **Proxy endpoints** for secure communication

## 🛡️ Security Architecture

```
Internet
    ↓
[Frontend:3000] ←→ [API Service:8000]
                        ↓ (Internal API Key)
    [Browser Service] ←→ [LLM Service] ←→ [Notification Service]
                        ↓
                   [PostgreSQL] ←→ [Redis]
```

## 🔐 Authentication Layers

### 1. User Authentication
- **Google OAuth 2.0** for user login
- **JWT tokens** for API authentication
- **User-specific data isolation**

### 2. Service-to-Service Authentication
- **Internal API keys** for service communication
- **X-Internal-API-Key header** validation
- **Protected internal endpoints**

## 🚀 Production Deployment

### 1. Environment Setup
```bash
# Copy environment file
cp .env.example .env

# Generate secure keys
make generate-keys

# Edit .env with your values
nano .env
```

### 2. Required Environment Variables
```bash
# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# API Keys
OPENAI_API_KEY=your_openai_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
NOTIFICATION_EMAIL=your_notification_email

# Security Keys (generate with: openssl rand -base64 32)
JWT_SECRET=your_secure_jwt_secret_32_chars
INTERNAL_API_KEY=your_internal_api_key_32_chars

# Deployment
HOSTNAME=mon.duckerhub.com
```

### 3. Deploy to Production
```bash
# Build production images
make prod-build

# Start production services
make prod-up

# Check health
make prod-health
```

## 🔒 Security Features

### External Access Control
- **Only ports 3000 and 8000 exposed** to internet
- **All other services internal-only**
- **No direct access to databases or internal APIs**

### Internal Communication Security
- **Internal API keys** for service authentication
- **Request validation** on all internal endpoints
- **Error handling** without information leakage

### Data Protection
- **User data isolation** (each user sees only their jobs)
- **JWT token validation** for all user endpoints
- **Secure session management**

## 🚨 Security Checklist

### Before Going Live
- [ ] **Change all default passwords**
- [ ] **Generate secure JWT_SECRET** (32+ characters)
- [ ] **Generate secure INTERNAL_API_KEY** (32+ characters)
- [ ] **Configure Google OAuth** with correct callback URLs
- [ ] **Set up SendGrid** with proper API key
- [ ] **Configure firewall** to only allow ports 80, 443, 22, 3000, 8000
- [ ] **Set up SSL/TLS** with Let's Encrypt or similar
- [ ] **Configure backup** for PostgreSQL database
- [ ] **Set up monitoring** and alerting
- [ ] **Test all authentication flows**

### Network Security
```bash
# Only allow necessary ports
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw allow 3000   # Frontend
sudo ufw allow 8000   # API
sudo ufw --force enable
```

### SSL/TLS Setup (with nginx)
```nginx
server {
    listen 80;
    server_name mon.duckerhub.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name mon.duckerhub.com;
    
    ssl_certificate /etc/letsencrypt/live/mon.duckerhub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mon.duckerhub.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔍 Security Monitoring

### Log Files to Monitor
- **Authentication failures**: Check API service logs
- **Invalid API key attempts**: Check internal service logs
- **Unusual traffic patterns**: Monitor access logs

### Health Checks
```bash
# Check service health
make prod-health

# Check logs for security events
make prod-logs | grep -i "unauthorized\|invalid\|error"
```

## 🆘 Security Incident Response

### If Security Breach Suspected
1. **Immediately change all API keys**
2. **Revoke all JWT tokens** (change JWT_SECRET)
3. **Check logs** for unauthorized access
4. **Update Google OAuth settings**
5. **Review user accounts** for suspicious activity

### Emergency Commands
```bash
# Stop all services immediately
make prod-down

# Change security keys
make generate-keys

# Restart with new keys
make prod-up
```

## 🔐 Best Practices

### For Production
- **Use strong, unique passwords**
- **Enable 2FA** on all admin accounts
- **Regular security updates**
- **Monitor logs daily**
- **Backup database regularly**
- **Use HTTPS everywhere**

### For Development
- **Never commit secrets** to git
- **Use different keys** for dev/prod
- **Regular dependency updates**
- **Code security reviews**

## 🛠️ Troubleshooting

### Common Issues
1. **"Invalid internal API key"** - Check INTERNAL_API_KEY in .env
2. **"Google OAuth failed"** - Check GOOGLE_CLIENT_ID/SECRET
3. **"Service not responding"** - Check if service is running internally
4. **"Database connection failed"** - Check PostgreSQL container

### Debug Commands
```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check internal connectivity
docker-compose -f docker-compose.prod.yml exec api_service ping browser_service

# Check logs
docker-compose -f docker-compose.prod.yml logs service_name
```

Remember: **Security is an ongoing process, not a one-time setup!**
