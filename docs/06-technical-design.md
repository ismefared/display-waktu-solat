# GATE 6 — TECHNICAL DESIGN
## Display Waktu Solat Malaysia

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-10-08  

---

## 1. Repository & Module Structure

```
/
├── server.ts                              # Express API Proxy + WebSocket Signalling Server (Port 3000)
├── src/
│   ├── config/
│   │   └── appConfig.ts                   # Central intervals, cache TTLs, stale thresholds, default zone
│   ├── types/
│   │   └── domain.ts                      # Strict TypeScript interfaces for all domains
│   ├── data/
│   │   ├── jakimZones.ts                  # All 60 official JAKIM zones with coordinates & weather mapping
│   │   ├── islamicEvents.ts               # Verified JAKIM Takwim Hijri events dataset
│   │   ├── malaysianHistory.ts            # Verified Malaysian historical events (Arkib Negara reference)
│   │   └── dailyZikir.ts                  # Verified authentic daily Zikir (Arabic, Rumi, Translation, Hadith)
│   ├── domain/
│   │   ├── prayerEngine.ts                # Pure functions: MYT clock, next prayer, countdown, Hijri formatting
│   │   ├── webrtcUtils.ts                 # SEC-LAN-001 Host-Only ICE filter, Subnet validator & LanSessionGuard
│   │   └── zoneMapper.ts                  # Pure functions: Coordinate-to-JAKIM-zone distance/boundary resolver
│   ├── services/
│   │   ├── storageService.ts              # Safe localStorage wrapper with TTL & stale evaluation
│   │   ├── prayerService.ts               # JAKIM API client + multi-day cache + verified offline fallback
│   │   ├── weatherService.ts              # MetMalaysia API client + independent error/stale state handling
│   │   ├── locationService.ts             # Browser Geolocation wrapper + status state machine
│   │   └── contentService.ts              # Deterministic Islamic event, History, and Zikir selectors
│   ├── hooks/
│   │   ├── useMalaysiaTime.ts             # Drift-free wall-clock timer anchored to Asia/Kuala_Lumpur
│   │   └── useWebRTCStream.ts             # SEC-LAN-001 Host-Only WebRTC + P2P RTCDataChannel state machine
│   ├── components/
│   │   ├── TopBar.tsx                     # 3-zone top navigation bar (Primary, Stream, Zone Modal trigger)
│   │   ├── PrimaryDisplayView.tsx         # 10m 16:9 main prayer display implementing Levels 1–6
│   │   ├── StreamReceiverView.tsx         # Second page WebRTC display receiver + TV approval & QR pairing
│   │   ├── MobileSenderView.tsx           # Mobile phone camera broadcaster & P2P RTCDataChannel remote control
│   │   ├── TvPairingOverlay.tsx           # Non-intrusive TV pairing QR dock & global TV approval modal
│   │   ├── ZoneSelectorModal.tsx          # Auto-detect & manual state/zone selector modal
│   │   └── ErrorBoundary.tsx              # 24/7 fault-isolating React Error Boundary
│   ├── __tests__/
│   │   ├── prayerEngine.test.ts           # Unit tests for PR-001, PR-002, PR-003, CAL-001, CAL-002
│   │   ├── zoneMapper.test.ts             # Unit tests for LOC-001, LOC-002
│   │   ├── contentService.test.ts         # Unit tests for ISL-001, MY-001, ZIK-001
│   │   ├── resilience.test.ts             # Unit tests for WX-001, NFR-001, caching & stale thresholds
│   │   ├── responsiveLayout.test.ts       # Responsive layout & 10m viewport adaptation verification
│   │   ├── secLan001.test.ts              # SEC-LAN-001 Host-Only ICE, LanSessionGuard & replay protection tests
│   │   ├── gate11RemoteUx.test.ts         # Gate 11 Remote Control UX, pairing dock & state consistency tests
│   │   ├── gate12ZeroTouch.test.ts        # Gate 12 & SEC-LAN-002 Zero-Touch UX, 14d enrollment & challenge-response tests
│   │   ├── qrPairingWorkflow.test.ts      # QR Pairing 9-Step End-to-End Workflow & UI Transition Verification
│   │   └── serverIntegration.test.ts      # Live API & SEC-LAN-001/002 WebSocket signalling boundary tests
│   ├── App.tsx                            # Root view router & global state orchestrator
│   ├── main.tsx                           # Application entry point
│   └── index.css                          # Tailwind CSS + Google Fonts + tabular numerals rules
```

---

## 2. Requirement-to-Design Traceability Matrix

| Requirement ID | Architectural Layer | Technical Design Module(s) | Verification Test Suite |
| :--- | :--- | :--- | :--- |
| **PR-001** (Prayer Display) | Integration + Presentation | `server.ts`, `src/services/prayerService.ts`, `src/components/PrimaryDisplayView.tsx` | `prayerEngine.test.ts`, `resilience.test.ts` |
| **PR-002** (Next Prayer) | Domain | `src/domain/prayerEngine.ts` (`resolvePrayerState`) | `prayerEngine.test.ts` |
| **PR-003** (Countdown) | Domain + Application | `src/domain/prayerEngine.ts` (`formatCountdown`), `src/hooks/useMalaysiaTime.ts` | `prayerEngine.test.ts` |
| **LOC-001** (Auto Location) | Domain + Integration | `src/domain/zoneMapper.ts`, `src/services/locationService.ts` | `zoneMapper.test.ts` |
| **LOC-002** (Manual Fallback) | Data + Presentation | `src/data/jakimZones.ts`, `src/components/ZoneSelectorModal.tsx` | `zoneMapper.test.ts` |
| **CAL-001** (Gregorian Date) | Domain | `src/domain/prayerEngine.ts` (`getMalaysiaDateParts`, `formatGregorianDateBM`) | `prayerEngine.test.ts` |
| **CAL-002** (Hijri Date) | Domain + Integration | `src/domain/prayerEngine.ts` (`formatHijriDateBM`), `src/services/prayerService.ts` | `prayerEngine.test.ts` |
| **ISL-001** (Islamic Event) | Data + Integration | `src/data/islamicEvents.ts`, `src/services/contentService.ts` | `contentService.test.ts` |
| **MY-001** (Malaysian History)| Data + Integration | `src/data/malaysianHistory.ts`, `src/services/contentService.ts` | `contentService.test.ts` |
| **ZIK-001** (Daily Zikir) | Data + Integration | `src/data/dailyZikir.ts`, `src/services/contentService.ts` | `contentService.test.ts` |
| **WX-001** (Weather) | Integration + Presentation | `server.ts`, `src/services/weatherService.ts`, `src/components/PrimaryDisplayView.tsx` | `resilience.test.ts` |
| **MED-001..003** (Streaming) | Server + Hook + UI | `server.ts` (`/ws/signalling`), `src/hooks/useWebRTCStream.ts`, `StreamReceiverView.tsx`, `MobileSenderView.tsx` | `secLan001.test.ts`, `gate11RemoteUx.test.ts`, `gate12ZeroTouch.test.ts`, `qrPairingWorkflow.test.ts`, `serverIntegration.test.ts` |
| **SEC-LAN-001 / 002** (Zero-Touch Same-LAN Control) | Domain + Server + Hook | `src/domain/webrtcUtils.ts`, `server.ts`, `src/hooks/useWebRTCStream.ts`, `TvPairingOverlay.tsx` | `secLan001.test.ts`, `gate11RemoteUx.test.ts`, `gate12ZeroTouch.test.ts`, `qrPairingWorkflow.test.ts`, `serverIntegration.test.ts` |
| **UI-001..002** (10m UX) | Presentation | `src/index.css`, `src/components/PrimaryDisplayView.tsx` | `responsiveLayout.test.ts`, `gate11RemoteUx.test.ts`, `gate12ZeroTouch.test.ts` |
| **SEC-001 / NFR-001..002** | Cross-Cutting | `src/config/appConfig.ts`, `src/components/ErrorBoundary.tsx`, `src/services/storageService.ts` | `resilience.test.ts`, `serverIntegration.test.ts` |



