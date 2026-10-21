# GATE 0 — PRODUCT DEFINITION
## Display Waktu Solat Malaysia

**Version:** 1.0  
**Status:** PASS (Pending Gate 1 Authorization)  
**Date:** 2026-10-08  

---

## 1. Repository Baseline Inspection (Section 50 Compliance)

Before producing this Product Definition, the existing repository was inspected to establish the engineering baseline:

1. **Existing Project Type:** Greenfield Web Application (SPA template with Full-Stack Express capability).
2. **Existing Framework:** React 19 (`^19.0.1`) with Vite 8 (`^8.3.0`) and TypeScript (`^7.0.2`).
3. **Existing Architecture:** Minimal starter scaffold (`src/main.tsx`, `src/App.tsx`). No domain, service, or state layers exist yet.
4. **Existing Modules:** None beyond root React mount. Installed packages include `lucide-react`, `motion`, `express`, `dotenv`, `@google/genai`, and `@tailwindcss/vite` (`^4.3.3`).
5. **Existing API Integrations:** None implemented yet.
6. **Existing UI:** Empty `<div></div>` placeholder in `src/App.tsx`.
7. **Existing Tests:** No testing framework (e.g., Vitest/Playwright) or test suites currently installed or configured.
8. **Existing Deployment Configuration:** Vite SPA dev/build scripts (`vite --port=3000 --host=0.0.0.0`).
9. **Existing Documentation:** Governing specification (`Display-Waktu-Solat-AI-Agent-Master-Prompt-v1.0.md` provided in prompt context). `docs/` directory initiated in this gate.
10. **Existing Technical Debt:** Zero legacy code debt, but complete absence of testing harness, backend signalling/proxy server (`server.ts`), and domain architecture which must be designed in Gates 1–6 before coding.

---

## 2. Product Analysis

**Product Name:** Display Waktu Solat Malaysia  
**Primary Purpose:**  
Provide an authoritative, high-reliability, 24/7 fullscreen digital display for Malaysian prayer times (Waktu Solat) and contextual community/spiritual information, readable from a distance of **±10 metres**, supplemented by a secondary view for real-time mobile-to-display live video streaming.

Unlike mobile prayer apps designed for 30 cm personal viewing and touch interaction, **Display Waktu Solat Malaysia** is a **10-foot / 10-metre ambient signage and broadcast display system**. It prioritizes zero-clutter legibility, authoritative Malaysian data sources (JAKIM, MetMalaysia), deterministic daily religious/historical content, and resilient unattended operation.

---

## 3. Target Users

1. **Primary Viewers (Passive Audience at ±10m distance):**
   - Mosque (Masjid) and Surau congregations checking current/upcoming prayer times, countdowns, and lectures.
   - Office workers, school students, and community facility visitors glancing at prayer schedules and weather.
   - Household members viewing prayer times from across a living room.
2. **System Administrators / Operators (Active Configuration & Streaming Users):**
   - Mosque/Surau AJK (committee members), Imams, or Bilals configuring the prayer zone or initiating a live video stream (e.g., kuliah, khutbah, announcement) from a smartphone to the main display.
   - Home/Office owners setting up the display on a Smart TV, Android Box, or PC kiosk.

---

## 4. Target Devices

1. **Primary Target:** 16:9 Landscape Large Displays (1920x1080 Full HD and 3840x2160 4K TV screens) driven by:
   - Android TV / Google TV / Android Box browsers or WebViews.
   - Mini PC / Raspberry Pi / Desktop PC running fullscreen kiosk browser (Chromium/Chrome/Edge/Firefox).
2. **Secondary Display Target:** 1280x720 (HD Ready) screens, desktop monitors, and smaller browser windows.
3. **Companion / Streaming Sender Device:** Modern Mobile Browsers (iOS Safari, Android Chrome) used to scan QR / enter pairing code and broadcast live camera/microphone feed to the Second Page (`MED-001`) via WebRTC.
4. **Future Target:** Standalone packaged app (PWA / Android APK / Desktop wrapper) without requiring architectural rewrite.

---

## 5. Usage Environment

1. **Physical Environment:**
   - Large indoor halls (Mosque prayer halls, surau, lobbies, auditoriums) with high ambient light during the day and dimmed lighting during night prayers or kuliah.
   - Viewing distances ranging from 3 metres (home/office) to **10+ metres** (masjid/surau).
2. **Operational Environment:**
   - **24/7 Unattended Operation:** Expected to run continuously for weeks or months without manual page refreshes.
   - **Intermittent Network Connectivity:** Public/mosque Wi-Fi networks that may experience temporary drops, DNS failures, or ISP outages.
   - **Kiosk Constraints:** Limited or no physical keyboard/mouse attached during normal operation after initial setup.

---

## 6. Primary Use Cases

- **UC-01: Continuous Ambient Prayer & Countdown Display**  
  Viewers at 10m immediately identify the next prayer, real-time countdown (`HH:MM:SS`), and full daily prayer schedule (Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak) along with Gregorian and Hijri dates.
- **UC-02: Automatic & Manual Malaysian Prayer Zone Selection**  
  On startup, the system requests device geolocation, maps coordinates to the official JAKIM prayer zone (e.g., `WLY01`, `SGR01`), and displays prayer times. If geolocation is denied or unavailable, the operator explicitly selects the state and zone manually without silent overrides.
- **UC-03: Contextual Weather Monitoring**  
  Viewers see current local Malaysian weather conditions, temperature, state/icon, and last-updated timestamp sourced from an authoritative Malaysian meteorological provider.
- **UC-04: Daily Spiritual & Historical Enrichment**  
  Viewers read a verified daily Zikir (Arabic + translation/transliteration + reference), current Hijri Islamic event (or neutral state if none), and verified Malaysian historical event for today's date (`Hari Ini Dalam Sejarah`).
- **UC-05: Resilient Offline / Stale-Data Continuity**  
  When internet connectivity or an external API drops, the display continues counting down accurately using cached prayer schedules and local clock timing while visibly indicating data freshness (`Updated: HH:MM` or stale badge).
- **UC-06: Mobile-to-Display Live Video Streaming (Second Page)**  
  An operator switches to the Second Page (`MED-001`), pairs a smartphone via QR code or pairing code (`MED-002`), and streams live video/audio (e.g., live speaker/kuliah) onto the big screen with clear connection state telemetry (`MED-003`), returning smoothly to the prayer display when finished or disconnected.

---

## 7. Product Scope (In-Scope)

1. **Authoritative Prayer Time Display (`PR-001`):** Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak sourced from JAKIM / approved official JAKIM service.
2. **Location & Zone Management (`LOC-001`, `LOC-002`):** Browser geolocation with coordinate-to-JAKIM-zone resolution, explicit status feedback, and non-destructive manual zone fallback.
3. **Next Prayer & Precision Countdown Engine (`PR-002`, `PR-003`):** Malaysia timezone (`Asia/Kuala_Lumpur`) aware state machine handling daytime progression, post-Isyak, midnight rollover, and drift-free local countdown.
4. **Dual Calendar Display (`CAL-001`, `CAL-002`):** Gregorian date and authoritative JAKIM Hijri date.
5. **Verified Contextual Content (`ISL-001`, `MY-001`, `ZIK-001`):**
   - Islamic Events tied to Hijri date.
   - Malaysian Historical Events tied to Gregorian date (`DD-MM`).
   - Deterministic Daily Zikir with verified Arabic text, translation, and source reference.
6. **Authoritative Malaysian Weather (`WX-001`):** Local weather tied to active location/zone with freshness and stale-state indicators.
7. **Second Page Live Mobile Streaming (`MED-001`, `MED-002`, `MED-003`):** WebRTC-based phone-to-display live video streaming with QR/code pairing and full connection lifecycle state management.
8. **10-Metre Display UX & 24/7 Hardening:** 16:9 TV-first visual hierarchy, offline/cache resilience, memory-safe timers, and diagnostic recovery.

---

## 8. Out-of-Scope (Unless Explicitly Approved via Change Control)

1. Independent mathematical calculation of prayer times (e.g., astronomical formulas via `adhan-js`) in place of official JAKIM data.
2. Unverified or AI-hallucinated Quranic verses, Hadith, Arabic text, religious rulings (fatwa), or fabricated Malaysian history.
3. Generic third-party weather or Hijri providers chosen solely for convenience without Gate 2 Data Authority approval.
4. Multi-camera studio mixing, cloud video recording/archiving, or public social media broadcasting (YouTube/Facebook Live) on the streaming page.
5. Financial donation collection / payment gateway processing, mosque accounting, or complex CMS user-management portals.
6. AI chatbots, conversational assistants, or "Ask AI" overlays.

---

## 9. Assumptions

1. **A-01 (Timezone):** The target display operates in or displays time for Malaysia Standard Time (`Asia/Kuala_Lumpur`, UTC+8, no DST).
2. **A-02 (Device Capabilities):** The display device runs a modern evergreen browser engine supporting ES2022, CSS Grid/Flexbox, `localStorage`/`IndexedDB`, and `RTCPeerConnection` (WebRTC).
3. **A-03 (Mobile Camera Access):** The mobile phone used for streaming runs over a secure context (HTTPS) so `navigator.mediaDevices.getUserMedia` is permitted by mobile browsers.
4. **A-04 (Initial Network Access):** The device has internet connectivity at least during initial provisioning to fetch initial prayer zone schedules and weather data, and to establish WebRTC signalling.

---

## 10. Constraints

1. **C-01 (10-Metre Readability Hard Requirement):** All primary typography, contrast ratios, and layout densities must be legible from ±10 metres on a standard 16:9 TV.
2. **C-02 (Strict Source-of-Truth Hierarchy):** JAKIM for prayer times and Hijri dates; official Malaysian meteorological authority (`api.data.gov.my` / MetMalaysia) for weather; verified datasets for Islamic events, Malaysian history, and Zikir.
3. **C-03 (Runtime & Hosting Environment):** Runs on Node/Express + Vite on Port 3000 inside the AI Studio / Cloud Run container environment; no `window.alert` or `window.open`; secrets restricted to server-side environment variables.
4. **C-04 (Priority Degradation Hierarchy):** External API failures in lower priorities (Streaming, Zikir, History, Islamic Event, Weather) must never degrade higher priorities (1. Prayer display, 2. Countdown, 3. Date, 4. Location/zone).

---

## 11. Risks

| Risk ID | Risk Description | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | **JAKIM e-Solat Endpoint Availability / CORS / SSL Issues:** Direct browser requests to government endpoints may face CORS blocks or intermittent downtime. | High | Critical | Route through our Express backend proxy adapter (`/api/*`) with multi-day local + server caching and strict schema validation (to be finalized in Gates 2–4). |
| **R-02** | **Coordinate-to-JAKIM-Zone Mapping Accuracy:** Browser geolocation returns `(lat, lng)`, whereas JAKIM APIs query by Zone Code (e.g., `SGR01`, `WLY01`). | High | High | Establish an authoritative Malaysian district/polygon or coordinate-to-zone mapping mechanism in Gate 2, plus prominent manual zone confirmation (`LOC-002`). |
| **R-03** | **Post-Isyak & Midnight Rollover Bugs:** Between Isyak (e.g., 20:45) and Midnight (00:00), the next prayer is tomorrow's Subuh. Moreover, Islamic Hijri days traditionally transition at Maghrib while official calendar tables index by midnight. | Medium | High | Explicitly define deterministic transition rules in Gate 1 & Gate 6 and verify with unit tests across boundary timestamps in Gate 8. |
| **R-04** | **WebRTC NAT Traversal on Mosque/Corporate Firewalls:** Phone (on 4G/5G) and TV Display (on Mosque Wi-Fi) may be on different networks behind symmetric NATs. | Medium | Medium | Design WebRTC signalling via the full-stack Express server and document STUN/TURN requirements and graceful connection failure states in Gate 4. |
| **R-05** | **24/7 Browser Memory Leaks & Timer Drift:** `setInterval` drift or accumulated DOM/state objects over weeks of kiosk operation can freeze smart TV browsers. | Medium | High | Use wall-clock delta calculation (`Date.now()`) rather than cumulative interval counters, enforce bounded caches, and implement health watchdogs in Gate 9. |

---

## 12. Open Questions (To Be Resolved in Gates 1–4)

1. **OQ-01 (Prayer Time Display Scope — Immsak & Dhuha):** `PR-001` mandates at minimum *Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak*. Does the stakeholder want *Imsak* and *Dhuha* (if provided by JAKIM) excluded to maximize 10m typography size for the 6 mandatory times, or included as optional/secondary?
2. **OQ-02 (Default Fallback Zone):** When a brand-new kiosk boots up with Geolocation denied/unavailable and before manual selection is made, should it default to **WLY01 (Kuala Lumpur, Putrajaya)** with a prominent "Lokasi Lalai — Sila Sahkan Zon" banner, or wait on a setup prompt?
3. **OQ-03 (Hijri Rollover Convention):** Should the displayed Hijri date strictly match JAKIM's daily table date (changing at 00:00 midnight alongside the daily prayer timetable), or advance at Maghrib?
4. **OQ-04 (Second Page Audio/Layout Mode):** During live mobile streaming on the Second Page (`MED-001`), should a compact persistent prayer-time/countdown ticker remain visible at the bottom/top of the video stream so congregation members still see prayer times during a live talk?
5. **OQ-05 (Language Preference):** Should the primary display UI copy be strictly in **Bahasa Melayu** (standard for Malaysian mosques/surau, e.g., *Waktu Seterusnya*, *Subuh*, *Syuruk*, *Zohor*, *Asar*, *Maghrib*, *Isyak*), or support bilingual BM/EN toggles?
