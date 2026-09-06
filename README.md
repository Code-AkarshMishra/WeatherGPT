# 🌤️ WeatherGPT

A **role-based conversational AI platform** for weather forecasting, alerts, and disaster-management guidance. Targeted at farmers, citizens, researchers, aviation professionals, marine operators, and disaster-management teams across India and South Asia.

---

## Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Frontend    | React 18 + Vite + React Router         |
| Backend     | Node.js + Express.js                   |
| Database    | MongoDB + Mongoose ODM                 |
| Auth        | JWT (access + refresh) + bcrypt        |
| Validation  | express-validator on every route       |
| Logging     | Winston (file) + Morgan (HTTP)         |
| AI          | Google Gemini API                      |
| Weather     | OpenWeatherMap API                     |
| Styling     | Plain CSS with custom properties       |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- OpenWeatherMap API key (free tier — https://openweathermap.org/api)
- Google Gemini API key (https://aistudio.google.com/app/apikey)

### 1. Clone and install

```bash
git clone <repo-url>
cd WeatherGPT

# Install all dependencies (root + server + client)
npm run install:all
```

### 2. Configure environment

```bash
cp .env.example server/.env
# Edit server/.env and fill in all values
```

**Required environment variables:**

| Variable              | Description                                     |
|-----------------------|-------------------------------------------------|
| `MONGO_URI`           | MongoDB connection string                       |
| `JWT_SECRET`          | Access token signing secret (min 32 chars)     |
| `JWT_REFRESH_SECRET`  | Refresh token signing secret (min 32 chars)    |
| `WEATHER_API_KEY`     | OpenWeatherMap API key                          |
| `GEMINI_API_KEY`      | Google Gemini API key                           |

See `.env.example` for all optional variables (per-role API keys, rate limit tuning, etc.).

### 3. Seed the database

```bash
npm run seed
```

This populates the `roles` collection with all 8 roles and their feature chips. Safe to run multiple times.

### 4. Run in development

```bash
npm run dev
```

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:5001
- **Health check:** http://localhost:5001/health

---

## Project Structure

```
WeatherGPT/
├── client/                 # React frontend (Vite)
│   └── src/
│       ├── components/     # Reusable UI components
│       ├── contexts/       # Auth, Theme, Language contexts
│       ├── hooks/          # useGeolocation, useWeather, useChat, useSpeechRecognition
│       ├── pages/          # Home, Login, Register, Dashboard, About
│       ├── services/       # Axios API layer
│       └── styles/         # CSS with design system variables
│
├── server/                 # Node.js + Express backend
│   ├── config/             # DB, logger, env validation
│   ├── controllers/        # Auth, Weather, Chat, Roles
│   ├── middleware/         # JWT auth, rate limiter, sanitization, error handler
│   ├── models/             # User, Conversation, Message, Role, WeatherCache
│   ├── routes/             # /api/auth, /api/weather, /api/chat, /api/roles
│   ├── seeds/              # Role seeding script
│   └── services/           # Gemini, Weather, Intent extraction, Prompt builder, Rain predictor
│
├── .env.example            # All required env vars documented
├── docker-compose.yml      # Local dev with MongoDB
└── README.md
```

---

## How Roles Map to API Keys

Each role in the `roles` MongoDB collection has an `apiKeyEnvVar` field pointing to the environment variable that holds its API key:

| Role              | Default `apiKeyEnvVar`      |
|-------------------|-----------------------------|
| Farmer            | `CROP_ADVISORY_API_KEY`     |
| Citizen           | `GEMINI_API_KEY`            |
| Researcher        | `GEMINI_API_KEY`            |
| Aviation          | `AVIATION_API_KEY`          |
| Marine            | `MARINE_API_KEY`            |
| Flood & Disaster  | `FLOOD_API_KEY`             |
| Climate Analyst   | `CLIMATE_API_KEY`           |
| Urban Planner     | `GEMINI_API_KEY`            |

Initially, all these can point to the same Gemini key. Assign separate keys later for quota isolation without a code change — just update `.env`.

To **add a new role**: add a document to the `roles` collection (or extend `seeds/seedRoles.js`) and add a system prompt entry to `server/services/promptBuilder.js`. No frontend redeployment needed.

---

## ML Model Plug-In Point

The rain probability prediction currently uses a rule-based heuristic:

```
server/services/rainPredictor.js → function predictRainProbability()
```

This is clearly marked `TEMP_HEURISTIC` in the code. When the ML team delivers a model:

1. Replace the function body in `rainPredictor.js` with a call to your model's inference endpoint.
2. The function signature stays the same: `predictRainProbability({ humidity, pressure, recentPrecip1h, recentPrecip3h, clouds, weatherMain }) → number (0–100)`.
3. No other files need to change.

---

## API Endpoints

| Method | Route                                  | Auth     | Description                       |
|--------|----------------------------------------|----------|-----------------------------------|
| POST   | `/api/auth/register`                   | None     | Create account                    |
| POST   | `/api/auth/login`                      | None     | Login, get tokens                 |
| POST   | `/api/auth/refresh`                    | None     | Rotate refresh token              |
| POST   | `/api/auth/logout`                     | Required | Revoke refresh token              |
| GET    | `/api/auth/me`                         | Required | Get current user                  |
| GET    | `/api/weather?lat=&lon=`               | None     | Get weather + rain probability    |
| POST   | `/api/chat`                            | Optional | Send message, get AI response     |
| GET    | `/api/chat/conversations`             | Required | List user's conversations         |
| GET    | `/api/chat/conversations/:id/messages`| Required | Get messages for a conversation   |
| GET    | `/api/roles`                           | None     | List all active roles             |

---

## NLP Pipeline (per chat message)

1. **Intent extraction** — Gemini JSON-mode call extracts `intent`, `location`, `timeEntity`, `language`.
2. **Location geocoding** — if a location entity is found, it's geocoded via OWM and overrides GPS.
3. **Weather fetch** — live weather data fetched (or served from 10-min MongoDB cache).
4. **Prompt assembly** — role-specific system prompt + weather context + entity annotations.
5. **LLM call** — Gemini generates the response in the detected language.
6. **Persistence** — conversation + messages saved to MongoDB with NLP metadata.
7. **Role suggestion** — if intent doesn't match selected role, a suggestion is returned.

Extracted NLP data (`intent`, `location`, `timeEntity`, `language`) is visible in the chat UI in **development mode** as small debug tags on each AI response.

---

## Docker

```bash
# Build and start all services
docker-compose up --build

# The client is served at http://localhost:5173
# The API is at http://localhost:5001
```

---

## Design System

All colors, spacing, and typography are defined as CSS custom properties in `client/src/styles/variables.css`. Key tokens:

| Token                  | Value      | Purpose                        |
|------------------------|------------|--------------------------------|
| `--color-primary`      | `#1E88E5`  | Brand blue — buttons, navbar   |
| `--color-accent`       | `#4FC3F7`  | Cyan — AI bubble border        |
| `--color-secondary`    | `#FFB300`  | Storm amber — warning alerts   |
| `--color-danger`       | `#E53935`  | Flood/red alert banners        |
| `--color-success`      | `#43A047`  | All clear status               |
| `--color-bg`           | `#F5F9FC`  | App background (light)         |
| `--color-bg` (dark)    | `#0F1B26`  | App background (dark)          |

---

## Multilingual Support

- UI labels: English (`en`) and Hindi (`hi`) in `client/src/contexts/LanguageContext.jsx`.
- To add a new language, add its strings to the `STRINGS` map — no other changes needed.
- Chat: the LLM responds in the language it detects from the user's message (English, Hindi, Hinglish).
- Speech input uses `lang='hi-IN'` on the Web Speech API to support Hindi/Hinglish voice queries.
