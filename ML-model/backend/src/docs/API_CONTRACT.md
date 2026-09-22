# WeatherGPT — Backend API Contract & Specification
**Version**: 1.0.0  
**Stack**: Node.js + Express + MongoDB + Redis + AI Gateway  
**Problem Statement**: SIH PS 26068  

All endpoints are prefixed with `/api`. All timestamps follow ISO 8601 UTC. Coordinates use decimal format (`lat`: -90 to 90, `lon`: -180 to 180).

---

## 1. Response Envelopes

### Standard Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-09-11T10:30:00.000Z",
    "requestId": "4f18b368-b7ce-4279-bb7d-3eb1e0ff05e2"
  }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "WEATHER_PROVIDER_TIMEOUT",
    "message": "Weather data is temporarily unavailable.",
    "requestId": "4f18b368-b7ce-4279-bb7d-3eb1e0ff05e2"
  }
}
```

---

## 2. Authentication APIs

### 2.1 Register
- **Route**: `POST /api/auth/register`
- **Body**:
  ```json
  {
    "name": "Aarav Sharma",
    "email": "aarav@example.com",
    "password": "Password@123"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "_id": "6732a...",
        "name": "Aarav Sharma",
        "email": "aarav@example.com",
        "preferences": {
          "language": "en",
          "units": "metric",
          "advisoryPersona": "general"
        }
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

### 2.2 Login
- **Route**: `POST /api/auth/login`
- **Body**:
  ```json
  {
    "email": "aarav@example.com",
    "password": "Password@123"
  }
  ```
- **Response**: `200 OK`

### 2.3 Current User Profile
- **Route**: `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

---

## 3. Location APIs

### 3.1 Location Search
- **Route**: `GET /api/location/search?q=Lucknow`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "locations": [
        {
          "id": "26.8467,80.9462",
          "name": "Lucknow",
          "region": "Uttar Pradesh",
          "country": "India",
          "lat": 26.8467,
          "lon": 80.9462
        }
      ]
    }
  }
  ```

### 3.2 Reverse Geocode
- **Route**: `GET /api/location/reverse?lat=26.8467&lon=80.9462`
- **Response**: `200 OK`

---

## 4. Weather APIs

### 4.1 Current Weather
- **Route**: `GET /api/weather/current?lat=26.8467&lon=80.9462`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "location": {
        "id": "26.8467,80.9462",
        "name": "Lucknow",
        "region": "Uttar Pradesh",
        "country": "India",
        "lat": 26.8467,
        "lon": 80.9462
      },
      "current": {
        "temperature": 31.2,
        "feelsLike": 35.1,
        "humidity": 78,
        "windSpeed": 14,
        "windDirection": 180,
        "pressure": 1004,
        "visibility": 8,
        "precipitation": 0,
        "precipitationProbability": 72,
        "condition": "Partly Cloudy",
        "uvIndex": 6,
        "airQualityIndex": 85
      },
      "source": "IMD",
      "dataUpdatedAt": "2026-09-11T07:00:00Z"
    }
  }
  ```

### 4.2 Hourly Forecast
- **Route**: `GET /api/weather/hourly?lat=26.8467&lon=80.9462&hours=24`
- **Response**: `200 OK`

### 4.3 Daily Forecast
- **Route**: `GET /api/weather/daily?lat=26.8467&lon=80.9462&days=7`
- **Response**: `200 OK`

### 4.4 Unified Forecast
- **Route**: `GET /api/weather/forecast?lat=26.8467&lon=80.9462`
- **Response**: `200 OK` (Combines current, hourly, and daily)

---

## 5. Official Alerts & Disaster Mode

### 5.1 List Alerts
- **Route**: `GET /api/alerts?severity=HIGH&active=true`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "6732f...",
        "sourceAlertId": "IMD-WARN-2026-UP-001",
        "source": "IMD",
        "type": "THUNDERSTORM",
        "severity": "HIGH",
        "title": "Severe Thunderstorm & Lightning Warning",
        "description": "Thunderstorm accompanied with lightning, gusty winds...",
        "affectedAreas": ["Lucknow", "Kanpur", "Barabanki"],
        "issuedAt": "2026-09-11T06:00:00Z",
        "validFrom": "2026-09-11T06:00:00Z",
        "validUntil": "2026-09-12T06:00:00Z",
        "geometry": { ... },
        "sourceUrl": "https://mausam.imd.gov.in/alerts"
      }
    ]
  }
  ```

### 5.2 Map GeoJSON Alerts
- **Route**: `GET /api/map/alerts?bbox=70,10,90,35`
- **Response**: `200 OK` (`FeatureCollection` GeoJSON)

---

## 6. WeatherGPT Multi-Factor Risk Score

### 6.1 Get Risk Score
- **Route**: `GET /api/risk?lat=26.8467&lon=80.9462`
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "score": 62,
      "level": "MODERATE",
      "factors": [
        { "name": "Rain probability", "value": "72%" },
        { "name": "Active Orange/High Warning", "value": "Severe Thunderstorm" }
      ],
      "sourceContext": ["WeatherGPT Risk Engine", "IMD"],
      "modelVersion": "WeatherGPT-Risk-v1.2",
      "generatedAt": "2026-09-11T10:00:00Z"
    }
  }
  ```
> *Note*: WeatherGPT generated risk is distinctly separate from official statutory warnings.

---

## 7. AI Advisory & Chat APIs

### 7.1 Domain Advisory
- **Route**: `POST /api/advisory`
- **Body**:
  ```json
  {
    "location": { "name": "Lucknow", "lat": 26.8467, "lon": 80.9462 },
    "domain": "agriculture",
    "language": "hi",
    "context": { "crop": "Paddy" }
  }
  ```
- **Response**: `200 OK`

### 7.2 Normal Chat
- **Route**: `POST /api/chat`
- **Body**:
  ```json
  {
    "message": "Will it rain heavily in Lucknow this evening?",
    "location": { "lat": 26.8467, "lon": 80.9462, "name": "Lucknow" },
    "language": "en"
  }
  ```
- **Response**: `200 OK`

### 7.3 SSE Streaming Chat
- **Route**: `POST /api/chat/stream`
- **Headers**: `Accept: text/event-stream`
- **Event Flow**:
  1. `event: status` -> `{"status":"INITIALIZING","message":"..."}`
  2. `event: tool` -> `{"tool":"METEOROLOGICAL_LOOKUP","target":"Lucknow"}`
  3. `event: token` -> `{"token":"In "}`
  4. `event: token` -> `{"token":"Lucknow, "}`
  5. `event: result` -> `{"sessionId":"...","structuredData":{...}}`
  6. `event: done` -> `{"status":"COMPLETED"}`

---

## 8. Climate & Trend Telemetry

### 8.1 Historical Data
- **Route**: `GET /api/climate/history?lat=26.8467&lon=80.9462&start=2026-08-01&end=2026-08-31`
- **Response**: `200 OK`

### 8.2 Climate Trend Analysis
- **Route**: `GET /api/climate/trend?lat=26.8467&lon=80.9462&start=2026-08-01&end=2026-08-31&metric=temperature`
- **Response**: `200 OK`
