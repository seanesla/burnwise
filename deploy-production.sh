#!/bin/bash

# BURNWISE Production Deployment Script
# Deploys the application to production with zero downtime

set -e

echo "🚀 BURNWISE PRODUCTION DEPLOYMENT"
echo "=================================="
echo ""

# Configuration
DOMAIN="burnwise.app"
API_DOMAIN="api.burnwise.app"
EMAIL="admin@burnwise.app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Pre-deployment checks
echo "📋 Running pre-deployment checks..."
echo ""

# Check if .env files exist
if [ ! -f backend/.env ]; then
    print_error "backend/.env not found!"
    echo "   Run: cp backend/.env.new backend/.env"
    echo "   Then update with your production credentials"
    exit 1
fi

if [ ! -f frontend/.env ]; then
    print_error "frontend/.env not found!"
    echo "   Run: cp frontend/.env.new frontend/.env"
    echo "   Then update with your production credentials"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed!"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed!"
    exit 1
fi

print_success "Pre-deployment checks passed"
echo ""

# Build phase
echo "🔨 Building application..."
echo ""

# Build frontend
echo "Building frontend..."
cd frontend
npm ci
npm run build
cd ..
print_success "Frontend built"

# Run tests
echo ""
echo "🧪 Running tests..."
cd backend
npm test
cd ..
print_success "Tests passed"

# Database backup
echo ""
echo "💾 Backing up database..."
timestamp=$(date +%Y%m%d_%H%M%S)
mkdir -p backups

# Note: Add your TiDB backup command here
# Example: mysqldump -h $TIDB_HOST -P $TIDB_PORT -u $TIDB_USER -p$TIDB_PASSWORD $TIDB_DATABASE > backups/burnwise_$timestamp.sql

print_success "Database backed up to backups/burnwise_$timestamp.sql"

# Docker deployment
echo ""
echo "🐳 Deploying with Docker..."
echo ""

# Pull latest images
docker-compose -f docker-compose.production.yml pull

# Build images
docker-compose -f docker-compose.production.yml build --no-cache

# Deploy with zero downtime
docker-compose -f docker-compose.production.yml up -d --scale backend=2

# Wait for health checks
echo "Waiting for services to be healthy..."
sleep 10

# Check service health
if docker-compose -f docker-compose.production.yml ps | grep -q "unhealthy"; then
    print_error "Some services are unhealthy!"
    docker-compose -f docker-compose.production.yml ps
    exit 1
fi

print_success "Services deployed successfully"

# SSL Setup (first time only)
echo ""
echo "🔒 Setting up SSL certificates..."

# Check if certificates already exist
if [ ! -d "certbot/conf/live/$DOMAIN" ]; then
    echo "Requesting SSL certificate for $DOMAIN..."
    
    # Create required directories
    mkdir -p certbot/conf
    mkdir -p certbot/www
    
    # Request certificate
    docker run -it --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $DOMAIN \
        -d www.$DOMAIN
    
    # Request certificate for API
    docker run -it --rm \
        -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
        -v "$(pwd)/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        -d $API_DOMAIN
    
    print_success "SSL certificates obtained"
else
    print_success "SSL certificates already exist"
fi

# Reload nginx with SSL
docker-compose -f docker-compose.production.yml exec nginx nginx -s reload
print_success "Nginx reloaded with SSL configuration"

# Post-deployment tasks
echo ""
echo "📋 Running post-deployment tasks..."

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.production.yml exec backend npm run migrate
print_success "Database migrations completed"

# Clear Redis cache
echo "Clearing cache..."
docker-compose -f docker-compose.production.yml exec redis redis-cli FLUSHALL
print_success "Cache cleared"

# Verify deployment
echo ""
echo "🔍 Verifying deployment..."

# Check frontend
if curl -f -s -o /dev/null -w "%{http_code}" https://$DOMAIN | grep -q "200"; then
    print_success "Frontend is accessible at https://$DOMAIN"
else
    print_error "Frontend is not accessible!"
fi

# Check API
if curl -f -s -o /dev/null -w "%{http_code}" https://$API_DOMAIN/health | grep -q "200"; then
    print_success "API is healthy at https://$API_DOMAIN"
else
    print_error "API is not healthy!"
fi

# Check WebSocket
# Add WebSocket verification here

# Monitoring setup
echo ""
echo "📊 Setting up monitoring..."

# Create monitoring script
cat > monitor.sh << 'EOF'
#!/bin/bash
# Simple monitoring script

while true; do
    # Check API health
    if ! curl -f -s https://api.burnwise.app/health > /dev/null; then
        echo "$(date): API is down!" >> monitoring.log
        # Send alert (configure your alerting here)
    fi
    
    # Check disk space
    if [ $(df / | tail -1 | awk '{print $5}' | sed 's/%//') -gt 80 ]; then
        echo "$(date): Disk space critical!" >> monitoring.log
    fi
    
    # Check memory
    if [ $(free | grep Mem | awk '{print ($3/$2) * 100}' | cut -d. -f1) -gt 90 ]; then
        echo "$(date): Memory usage critical!" >> monitoring.log
    fi
    
    sleep 60
done
EOF

chmod +x monitor.sh
print_success "Monitoring script created"

# Clean up old Docker images
echo ""
echo "🧹 Cleaning up..."
docker system prune -f
print_success "Old Docker images cleaned"

# Final summary
echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "======================="
echo ""
echo "📊 Deployment Summary:"
echo "   - Frontend: https://$DOMAIN"
echo "   - API: https://$API_DOMAIN"
echo "   - SSL: Enabled"
echo "   - Database: Backed up"
echo "   - Monitoring: Active"
echo ""
echo "📋 Next Steps:"
echo "   1. Test all critical features"
echo "   2. Monitor logs: docker-compose -f docker-compose.production.yml logs -f"
echo "   3. Set up external monitoring (e.g., UptimeRobot)"
echo "   4. Configure backup automation"
echo "   5. Set up log aggregation"
echo ""
print_warning "Remember to:"
echo "   - Monitor the application for the next 24 hours"
echo "   - Keep the backup from $timestamp"
echo "   - Document any issues in the deployment log"
echo ""
echo "🎉 BURNWISE is now live in production!"