# GATE 3 — API CONTRACTS
## Display Waktu Solat Malaysia

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-10-08  

---

## 1. Architecture Pattern: Backend Proxy Adapter (`/api/*`)

To eliminate browser CORS errors, enforce strict timeouts, normalize schemas, and provide server-side caching for 24/7 kiosk resilience, the frontend communicates with our Express backend (`/api/*`), which in turn queries the approved authoritative upstream APIs.

---

## 2. Contract 1: Prayer Times & Hijri Date API

### 2.1 Internal Proxy Endpoint
- **URL:** `GET /api/prayer-times`
- **Query Parameters:**
  - `zone` (required, string): Valid JAKIM zone code (e.g., `WLY01`, `SGR01`, `JHR01`). Validated against regex `/^[A-Z]{3}\d{2}$/`.
  - `period` (optional, string): `week` (default) or `month`.
- **Upstream Authoritative Endpoint:**
  - `GET https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period={period}&zone={zone}`
- **Headers:** `Accept: application/json`, `User-Agent: DisplayWaktuSolatMalaysia/1.0`
- **Authentication:** None (Public JAKIM API).
- **Timeout:** `8000ms` per upstream request.
- **Retry Policy:** Up to 2 retries with exponential backoff (`500ms`, `1500ms`) on network/5xx errors.
- **Cache Policy:**
  - Server-side in-memory cache: `6 hours` fresh TTL, `7 days` stale-while-error retention.
  - Client-side `localStorage` cache: keyed by `dws_prayer_{zone}`, retained up to `7 days` (`staleThresholdMs = 12 * 3600 * 1000` [12 hours]).

### 2.2 Normalized Response Schema (`200 OK`)
```json
{
  "zone": "WLY01",
  "zoneName": "Kuala Lumpur, Putrajaya",
  "stateName": "Wilayah Persekutuan",
  "source": "e-Solat JAKIM",
  "fetchedAt": "2026-10-08T07:10:00.000Z",
  "isStale": false,
  "days": [
    {
      "hijri": "1448-04-26",
      "date": "08-Okt-2026",
      "isoDate": "2026-10-08",
      "day": "Thursday",
      "imsak": "05:42:00",
      "fajr": "05:52:00",
      "syuruk": "06:58:00",
      "dhuha": "07:23:00",
      "dhuhr": "13:04:00",
      "asr": "16:17:00",
      "maghrib": "19:04:00",
      "isha": "20:14:00"
    }
  ]
}
```

### 2.3 Error Response (`400 / 502 / 503`)
```json
{
  "error": "UPSTREAM_UNAVAILABLE",
  "message": "Perkhidmatan e-Solat JAKIM tidak dapat dihubungi buat sementara waktu.",
  "zone": "WLY01"
}
```

---

## 3. Contract 2: Malaysian Weather Forecast API

### 3.1 Internal Proxy Endpoint
- **URL:** `GET /api/weather`
- **Query Parameters:**
  - `zone` (required, string): JAKIM zone code (e.g., `WLY01`) or `location` search term (e.g., `Kuala Lumpur`).
- **Upstream Authoritative Endpoint:**
  - `GET https://api.data.gov.my/weather/forecast/?contains={mappedLocationName}@location__location_name&limit=10`
  - Fallback general list: `GET https://api.data.gov.my/weather/forecast/?limit=100`
- **Timeout:** `8000ms`
- **Retry Policy:** 1 retry (`1000ms` delay).
- **Cache Policy:**
  - Server-side cache: `30 minutes` fresh TTL, `6 hours` stale retention.
  - Client-side `localStorage` cache: `30 minutes` fresh TTL, `3 hours` stale threshold.

### 3.2 Normalized Response Schema (`200 OK`)
```json
{
  "locationId": "St007",
  "locationName": "WP Kuala Lumpur",
  "date": "2026-10-08",
  "morningForecast": "Tiada Hujan",
  "afternoonForecast": "Ribut petir di beberapa tempat",
  "nightForecast": "Tiada Hujan",
  "summaryForecast": "Ribut petir di beberapa tempat",
  "summaryWhen": "Petang",
  "minTemp": 24,
  "maxTemp": 33,
  "source": "MetMalaysia (data.gov.my)",
  "fetchedAt": "2026-10-08T07:10:00.000Z",
  "isStale": false
}
```

---

## 4. Contract 3: WebRTC Signalling WebSocket API

### 4.1 Endpoint
- **URL:** `ws(s)://{host}/ws/signalling`
- **Protocol:** JSON event messages over WebSocket.

### 4.2 Client-to-Server Messages
1. `join-room`:
   ```json
   { "type": "join-room", "roomId": "849201", "role": "display" | "sender", "deviceName": "Telefon Bilal" }
   ```
2. `webrtc-offer`:
   ```json
   { "type": "webrtc-offer", "roomId": "849201", "sdp": { ... } }
   ```
3. `webrtc-answer`:
   ```json
   { "type": "webrtc-answer", "roomId": "849201", "sdp": { ... } }
   ```
4. `webrtc-ice-candidate`:
   ```json
   { "type": "webrtc-ice-candidate", "roomId": "849201", "candidate": { ... } }
   ```
5. `leave-room`:
   ```json
   { "type": "leave-room", "roomId": "849201" }
   ```

### 4.3 Server-to-Client Messages
- `room-joined`: Confirms room registration and current peer presence.
- `peer-joined`: Notifies display that a phone has paired (`PAIRING` -> `CONNECTING`).
- `webrtc-offer` / `webrtc-answer` / `webrtc-ice-candidate`: Relayed strictly to the opposite role in the same `roomId`.
- `peer-left`: Notifies peer disconnection so receiver transitions cleanly to `DISCONNECTED` / `WAITING`.
- `error`: Validation or room error.
