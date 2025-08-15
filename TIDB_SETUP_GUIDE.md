# 🔥 BURNWISE TiDB Setup Guide - REAL DATABASE

## ⚡ Quick Setup (5 minutes)

### Step 1: Get TiDB Serverless (FREE)

1. **Go to TiDB Cloud:**
   ```
   https://tidbcloud.com
   ```

2. **Sign Up/Login** (use GitHub for instant access)

3. **Create Serverless Cluster:**
   - Click "Create Cluster"
   - Choose "Serverless" (FREE tier)
   - Select region closest to you
   - Name it "burnwise-hackathon"

4. **Get Connection Details:**
   - Click on your cluster
   - Click "Connect" button
   - Select "General" tab
   - Click "Generate Password"
   - **SAVE ALL THESE VALUES!**

### Step 2: Configure BURNWISE

Run our setup wizard:
```bash
cd backend
npm run setup
```

This will:
- ✅ Ask for your TiDB credentials
- ✅ Get required API keys
- ✅ Test the connection
- ✅ Create .env file

### Step 3: Create Database Tables

```bash
npm run setup:db
```

This creates:
- 128-dim weather vectors with HNSW index
- 64-dim smoke plume vectors with HNSW index  
- 32-dim burn embeddings with HNSW index
- All required tables for 5-agent workflow

### Step 4: Seed Demo Data

```bash
npm run seed
```

Populates:
- 5 farms in California
- 10+ burn fields
- Sample burn requests
- Weather data with vectors
- Test alerts

### Step 5: Start the System

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend  
cd frontend
npm start
```

## 🔑 API Keys Required

### OpenWeatherMap (REQUIRED)
1. Go to: https://openweathermap.org/api
2. Sign up (FREE)
3. Get API key from dashboard

### Twilio (Optional for SMS)
1. Go to: https://www.twilio.com
2. Sign up for trial
3. Get SID, Token, Phone Number

### OpenAI (Optional for embeddings)
1. Go to: https://platform.openai.com
2. Get API key

## 📊 Verify Setup

### Test Database Connection:
```bash
cd backend
node -e "require('./setup-database.js').setupDatabase()"
```

### Test Vector Functions:
```sql
SELECT VEC_COSINE_DISTANCE('[1,2,3]', '[4,5,6]') as test;
```

### Check Tables:
```sql
SHOW TABLES;
```

Should show:
- weather_vectors (128-dim)
- smoke_plume_vectors (64-dim)
- burn_embeddings (32-dim)
- Plus 9 other tables

## 🚨 Troubleshooting

### Connection Failed: ENOTFOUND
- **Cause:** Wrong host or cluster paused
- **Fix:** Check cluster is active in TiDB Cloud console

### Authentication Failed
- **Cause:** Wrong username/password
- **Fix:** Regenerate password in TiDB Cloud

### SSL/TLS Error
- **Cause:** SSL not configured
- **Fix:** Our setup handles this automatically

### Vector Functions Not Working
- **Cause:** Using wrong TiDB version
- **Fix:** Must use TiDB Serverless (not Dedicated)

## 🎯 Manual .env Setup

If automated setup fails, create `backend/.env`:

```env
# TiDB Serverless
TIDB_HOST=gateway01.us-west-2.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=3pTAoNNegb47Uc8.root
TIDB_PASSWORD=your-password-here
TIDB_DATABASE=burnwise

# Weather API (Required)
OPENWEATHERMAP_API_KEY=your-api-key

# SMS (Optional)
TWILIO_ACCOUNT_SID=optional
TWILIO_AUTH_TOKEN=optional
TWILIO_PHONE_NUMBER=+1234567890

# JWT (Generate with: openssl rand -hex 32)
JWT_SECRET=generate-32-char-hex
JWT_REFRESH_SECRET=generate-32-char-hex

# Server
PORT=5001
NODE_ENV=development
LOG_LEVEL=info
```

## 🏁 Verification Checklist

- [ ] TiDB cluster created and active
- [ ] Connection test passes
- [ ] All tables created
- [ ] Vector functions work
- [ ] Seed data inserted
- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] Can submit burn request
- [ ] 5-agent workflow executes
- [ ] Vector search returns results

## 🚀 Performance Tips

1. **Connection Pooling:** Already configured for 30 connections
2. **Query Cache:** Built-in 1-minute cache for SELECTs
3. **Circuit Breaker:** Prevents cascade failures
4. **HNSW Indexes:** Fast vector similarity search

## 📞 Support

If setup fails:
1. Check this guide first
2. Verify all credentials
3. Ensure cluster is active
4. Check firewall/network

---

**Time to Complete:** 5-10 minutes

**Result:** Real TiDB with real vector search - NO MOCKS! 🔥