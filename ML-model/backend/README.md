# WeatherGPT — Production Backend
**Smart India Hackathon (SIH PS 26068)**  
**Single Trusted Gateway between Frontend, Meteorological Sources (IMD/Official), MongoDB/Redis, and AI/ML Service**

---

## 🌟 Key Capabilities & Architectural Highlights

- **🔒 Single Trusted Gateway**: The frontend NEVER queries private provider credentials or internal AI keys directly.
- **⚡ Meteorological Abstraction & Normalization**: Seamlessly unifies IMD and secondary meteorological feeds with canonical schemas, units, and timestamps.
- **⚠️ Official Alerts vs WeatherGPT Risk**: Strict separation between statutory government warnings (IMD Red/Orange alerts) and generated AI multi-factor risk scores.
- **🤖 AI/ML Integration**: Orchestrates context compilation and proxies responses through normal REST and Server-Sent Events (SSE) streaming (`POST /api/chat/stream`).
- **🛡️ Security & Observability**: Helmet security headers, CORS protection, Zod validation, Winston structured logging with `X-Request-ID` correlation, and layered rate limiting.
- **💾 Dual-Tier Caching**: High-performance Redis caching with automatic, graceful fallback to an in-memory TTL store.
- **🧪 Deterministic Mock Mode**: `MOCK_EXTERNAL_APIS=true` enables full local development without live external provider credentials.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Setup
```bash
cp .env.example .env
```

### 3. Run Locally (Dev Mode)
```bash
npm run dev
```

Server boots on `http://localhost:5000`.

### 4. Health & Readiness Checks
- **Liveness**: `GET http://localhost:5000/health`
- **Readiness**: `GET http://localhost:5000/ready`

### 5. Run Database Seed
```bash
npm run seed
```

### 6. Run Automated Test Suite
```bash
npm test
```

---

## 📂 Project Architecture

```
src/
├── config/             # Environment, Database, Redis configurations
├── controllers/        # Request handling and response orchestration
├── docs/               # Detailed API Contract (API_CONTRACT.md)
├── jobs/               # Background cron jobs (Alert ingestion, Cache warming)
├── middleware/         # Auth, Validation, Rate Limiter, Error handling, Request ID
├── models/             # Mongoose schemas with 2dsphere & TTL indexes
├── routes/             # Express API route modules
├── seeds/              # Seed scripts for development data
├── services/           # Business logic, Weather providers, AI gateway, Cache
├── utils/              # Winston logger, Custom ApiError, Standard response helpers
├── app.js              # Express app setup and middleware pipeline
└── server.js           # Server lifecycle & graceful shutdown
```

---

## 📑 API Contract Reference
See [API_CONTRACT.md](src/docs/API_CONTRACT.md) for endpoint documentation with request/response payloads.
