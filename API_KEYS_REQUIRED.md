# 🔑 API Keys Required for BURNWISE

This document explains all API keys needed to run BURNWISE and how to obtain them.

## 📋 Required API Keys

### 1. TiDB Serverless (REQUIRED)
**Purpose**: Database for all application data and vector operations

**How to obtain**:
1. Visit https://tidbcloud.com
2. Sign up for free account
3. Create a new Serverless cluster
4. Click "Connect" → "General"
5. Copy connection details

**Where to add**: `backend/.env`
```env
TIDB_HOST=gateway01.us-west-2.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USER=your-username.root
TIDB_PASSWORD=your-password
TIDB_DATABASE=burnwise
```

**Free Tier**: Yes - 25 GB storage, 250 million requests/month

---

### 2. OpenWeatherMap API (REQUIRED)
**Purpose**: Real-time weather data for burn condition analysis

**How to obtain**:
1. Visit https://openweathermap.org/api
2. Sign up for free account
3. Go to "API keys" tab in your account
4. Generate new API key (active in 10 min)

**Where to add**: `backend/.env`
```env
OPENWEATHERMAP_API_KEY=your-api-key-here
```

**Free Tier**: Yes - 1,000 calls/day, 60 calls/minute

---

### 3. Mapbox Token (REQUIRED)
**Purpose**: Interactive map visualization for farms and burn areas

**How to obtain**:
1. Visit https://account.mapbox.com/auth/signup/
2. Create free account
3. Go to "Tokens" page
4. Copy default public token or create new one

**Where to add**: `frontend/.env`
```env
REACT_APP_MAPBOX_TOKEN=pk.your-mapbox-token-here
```

**Free Tier**: Yes - 50,000 map loads/month

---

### 4. Twilio (OPTIONAL)
**Purpose**: SMS alerts to farmers about burn schedules

**How to obtain**:
1. Visit https://www.twilio.com/try-twilio
2. Sign up for free trial account
3. Verify your phone number
4. Get Account SID and Auth Token from Console
5. Get a Twilio phone number (free with trial)

**Where to add**: `backend/.env`
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

**Free Tier**: Yes - $15 trial credit, ~300 SMS messages

**Note**: Application works without Twilio - alerts shown in UI instead

---

### 5. OpenAI API (OPTIONAL)
**Purpose**: Generate embeddings for enhanced vector search

**How to obtain**:
1. Visit https://platform.openai.com/signup
2. Create account
3. Go to API keys section
4. Create new secret key

**Where to add**: `backend/.env`
```env
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Free Tier**: No - But application works without it using mathematical vectors

---

## 🚀 Quick Setup

### Step 1: Copy environment templates
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### Step 2: Add your keys
Edit the `.env` files with your actual API keys

### Step 3: Verify configuration
```bash
npm run setup:check
```

This will verify all required keys are present and valid.

## 🧪 Testing Without API Keys

For testing purposes, you can use these limitations:

### Without OpenWeatherMap
- Uses mock weather data
- Set `USE_MOCK_WEATHER=true` in `backend/.env`

### Without Mapbox
- Map features disabled but app still works
- Use `REACT_APP_DISABLE_MAP=true` in `frontend/.env`

### Without Twilio
- Alerts shown in UI only (default behavior)
- No SMS sent

### Without OpenAI
- Uses mathematical vector generation (default)
- Slightly less sophisticated but fully functional

## 🔒 Security Notes

1. **Never commit `.env` files** - They're in `.gitignore`
2. **Rotate keys regularly** - Especially after hackathon
3. **Use environment variables** in production
4. **Restrict API key permissions** where possible
5. **Monitor usage** to avoid exceeding free tiers

## 💰 Cost Estimates

With free tiers, you can run BURNWISE for:
- **Development**: Completely free
- **Demo/Testing**: Completely free
- **Small Production** (< 100 farms): ~$10/month
- **Full Production** (1000+ farms): ~$50-100/month

## 🆘 Troubleshooting

### "API key invalid" errors
- Wait 10 minutes after creating new keys
- Check for extra spaces or quotes
- Verify key permissions/scopes

### Rate limiting issues
- OpenWeather: Max 60 calls/minute
- Mapbox: Check monthly quota
- TiDB: Check connection limits

### Connection failures
- Verify firewall settings
- Check API service status pages
- Try with curl to test connectivity

## 📞 Support Links

- **TiDB**: https://docs.pingcap.com/tidbcloud
- **OpenWeatherMap**: https://openweathermap.org/faq
- **Mapbox**: https://docs.mapbox.com/help/
- **Twilio**: https://www.twilio.com/docs/quickstart

---

**Note for Judges**: We've included test API keys in `.env.example` for quick testing. These have limited quotas but will work for evaluation purposes.