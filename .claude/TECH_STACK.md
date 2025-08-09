# 🛠️ Burnwise Technology Stack

## Overview
Full-stack JavaScript application using React 18, Node.js/Express, TiDB with vector search, and real-time WebSocket communication.

## 🎨 Frontend Stack

### Core Framework
- **React** `^18.2.0` - UI library
- **React DOM** `^18.2.0` - DOM rendering
- **React Router** `^6.8.1` - Client-side routing
- **React Scripts** `5.0.1` - Build tooling

### UI Libraries
- **Framer Motion** `^12.23.12` - Animation library
- **React Icons** `^5.5.0` - Icon components
- **React Hot Toast** `^2.5.2` - Toast notifications
- **Recharts** `^2.10.3` - Data visualization charts
- **Lottie React** `^2.4.1` - Lottie animations

### 3D & Graphics
- **Three.js** `^0.160.0` - 3D graphics
- **@react-three/fiber** `^8.15.0` - React renderer for Three.js
- **@react-three/drei** `^9.88.0` - Three.js helpers
- **Three Nebula** `^10.0.3` - Particle system
- **Cannon-es** `^0.20.0` - Physics engine

### Fire Animation
- **tsparticles** `^3.9.1` - Particle system
- **@tsparticles/react** `^3.0.0` - React wrapper
- **@tsparticles/preset-fire** `^3.2.0` - Fire preset
- **@tsparticles/engine** `^3.9.1` - Core engine
- **@tsparticles/updater-color** `^3.9.1` - Color updater
- **@tsparticles/updater-opacity** `^3.9.1` - Opacity updater

### Mapping
- **Mapbox GL** `^3.1.2` - Interactive maps
- **@mapbox/mapbox-gl-draw** `^1.4.3` - Drawing tools

### Utilities
- **Axios** `^1.6.7` - HTTP client
- **Lodash** `^4.17.21` - Utility functions
- **Joi** `^17.11.0` - Schema validation

### Build Tools
- **React App Rewired** `^2.2.1` - CRA configuration
- **Customize CRA** `^1.0.0` - CRA customization
- **Compression Webpack Plugin** `^10.0.0` - Build compression
- **Webpack Bundle Analyzer** `^4.10.1` - Bundle analysis

## 🔧 Backend Stack

### Core Framework
- **Express** `^4.18.2` - Web framework
- **Node.js** `>=16.0.0` - Runtime environment

### Database
- **MySQL2** `^3.14.3` - TiDB client (MySQL compatible)
- **Redis** `^4.6.10` - Caching layer

### Real-time Communication
- **Socket.io** `^4.8.1` - WebSocket library

### Authentication & Security
- **JWT** `^9.0.2` - JSON Web Tokens
- **Bcryptjs** `^2.4.3` - Password hashing
- **Helmet** `^7.1.0` - Security headers
- **CORS** `^2.8.5` - Cross-origin resource sharing
- **Express Rate Limit** `^7.1.5` - Rate limiting

### External APIs
- **Twilio** `^4.23.0` - SMS notifications
- **OpenWeatherMap** - Weather data (via Axios)

### Data Processing
- **MathJS** `^12.2.1` - Mathematical operations
- **ML-Matrix** `^6.10.7` - Matrix operations for vectors
- **Moment** `^2.29.4` - Date/time manipulation

### Utilities
- **Axios** `^1.11.0` - HTTP client
- **Lodash** `^4.17.21` - Utility functions
- **UUID** `^9.0.1` - Unique identifiers
- **Joi** `^17.11.0` - Schema validation
- **Dotenv** `^17.2.1` - Environment variables

### Logging & Monitoring
- **Winston** `^3.11.0` - Logging framework
- **Winston Daily Rotate File** `^4.7.1` - Log rotation
- **Morgan** `^1.10.0` - HTTP request logger

### Task Scheduling
- **Node-Cron** `^3.0.3` - Cron job scheduler

### Performance
- **Compression** `^1.7.4` - Response compression

## 🧪 Testing Stack

### Testing Frameworks
- **Jest** `^29.7.0` - Unit/integration testing
- **Supertest** `^6.3.3` - API testing
- **Playwright** - E2E testing (in e2e-tests/)
- **React Testing Library** - React component testing

### Development Tools
- **Nodemon** `^3.1.10` - Auto-restart server
- **ESLint** `^8.54.0` - Code linting
- **Prettier** `^3.1.0` - Code formatting
- **@types/jest** `^29.5.8` - Jest TypeScript definitions

## 🗄️ Database Technology

### TiDB Features Used
- **Vector Search** - 128/64/32 dimensional vectors
- **HNSW Index** - High-performance vector indexing
- **Connection Pooling** - Max 10 connections
- **Circuit Breaker** - 5 failure threshold
- **Query Caching** - Redis-based caching

### Vector Dimensions
| Data Type | Dimensions | Purpose |
|-----------|------------|---------|
| Weather | 128 | Comprehensive weather state |
| Smoke | 64 | Dispersion patterns |
| Burns | 32 | Burn characteristics |

## 🌐 API Integrations

### External Services
| Service | Purpose | Authentication |
|---------|---------|----------------|
| OpenWeatherMap | Weather data | API Key |
| Twilio | SMS alerts | Account SID + Auth Token |
| Mapbox | Map visualization | Access Token |

## 📦 Package Management

### Package Managers
- **npm** - Primary package manager
- **yarn** - Alternative (if preferred)

### Version Control
- **Git** - Source control
- **GitHub** - Repository hosting

## 🚀 Deployment Stack

### Development
- **Nodemon** - Auto-reload backend
- **React Scripts** - Hot reload frontend
- **Concurrent** - Run multiple processes

### Production Build
- **React Build** - Optimized frontend bundle
- **Node.js** - Production server
- **PM2** (recommended) - Process management

## 🔐 Security Measures

### Authentication
- JWT tokens with expiration
- Bcrypt password hashing (10 rounds)
- Role-based access control

### API Security
- Rate limiting (100 req/15 min)
- CORS configuration
- Helmet.js security headers
- Input validation (Joi)
- SQL injection prevention

### Data Protection
- Environment variables for secrets
- HTTPS in production
- XSS protection
- CSRF protection

## 📊 Performance Optimizations

### Frontend
- Code splitting
- Lazy loading
- Memoization
- WebGL for maps
- Service workers

### Backend
- Connection pooling
- Query caching (Redis)
- Circuit breaker pattern
- Response compression
- Indexed database queries

## 🏗️ Architecture Patterns

### Design Patterns
- **MVC** - Model-View-Controller
- **Repository Pattern** - Database abstraction
- **Circuit Breaker** - Fault tolerance
- **Observer Pattern** - WebSocket events
- **Factory Pattern** - Agent creation

### Code Organization
- **Feature-based** - Frontend components
- **Layer-based** - Backend structure
- **Domain-driven** - Agent system

## 📈 Monitoring & Logging

### Logging
- Winston for structured logging
- Daily log rotation
- Multiple log levels
- Performance metrics

### Error Tracking
- Global error handlers
- Graceful degradation
- Error boundaries (React)

## 🔄 Real-time Features

### WebSocket Events
- Burn request updates
- Weather changes
- Schedule optimization
- Alert notifications

### Polling Fallback
- HTTP polling for WebSocket failures
- Exponential backoff

## 🧮 Algorithms & Models

### Core Algorithms
| Algorithm | Location | Purpose |
|-----------|----------|---------|
| Gaussian Plume | `predictor.js` | Smoke dispersion |
| Simulated Annealing | `optimizer.js` | Schedule optimization |
| Vector Similarity | `vectorOperations.js` | Weather matching |
| Haversine Distance | `utils.js` | Geographic calculations |

## 📱 Browser Support

### Supported Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (Chromium)

### Required Features
- WebGL 2.0 (for maps)
- WebSocket support
- ES6+ JavaScript

## 🔗 Version Compatibility

### Node.js
- Minimum: `16.0.0`
- Recommended: `18.0.0+`

### Database
- TiDB: `6.0+` (MySQL 5.7 compatible)
- Redis: `6.0+`

### Browser APIs
- Geolocation API
- WebSocket API
- WebGL 2.0
- Service Workers

## 📝 Development Standards

### Code Style
- ESLint configuration
- Prettier formatting
- Consistent naming conventions

### Git Workflow
- Feature branches
- Conventional commits
- Pull request reviews

### Documentation
- JSDoc comments
- README files
- API documentation
- Inline comments for complex logic