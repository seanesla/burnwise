# 🚀 BURNWISE Setup Guide

Complete setup guide for running BURNWISE locally or in production.

## 📋 Prerequisites

### System Requirements
- **Node.js**: Version 16.0.0 or higher
- **npm**: Version 7.0.0 or higher  
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk**: 2GB free space
- **OS**: Windows 10+, macOS 10.15+, or Linux

### Required Accounts
1. **TiDB Cloud** account (free tier)
2. **OpenWeatherMap** account (free tier)
3. **Mapbox** account (free tier)
4. **Twilio** account (optional, for SMS)

## 🛠️ Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/[your-username]/burnwise.git
cd burnwise
```

### 2. Install Dependencies
```bash
# Install all dependencies for frontend and backend
npm run install:all

# Or manually:
npm install
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configure Environment Variables

#### Backend Configuration
Create `backend/.env`:
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` with your credentials:
```env
# TiDB Connection (REQUIRED)
TIDB_HOST=your-cluster.tidb.cloud
TIDB_PORT=4000
TIDB_USER=your-username.root
TIDB_PASSWORD=your-password
TIDB_DATABASE=burnwise

# API Keys (REQUIRED)
OPENWEATHERMAP_API_KEY=your-openweather-api-key

# SMS Alerts (OPTIONAL)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Server Configuration
PORT=5001
NODE_ENV=development

# Security
JWT_SECRET=your-secret-key-minimum-32-characters
SESSION_SECRET=another-secret-key-minimum-32-chars

# Optional Features
ENABLE_RATE_LIMITING=true
ENABLE_CIRCUIT_BREAKER=true
LOG_LEVEL=info
```

#### Frontend Configuration
Create `frontend/.env`:
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
# Mapbox (REQUIRED)
REACT_APP_MAPBOX_TOKEN=pk.your-mapbox-public-token

# API Configuration  
REACT_APP_API_URL=http://localhost:5001
REACT_APP_SOCKET_URL=http://localhost:5001

# Optional Features
REACT_APP_ENABLE_ANIMATIONS=true
REACT_APP_ENABLE_DEBUG=false
```

### 4. Initialize Database

#### Option A: Automatic Setup (Recommended)
```bash
# From project root
npm run setup:db
```

This will:
- Create database schema
- Set up tables with vector columns
- Create indexes
- Populate sample data

#### Option B: Manual Setup
```bash
cd backend
node init-db.js        # Create schema
node seed.js           # Add sample data
```

### 5. Verify Setup
```bash
# From project root
npm run setup:check
```

Expected output:
```
✅ Node.js version OK (v18.17.0)
✅ Dependencies installed
✅ TiDB connection successful
✅ OpenWeatherMap API working
✅ Mapbox token valid
✅ Backend environment configured
✅ Frontend environment configured
✅ Database tables created
✅ Sample data loaded
```

### 6. Start the Application

#### Development Mode
```bash
# From project root - starts both frontend and backend
npm run dev
```

Or start separately:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend  
cd frontend
npm start
```

#### Production Mode
```bash
# Build frontend
cd frontend
npm run build

# Start production server
cd ..
npm start
```

Access the application:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5001
- **API Docs**: http://localhost:5001/api-docs

## 🧪 Testing the Setup

### 1. Quick Smoke Test
```bash
npm test
```

### 2. Test Core Features
1. **Create Account**: Sign up with email
2. **Submit Burn Request**: Use "Johnson Farm"
3. **Check Schedule**: View conflicts
4. **Test Optimization**: Resolve conflicts

### 3. Verify Agent Workflow
```bash
cd backend
node tests/integration/five-agent-workflow.test.js
```

## 🐳 Docker Setup (Alternative)

### Using Docker Compose
```bash
# Build and start all services
docker-compose up --build

# Or run in background
docker-compose up -d
```

### Docker Environment
Create `.env.docker`:
```env
TIDB_HOST=host.docker.internal
# ... other variables
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "Cannot connect to TiDB"
- Check firewall settings
- Verify TiDB cluster is running
- Confirm IP whitelist includes your IP
- Test connection: `mysql -h your-host -P 4000 -u user -p`

#### 2. "Module not found" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
rm -rf backend/node_modules backend/package-lock.json
rm -rf frontend/node_modules frontend/package-lock.json
npm run install:all
```

#### 3. "Port already in use"
```bash
# Find and kill process
lsof -i :5001  # Backend port
lsof -i :3000  # Frontend port
kill -9 <PID>
```

#### 4. "API key invalid"
- Wait 10 minutes after creating keys
- Remove quotes from .env values
- Check for trailing spaces

#### 5. Map not displaying
- Verify Mapbox token is public token (starts with `pk.`)
- Check browser console for errors
- Try refreshing page

### Debug Mode
Enable detailed logging:
```bash
# Backend
LOG_LEVEL=debug npm run dev

# Frontend
REACT_APP_ENABLE_DEBUG=true npm start
```

## 📊 Database Management

### Reset Database
```bash
cd backend
node scripts/reset-db.js
```

### Backup Database
```bash
cd backend
node scripts/backup-db.js
```

### View Database Stats
```bash
cd backend
node scripts/db-stats.js
```

## 🚢 Deployment

### Deploy to Vercel (Frontend)
```bash
cd frontend
npm install -g vercel
vercel
```

### Deploy to Railway (Backend)
```bash
cd backend
npm install -g @railway/cli
railway login
railway up
```

### Environment Variables for Production
Set these in your deployment platform:
- All variables from `.env` files
- Set `NODE_ENV=production`
- Use strong secrets for JWT and sessions
- Enable HTTPS only

## 📈 Performance Optimization

### Enable Caching
```env
ENABLE_REDIS=true
REDIS_URL=redis://localhost:6379
```

### Database Connection Pooling
```env
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_POOL_ACQUIRE_TIMEOUT=30000
```

### Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 🔒 Security Checklist

- [ ] Change default JWT secret
- [ ] Change default session secret  
- [ ] Enable HTTPS in production
- [ ] Set secure cookie flags
- [ ] Enable CORS properly
- [ ] Implement CSP headers
- [ ] Regular dependency updates
- [ ] API key rotation schedule

## 📞 Getting Help

### Resources
- **Documentation**: `/docs` folder
- **API Reference**: http://localhost:5001/api-docs
- **Test Coverage**: `npm run coverage`

### Common Commands
```bash
npm run dev              # Start development
npm test                # Run tests
npm run lint            # Check code style
npm run seed            # Populate sample data
npm run setup:check     # Verify setup
```

## ✅ Setup Complete!

Your BURNWISE installation is ready. Visit http://localhost:3000 to start coordinating agricultural burns safely.

### Next Steps
1. Create your first farm account
2. Submit a test burn request
3. Explore the 5-agent workflow
4. Check the analytics dashboard

---

**Need help?** Check our [troubleshooting guide](#-troubleshooting) or file an issue on GitHub.