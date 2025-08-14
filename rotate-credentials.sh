#!/bin/bash

# BURNWISE Credential Rotation Script
# Generates new secure credentials for all services

echo "🔐 BURNWISE CREDENTIAL ROTATION"
echo "================================"
echo ""

# Generate new secure credentials
echo "📝 Generating new secure credentials..."

# 1. JWT Secret (256-bit)
JWT_SECRET=$(openssl rand -hex 32)
echo "✅ JWT_SECRET generated (256-bit)"

# 2. Session Secret (256-bit)  
SESSION_SECRET=$(openssl rand -hex 32)
echo "✅ SESSION_SECRET generated (256-bit)"

# 3. Database Password (strong random)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
echo "✅ Database password generated"

# 4. Encryption Key (for future use)
ENCRYPTION_KEY=$(openssl rand -hex 32)
echo "✅ ENCRYPTION_KEY generated"

# Create new .env file
echo ""
echo "📄 Creating new .env configuration..."

cat > backend/.env.new << EOF
# BURNWISE Backend Configuration
# Generated: $(date)
# SECURITY: Never commit this file to git

# Server Configuration
NODE_ENV=production
PORT=5001
API_VERSION=v1

# Database Configuration (TiDB)
TIDB_HOST=[REDACTED-TIDB-HOST]
TIDB_PORT=4000
TIDB_USER=[REDACTED-TIDB-USER]
TIDB_PASSWORD=${DB_PASSWORD}
TIDB_DATABASE=burnwise_prod
TIDB_SSL=true

# Security Tokens
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=24h
REFRESH_TOKEN_EXPIRY=7d
SESSION_SECRET=${SESSION_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# Demo Mode (MUST be false in production)
DEMO_MODE=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
AUTH_RATE_LIMIT_MAX=5

# CORS Configuration
CORS_ORIGIN=https://burnwise.app
CORS_CREDENTIALS=true

# External APIs (Need to be updated manually)
OPENWEATHERMAP_API_KEY=YOUR_NEW_API_KEY_HERE
OPENAI_API_KEY=YOUR_NEW_API_KEY_HERE
TWILIO_ACCOUNT_SID=YOUR_NEW_ACCOUNT_SID_HERE
TWILIO_AUTH_TOKEN=YOUR_NEW_AUTH_TOKEN_HERE
TWILIO_PHONE_NUMBER=YOUR_TWILIO_PHONE_HERE
MAPBOX_ACCESS_TOKEN=YOUR_NEW_MAPBOX_TOKEN_HERE

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=YOUR_EMAIL_HERE
SMTP_PASS=YOUR_APP_PASSWORD_HERE
EMAIL_FROM=noreply@burnwise.app

# Monitoring (optional)
SENTRY_DSN=
LOGTAIL_TOKEN=
EOF

echo "✅ New .env template created at backend/.env.new"
echo ""

# Create production config
cat > backend/.env.production << EOF
# Production Environment Variables
# Copy this to .env in production server

NODE_ENV=production
DEMO_MODE=false
CORS_ORIGIN=https://burnwise.app
TIDB_SSL=true
EOF

echo "✅ Production config created at backend/.env.production"
echo ""

# Update frontend .env
cat > frontend/.env.new << EOF
# BURNWISE Frontend Configuration
# Generated: $(date)

# API Configuration
REACT_APP_API_URL=https://api.burnwise.app
REACT_APP_WS_URL=wss://api.burnwise.app

# Map Configuration
REACT_APP_MAPBOX_TOKEN=YOUR_NEW_MAPBOX_TOKEN_HERE

# Features
REACT_APP_ENABLE_ANALYTICS=true
REACT_APP_ENABLE_NOTIFICATIONS=true

# Build Configuration
GENERATE_SOURCEMAP=false
EOF

echo "✅ New frontend .env template created at frontend/.env.new"
echo ""

# Display generated credentials securely
echo "🔑 NEW CREDENTIALS GENERATED:"
echo "=============================="
echo ""
echo "JWT_SECRET:"
echo "${JWT_SECRET}"
echo ""
echo "SESSION_SECRET:"
echo "${SESSION_SECRET}"
echo ""
echo "DB_PASSWORD:"
echo "${DB_PASSWORD}"
echo ""
echo "ENCRYPTION_KEY:"
echo "${ENCRYPTION_KEY}"
echo ""

echo "⚠️  IMPORTANT NEXT STEPS:"
echo "========================="
echo ""
echo "1. UPDATE EXTERNAL SERVICES:"
echo "   - Generate new OpenWeatherMap API key"
echo "   - Generate new OpenAI API key"
echo "   - Generate new Twilio credentials"
echo "   - Generate new Mapbox token"
echo ""
echo "2. UPDATE TIDB PASSWORD:"
echo "   - Log into TiDB Cloud Console"
echo "   - Update password to: ${DB_PASSWORD}"
echo "   - Test connection with new password"
echo ""
echo "3. BACKUP OLD CONFIGURATION:"
echo "   cp backend/.env backend/.env.backup"
echo "   cp frontend/.env frontend/.env.backup"
echo ""
echo "4. APPLY NEW CONFIGURATION:"
echo "   cp backend/.env.new backend/.env"
echo "   cp frontend/.env.new frontend/.env"
echo ""
echo "5. TEST EVERYTHING:"
echo "   npm run test"
echo "   npm run test:integration"
echo "   npm run test:security"
echo ""
echo "6. CLEAN GIT HISTORY (after backup):"
echo "   ./clean-git-history.sh"
echo ""

echo "📋 Credentials saved to:"
echo "   - backend/.env.new"
echo "   - frontend/.env.new"
echo ""
echo "⚠️  Keep these credentials secure and never commit them!"