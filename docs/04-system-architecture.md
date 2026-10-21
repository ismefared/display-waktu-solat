# GATE 4 — SYSTEM ARCHITECTURE
## Display Waktu Solat Malaysia

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-10-08  

---

## 1. System Context

```
+-------------------------------------------------------------------------+
|                    DISPLAY WAKTU SOLAT MALAYSIA                         |
|                                                                         |
|  +---------------------------+        +------------------------------+  |
|  |   10m TV / Kiosk Browser  |        |  Mobile Phone Browser        |  |
|  |   (Primary Display &      |        |  (Second Page Broadcaster    |  |
|  |    Stream Receiver)       |        |   via QR / Pairing Code)     |  |
|  +-------------+-------------+        +--------------+---------------+  |
|                |                                     |                  |
|                | HTTP /api/* & WS /ws/signalling     | WS & WebRTC      |
|                v                                     v                  |
|  +-------------------------------------------------------------------+  |
|  |             Node.js / Express Full-Stack Server (Port 3000)       |  |
|  |  - API Proxy & Normalizer (/api/prayer-times, /api/weather)       |  |
|  |  - Multi-Tier In-Memory Cache & Stale-While-Error Store           |  |
|  |  - WebSocket Signalling Server (/ws/signalling)                   |  |
|  +-----------------+---------------------------------+---------------+  |
+--------------------|---------------------------------|------------------+
                     | HTTPS                           | HTTPS
                     v                                 v
      +------------------------------+   +------------------------------+
      | JAKIM e-Solat Official API   |   | Malaysia Open Data API       |
      | (www.e-solat.gov.my)         |   | MetMalaysia (api.data.gov.my)|
      +------------------------------+   +------------------------------+
```

---

## 2. Logical Layered Architecture (Section 15 & 16 Compliance)

```
+-------------------------------------------------------------------+
| 1. PRESENTATION LAYER (src/components/*)                          |
|    - PrimaryDisplayView (10m TV Layout, 6-Level Hierarchy)        |
|    - StreamDisplayView (Second Page Receiver + Mini Prayer Bar)   |
|    - MobileBroadcasterView (Phone Camera Sender UI)               |
|    - ZoneSelectorModal (Manual Zone Fallback & Geolocation UI)    |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| 2. APPLICATION / STATE LAYER (src/hooks/*, src/context/*)         |
|    - useAppController (Orchestrates zone, clock, prayer, weather) |
|    - useMalaysiaClock (Wall-clock synced 1000ms tick in MYT)      |
|    - useWebRTCStream (Manages RTCPeerConnection & WS Signalling)  |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| 3. DOMAIN LAYER (src/domain/*)                                    |
|    - PrayerEngine (Next prayer resolution, post-Isyak/midnight)   |
|    - HijriFormatter (JAKIM Hijri string parser & BM month names)  |
|    - ZoneMapper (Haversine + state boundary coordinate-to-zone)   |
+-------------------------------------------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
| 4. INTEGRATION / SERVICES LAYER (src/services/*)                  |
|    - PrayerService (Fetches /api/prayer-times + localStorage)     |
|    - WeatherService (Fetches /api/weather + independent fallback) |
|    - LocationService (Browser Geolocation + status state machine) |
|    - IslamicEventService (Verified JAKIM Takwim event lookup)     |
|    - HistoryService (Verified Malaysian history event lookup)     |
|    - ZikirService (Deterministic daily verified Zikir lookup)     |
+-------------------------------------------------------------------+
```

---

## 3. Architectural Decisions Record (ADR)

### ADR-01: Full-Stack Express Proxy with Vite Middleware on Port 3000
- **Decision:** Run an Express server (`server.ts`) on port 3000 that mounts Vite middleware in development, serves `/api/prayer-times` and `/api/weather`, and attaches a `ws` WebSocket server at `/ws/signalling`.
- **Reason:** Direct browser requests to `www.e-solat.gov.my` can fail due to CORS headers on strict browsers, and WebRTC requires a real-time signalling channel on the same port (3000) to work seamlessly inside cloud/container environments.
- **Alternative:** Pure client-side SPA calling third-party CORS proxies.
- **Trade-off:** Slightly more server code in `server.ts`, but dramatically higher reliability, zero CORS issues, and shared server caching.

### ADR-02: Wall-Clock Delta Countdown (`Date.now()`) in `Asia/Kuala_Lumpur`
- **Decision:** Compute countdown remaining seconds by comparing the current Malaysia timestamp against the validated target prayer epoch timestamp every tick, rather than decrementing a counter (`counter--`).
- **Reason:** Browser `setInterval` drifts when CPU is throttled or during long 24/7 operation. Wall-clock delta comparison guarantees zero cumulative drift over weeks of operation.
- **Alternative:** Naive `setInterval(() => setSeconds(s => s - 1), 1000)`.
- **Trade-off:** Requires deterministic timezone math (`Intl.DateTimeFormat` for `Asia/Kuala_Lumpur`), which we encapsulate cleanly in `PrayerEngine`.

### ADR-03: Multi-Tier Caching & Priority Degradation
- **Decision:** Cache JAKIM weekly/monthly schedules in both server memory and browser `localStorage`. If both network and server are unreachable, fall back to `localStorage` schedule or deterministic verified zone schedule marked `STALE / OFFLINE`.
- **Reason:** Ensures Priority 1 (Prayer Display) and Priority 2 (Countdown) never fail even during prolonged mosque Wi-Fi outages.
- **Alternative:** Show an error screen when offline.
- **Trade-off:** Requires explicit `isStale` and `fetchedAt` metadata on every service payload so the user is never misled about data freshness.

### ADR-04: Host-Only WebRTC with Ephemeral Bootstrap Signalling (`SEC-LAN-001`)
- **Decision:** Use native `RTCPeerConnection` configured strictly with `iceServers: []` (zero public STUN or TURN servers) and restrict ICE candidates exclusively to local `typ host` candidates (RFC 1918 private IPv4, IPv6 Unique Local/Link-Local, or RFC 8828 `.local` mDNS hostnames).
- **Reason:** Enforces `SEC-LAN-001` so that WebRTC media and `RTCDataChannel` connectivity can only succeed when direct Layer-2/Layer-3 local network reachability exists between the phone and the TV display.

### ADR-05: SEC-LAN-001 Hybrid Host-Only WebRTC `RTCDataChannel` + Local Socket Validation (STATUS: APPROVED — OPTION 3 CONDITIONALLY)
- **Decision (`SEC-LAN-001`):** Implement Option 3 (Hybrid Host-Only WebRTC `RTCDataChannel` + Local Socket Validation) under the 10 mandatory constraints approved by the human decision authority:
  1. **Zero Signalling Control Relay:** Remote-control commands (`lan-control-command`, `remote-command`, `control-command`) are strictly prohibited and rejected (`PROHIBITED_SIGNALLING_COMMAND`) on `/ws/signalling`.
  2. **Minimal Ephemeral Bootstrap:** `/ws/signalling` carries only short-lived pairing handshake metadata and SDP/ICE bootstrap frames.
  3. **Zero Public STUN/TURN:** `/api/webrtc-config` returns `iceServers: []` and `turnConfigured: false`. Both client and server reject `srflx`, `prflx`, `relay`, and public IPv4 ICE candidates (`NON_LAN_CANDIDATE_REJECTED`).
  4. **Direct Authenticated `RTCDataChannel`:** All remote-control commands (`STOP_STREAM`, `SWITCH_VIEW_PRIMARY`, `PING_STATE`) are transmitted exclusively over the peer-to-peer `RTCDataChannel` (`dws-lan-control-v1`).
  5. **Explicit TV Operator Authorization:** Presenting a valid pairing token transitions the session to `PENDING_TV_APPROVAL`. No `sessionToken` is issued and no SDP offer is accepted until the TV operator explicitly clicks "Luluskan Telefon Ini" on the TV display.
  6. **Expiring & Revocable Tokens:** Pairing tokens expire after 2 minutes (`120,000 ms`), authorized sessions expire after 30 minutes, and the TV operator can immediately revoke any active or pending session (`session-revoked`).
  7. **Replay Protection:** `LanSessionGuard` enforces a strictly increasing monotonic sequence number (`seq > lastAcceptedSeq`) and a `±30s` timestamp freshness window on every `RTCDataChannel` command.
  8. **Local Appliance Socket & Subnet Validation:** When running directly on a local LAN appliance (no `X-Forwarded-For` cloud proxy), `server.ts` enforces RFC 1918 private IP socket validation (`NON_LAN_SOCKET_REJECTED`) and same-`/24` subnet verification (`DIFFERENT_SUBNET_REJECTED`) between the display and phone sockets.
  9. **Fail-Closed Cloud Preview Behaviour:** When hosted in a cloud preview environment or when direct host-only ICE fails (due to mobile data, different Wi-Fi, or AP client isolation), the connection fails closed (`LAN_UNREACHABLE_OR_ISOLATED`) and remote control remains locked.
  10. **Independent Primary Display:** The primary prayer-time display, countdown, calendar, weather, and contextual cards operate independently of remote-control availability.
- **Threat Model & Network Topology Evaluation:**
  - **Physical Wi-Fi vs. Host-Only ICE:** Host-only ICE (`iceServers: []`) proves direct Layer-3 IP routing without NAT traversal or external relays, but does not by itself prove physical same-SSID membership on enterprise routed LANs or split-tunnel VPNs. Therefore, defense-in-depth is enforced by combining: (a) physical visual proximity (2-minute QR/token displayed on the TV), (b) explicit physical TV approval button press by the operator, (c) host-only ICE candidate filtering, and (d) local socket `/24` subnet verification on local appliances.
  - **Wi-Fi Client Isolation / Guest VLANs:** If a mosque Wi-Fi router enables AP Client Isolation, direct `typ host` UDP packets between phone and TV are blocked at Layer 2. Per Constraint #9, the system fails closed and displays a clear Bahasa Melayu diagnostic (`LAN_UNREACHABLE_OR_ISOLATED`).

### ADR-06: SEC-LAN-002 Trusted-Device Enrollment + Auto-Rotating Ephemeral Pairing Beacon (STATUS: APPROVED — OPTION A)
- **Decision (`SEC-LAN-002`):** Implement Option A (Trusted-Device Enrollment + Auto-Rotating Ephemeral Pairing Beacon) under the 10 mandatory policy requirements approved by the human decision authority:
  1. **First-Time Enrollment On-TV Approval:** Enrolling a new phone requires a valid short-lived pairing token (`2m TTL`) AND explicit physical on-TV approval (`Luluskan & Daftarkan (14 Hari)` or `Sesi Ini Sahaja (30m)`).
  2. **Zero-Touch Cryptographic Reconnection:** Previously enrolled phones reconnect without repeated on-TV button presses by completing a one-time HMAC-SHA256 challenge-response handshake (`trusted-reconnect-request` -> `trusted-challenge` -> `trusted-challenge-response` -> `pairing-approved`) verified by `LanSessionGuard.verifyTrustedReconnectProof`.
  3. **14-Day Trusted-Device Credential Expiry:** Enrolled credentials (`TrustedDeviceRecord` / `EnrolledPhoneCredential`) expire strictly after 14 days (`1,209,600,000 ms`).
  4. **30-Minute Session Token Renewal:** Active session tokens expire after 30 minutes (`1,800,000 ms`) and are automatically renewed via `RENEW_SESSION` over the authenticated `RTCDataChannel` while the session remains active and authorized.
  5. **4-Hour Maximum Continuous Session Limit:** Continuous active sessions cannot be renewed beyond 4 hours (`14,400,000 ms`, `MAX_SESSION_DURATION_EXCEEDED`), requiring fresh cryptographic reauthentication.
  6. **Immediate Single-Device & All-Device Revocation:** The TV management drawer (`tv-trusted-devices-drawer`) supports immediate single-device (`revokeTrustedDeviceOnTv`) and all-device (`revokeAllTrustedDevicesOnTv`) revocation, immediately terminating active sessions and rejecting future reconnect attempts.
  7. **Idle Ephemeral Pairing Token Auto-Rotation:** While the TV is idle (`AWAITING_PHONE` or `EXPIRED`), the TV automatically rotates its ephemeral pairing token every 90 seconds (`rotate-pairing-token`) and renders an always-scannable bottom-right QR beacon (`tv-zero-touch-qr-beacon`) without granting authorization or bypassing enrollment.
  8. **Preservation of SEC-LAN-001 Boundaries:** Host-only WebRTC (`iceServers: []`), `RTCDataChannel`-only remote control, zero public STUN/TURN, and zero WebSocket control commands remain strictly enforced.

### ADR-07: QR Pairing End-to-End Command Dispatch & Display View Transition Fix (STATUS: APPROVED)
- **Problem Statement:** Scanning the TV QR code with a phone to initiate phone-camera streaming failed to change the TV UI after connection establishment.
- **Root-Cause Analysis:**
  1. The reference `sendRemoteControlCommandRef` inside `useWebRTCStream.ts` was initialized to a dummy function `() => false` and was never updated to reference the active `sendRemoteControlCommand` callback.
  2. When the direct `RTCDataChannel` opened (`dc.onopen`), the hook attempted to dispatch `SWITCH_VIEW_STREAM` to automatically switch the TV display from `primary` (Waktu Solat) to `stream` (Siaran Langsung), but called the unbound dummy ref, resulting in a silent no-op.
  3. Commands dispatched before the DataChannel finished opening were immediately rejected instead of being queued for transmission upon channel readiness.
  4. On-mount signalling logic for QR codes (`params.initialRoomId && params.initialPairingToken`) did not check for an existing unexpired 14-day enrolled credential, forcing enrolled users through the first-time TV approval prompt again instead of zero-touch reconnection.
- **Resolution:**
  1. Correctly bound `sendRemoteControlCommandRef.current = sendRemoteControlCommand` on each render and synced in `useEffect`.
  2. Implemented command queuing (`queuedCommandRef.current`) in `sendRemoteControlCommand` when connection/approval is pending so commands are dispatched immediately upon channel open.
  3. Verified that `onRemoteCommandExecuted` in `App.tsx` immediately executes `setActiveView('stream')` upon receiving the authorized `SWITCH_VIEW_STREAM` / `START_STREAM` commands over RTCDataChannel.
  4. Updated sender on-mount effect to check `loadPhoneEnrolledCredentials()` for unexpired matching credentials, enabling immediate zero-touch challenge-response reconnection on QR scan.
  5. Added `enabled: activeView !== 'sender'` to `useWebRTCStream` in `App.tsx` so mobile devices viewing the sender interface do not run a redundant background TV display WebRTC session.
