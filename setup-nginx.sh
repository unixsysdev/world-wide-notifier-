#!/bin/bash
# Updated nginx setup script for mon.duckerhub.com with /api routing
# Run this script as root or with sudo
set -e  # Exit on any error

DOMAIN="mon.duckerhub.com"
FRONTEND_PORT="3000"
API_PORT="8000"

echo "🚀 Setting up nginx configuration for $DOMAIN with /api routing..."

# Step 1: Create nginx configuration with /api routing
echo "📝 Creating nginx configuration with /api routing..."
cat > /etc/nginx/sites-available/$DOMAIN << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name mon.duckerhub.com;
    return 301 https://$server_name$request_uri;
}

# Main HTTPS server
server {
    listen 443 ssl http2;
    server_name mon.duckerhub.com;
    
    # SSL configuration (will be updated by certbot)
    ssl_certificate /etc/letsencrypt/live/mon.duckerhub.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mon.duckerhub.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # API routes - proxy to backend
    location /api {
        # Remove /api prefix when forwarding to backend
        rewrite ^/api/(.*)$ /$1 break;
        
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Handle WebSocket connections
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # CORS headers for API
        add_header Access-Control-Allow-Origin "https://mon.duckerhub.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-Internal-API-Key" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://mon.duckerhub.com";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,X-Internal-API-Key";
            add_header Access-Control-Allow-Credentials "true";
            add_header Access-Control-Max-Age 1728000;
            add_header Content-Type 'text/plain; charset=utf-8';
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # Frontend routes - proxy to React app
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # Handle WebSocket connections (for React dev server)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Handle React Router (SPA routing)
        try_files $uri $uri/ @fallback;
    }
    
    # Fallback for React Router
    location @fallback {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

echo "✅ Nginx configuration created with /api routing"

# Step 2: Enable the site
echo "🔗 Enabling the site..."
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/

# Step 3: Test nginx configuration
echo "🧪 Testing nginx configuration..."
nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
else
    echo "❌ Nginx configuration error - please check"
    exit 1
fi

# Step 4: Reload nginx
echo "🔄 Reloading nginx..."
systemctl reload nginx

# Step 5: Check if services are running
echo "🔍 Checking if services are running..."
if netstat -tlnp | grep :$FRONTEND_PORT > /dev/null; then
    echo "✅ Frontend app is running on port $FRONTEND_PORT"
else
    echo "⚠️  Warning: No frontend app found running on port $FRONTEND_PORT"
fi

if netstat -tlnp | grep :$API_PORT > /dev/null; then
    echo "✅ API service is running on port $API_PORT"
else
    echo "⚠️  Warning: No API service found running on port $API_PORT"
fi

echo ""
echo "🎉 Nginx setup complete!"
echo ""
echo "📋 Current routing:"
echo "   https://$DOMAIN/       → Frontend (port $FRONTEND_PORT)"
echo "   https://$DOMAIN/api/*  → API (port $API_PORT)"
echo ""
echo "🔧 Test your setup:"
echo "   Frontend: curl -I https://$DOMAIN"
echo "   API:      curl -I https://$DOMAIN/api/health"
echo ""
echo "📋 Next steps:"
echo "1. Make sure your services are running:"
echo "   docker-compose up -d"
echo "2. Test the routing:"
echo "   curl https://$DOMAIN/api/health"
echo "3. Check logs if needed:"
echo "   tail -f /var/log/nginx/error.log"
