# 🔥 BURNWISE

**Multi-Farm Agricultural Burn Coordinator** - TiDB AgentX Hackathon 2025

BURNWISE is an intelligent agricultural burn coordination system that prevents dangerous smoke overlap between neighboring farms using multi-agent AI, real-time weather analysis, and TiDB vector search capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-green.svg)
![TiDB](https://img.shields.io/badge/TiDB-Serverless-orange.svg)

## 🎯 Problem Solved

Agricultural burning is essential for crop residue management, but uncoordinated burns between neighboring farms create:
- **Dangerous PM2.5 levels** exceeding EPA limits (35 µg/m³)
- **Highway visibility hazards** from smoke drift
- **Health impacts** on nearby communities
- **Regulatory violations** and potential fines

BURNWISE coordinates burns across multiple farms to ensure safe air quality while maximizing farming efficiency.

## ✨ Key Features

### 🤖 5-Agent AI System
1. **Burn Request Coordinator** - Validates requests and assigns priority scores
2. **Weather Analysis Agent** - Real-time weather monitoring with vector pattern matching
3. **Smoke Overlap Predictor** - Gaussian plume modeling for dispersion prediction
4. **Schedule Optimizer** - Simulated annealing algorithm for conflict resolution
5. **Alert System Agent** - SMS/email notifications to affected farms

### 🗺️ Fire-Themed Interface
- **Cinematic Bootup Animation** - Individual flame controls with Framer Motion
- **Glass Morphism Design** - Fire-themed gradients with backdrop blur effects
- **Interactive Map Visualization** - Mapbox integration with field drawing
- **Real-time Dashboard** - Analytics with fire-themed charts and animations
- **Responsive Design** - Mobile-first with consistent fire aesthetics

### 🚀 TiDB Vector Capabilities
- **Weather Pattern Vectors** (128-dimensional) - Historical pattern matching
- **Smoke Plume Vectors** (64-dimensional) - Dispersion predictions
- **Burn History Vectors** (32-dimensional) - Success rate analysis
- **Spatial Queries** - Geographic proximity calculations
- **Vector Similarity Search** - Finding similar weather conditions

## 🛠️ Tech Stack

### Frontend
- **React 18** with fire-themed glass morphism design
- **Framer Motion** for cinematic animations
- **Mapbox GL** for interactive field drawing
- **Fire Color Palette** (#ff6b35, #ff5722, #FFB000)

### Backend
- **Node.js** with Express.js
- **TiDB Serverless** with vector columns
- **Multi-Agent Architecture** (5 specialized agents)
- **OpenWeatherMap API** for weather data
- **Twilio** for SMS alerts

## 🚀 Quick Start

### 1. Clone and install
```bash
git clone https://github.com/seanesla/burnwise.git
cd burnwise
npm run install:all
```

### 2. Configure environment files
Create `backend/.env` and `frontend/.env` with required API keys.

### 3. Start the application
```bash
npm run dev
```

Visit http://localhost:3000 to see the fire-themed interface with cinematic bootup animation.

## 📊 Architecture

- **5-Agent Workflow**: Coordinator → Weather → Predictor → Optimizer → Alerts
- **TiDB Vector Search**: Weather pattern matching and smoke predictions
- **Fire-Themed UI**: Glass morphism with backdrop blur and fire gradients
- **Real-time Updates**: Socket.io integration for live farm coordination

## 🎯 Hackathon Features

1. **Multi-Agent Workflow** - 5 specialized agents working in sequence
2. **TiDB Vector Search** - Weather pattern matching and smoke predictions
3. **Fire-Themed Design** - Complete glass morphism interface with cinematic animations
4. **Production Ready** - Error handling, logging, rate limiting
5. **Complete System** - Frontend, backend, database, external APIs

## 📄 License

MIT License - Created for TiDB AgentX Hackathon 2025

---

**Note:** This is a fully functional application with real implementations. All API keys must be configured for the system to work.