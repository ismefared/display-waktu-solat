# GATE 2 — DATA & AUTHORITY
## Display Waktu Solat Malaysia

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-10-08  

---

## 1. Authoritative Source Verification Matrix

All required external and curated data domains have been verified for official status, availability, licensing, and fallback behaviour.

### 1.1 Domain 1: Prayer Times (`PR-001`) & Hijri Calendar (`CAL-002`)
1. **Provider:** Jabatan Kemajuan Islam Malaysia (JAKIM) — Portal e-Solat.
2. **Official Status:** Official Federal Islamic Authority of Malaysia (Authoritative Source of Truth).
3. **Documentation:** JAKIM e-Solat Takwim API (`r=esolatApi/takwimsolat`).
4. **Endpoint:** `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=week&zone={ZONE}` and `&period=month&zone={ZONE}`.
5. **Authentication:** Public government endpoint (no API key required).
6. **Rate Limit:** Public fair-use; mitigated by server-side caching (6-hour TTL) and client-side caching.
7. **Geographic Coverage:** All 14 Malaysian States & Federal Territories across 60 official JAKIM prayer zones (`JHR01`–`WLY02`).
8. **Data Freshness:** Daily / Weekly / Monthly official Takwim schedules including exact Hijri date (`YYYY-MM-DD`).
9. **Licensing:** Government of Malaysia Open Public Data.
10. **Attribution:** "Sumber Rasmi: e-Solat JAKIM".
11. **Reliability:** Live verified (`HTTP 200 OK`, returns JSON with `prayerTime` array containing `hijri`, `date`, `imsak`, `fajr`, `syuruk`, `dhuha`, `dhuhr`, `asr`, `maghrib`, `isha`).
12. **Error Behaviour:** Returns non-200 or `status != "OK!"` on invalid zone; handled via backend proxy validation.
13. **Caching:** Cached in Express server memory (6 hours) and browser `localStorage` (persisted for 7–30 days by zone).
14. **Alternative / Fallback Source:** Last verified multi-day JAKIM schedule stored in `localStorage` / server cache, plus deterministic verified offline baseline for Malaysia zones with explicit `STALE / OFFLINE` indicator.

---

### 1.2 Domain 2: Malaysian Weather (`WX-001`)
1. **Provider:** Jabatan Meteorologi Malaysia (MetMalaysia) via Official Malaysia Open Data API (`data.gov.my` / Kementerian Digital & MetMalaysia).
2. **Official Status:** Official Malaysian Government Meteorological Authority.
3. **Documentation:** `https://developer.data.gov.my/realtime-api/weather`
4. **Endpoint:** `https://api.data.gov.my/weather/forecast/?contains={LOCATION}@location__location_name&limit=7` (and full forecast dataset endpoint).
5. **Authentication:** Public Open Government API (no token required for standard rate; supports optional token).
6. **Rate Limit:** Public tier fair-use; proxied and cached on backend server for 30 minutes per query.
7. **Geographic Coverage:** Whole of Malaysia by State, District, and Town (`St001`..`Ds...`..`Tn...`).
8. **Data Freshness:** Updated daily/multi-times daily by MetMalaysia (`morning_forecast`, `afternoon_forecast`, `night_forecast`, `summary_forecast`, `min_temp`, `max_temp`).
9. **Licensing:** Open Government Data License Malaysia (Creative Commons Attribution 4.0).
10. **Attribution:** "Sumber: MetMalaysia (data.gov.my)".
11. **Reliability:** Live verified (`HTTP 200 OK` following trailing slash `https://api.data.gov.my/weather/forecast/?limit=...`).
12. **Error Behaviour:** HTTP 429/5xx or network timeout; isolated in `WeatherService` so prayer times are never affected.
13. **Caching:** 30-minute fresh cache; stale threshold at 3 hours; retains last known valid weather with `"Data Lapuk (Stale)"` badge if offline.
14. **Alternative / Fallback Source:** Retained cached MetMalaysia payload; if never fetched, displays graceful `"Maklumat cuaca sedang dikemas kini / tidak tersedia"` card.

---

### 1.3 Domain 3: Location & Coordinate-to-Zone Mapping (`LOC-001`, `LOC-002`)
1. **Provider:** W3C Browser Geolocation API (`navigator.geolocation`) + Verified JAKIM Official Zone Directory & Bounding Coordinates Dataset.
2. **Official Status:** Standard device hardware/browser GPS + Official JAKIM 60-Zone gazetted district definitions.
3. **Mechanism:**
   - Obtains `(latitude, longitude)` from browser.
   - Computes nearest/containing Malaysian JAKIM zone using verified zone reference centroids and state boundaries (covering Peninsular Malaysia, Sabah, Sarawak, and Labuan).
   - Displays detected zone name & code clearly, while allowing non-destructive manual override (`LOC-002`).

---

### 1.4 Domain 4: Islamic Events (`ISL-001`)
1. **Provider:** Verified JAKIM Takwim & Tarikh-Tarikh Penting Dalam Islam Malaysia Curated Dataset.
2. **Official Status:** Curated directly from official Malaysian Islamic Calendar (Takwim JAKIM / Pejabat Penyimpan Mohor Besar Raja-Raja).
3. **Coverage:** Major verified Hijri dates (e.g., 1 Muharram Maal Hijrah, 10 Muharram Hari Asyura, 12 Rabiulawal Maulidur Rasul, 27 Rejab Israk dan Mikraj, 15 Syaaban Nisfu Syaaban, 1 Ramadan Awal Ramadan, 17 Ramadan Nuzul Al-Quran, 1 Syawal Hari Raya Aidilfitri, 1 Zulhijjah Awal Zulhijjah, 9 Zulhijjah Hari Arafah, 10 Zulhijjah Hari Raya Aidiladha, Hari-hari Putih 13/14/15 setiap bulan Hijri).
4. **Safety Policy:** Zero generative fabrication. Distinguishes exact day match ("Peristiwa Hari Ini") vs upcoming event in the current Hijri month ("Peristiwa Bulan Ini"), or explicit neutral state ("Tiada peristiwa khas Islam pada tarikh Hijri hari ini").

---

### 1.5 Domain 5: Malaysian Historical Events (`MY-001`)
1. **Provider:** Verified Malaysian Historical Events Dataset (*Hari Ini Dalam Sejarah Malaysia* sourced from Arkib Negara Malaysia / Jabatan Penerangan Malaysia records).
2. **Official Status:** Verified historical records with year, date, title, factual summary, and explicit source citation.
3. **Safety Policy:** Never fabricates historical events. Matches exact `(month, day)` first; if no exact date event is in the verified local archive, displays verified milestone event for the current month with clear date attribution and neutral indication.

---

### 1.6 Domain 6: Daily Zikir (`ZIK-001`)
1. **Provider:** Verified Authentic Zikir & Mathurat Dataset (sourced from Sahih Al-Bukhari, Sahih Muslim, Sunan Abu Dawud, Jami' At-Tirmidhi, and JAKIM panduan zikir harian).
2. **Official Status:** Verified classical Hadith & Quranic texts.
3. **Safety Policy:** Deterministic selection by date (`dayOfYear` modulo dataset length, aligned with traditional Imam Al-Ghazali / authentic daily zikir cycle). Includes verified vocalized Arabic text, Rumi transliteration, Bahasa Melayu translation, and exact Hadith/Surah reference.

---

### 1.7 Domain 7: Live Mobile Streaming (`MED-001`, `MED-002`, `MED-003`)
1. **Provider:** Native Browser WebRTC (`RTCPeerConnection`, `MediaDevices.getUserMedia`) + First-Party Express WebSocket Signalling Server (`ws` on `/ws/signalling`).
2. **Official Status:** W3C/IETF WebRTC Standard + Google public STUN servers (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`) + local network ICE candidates.
