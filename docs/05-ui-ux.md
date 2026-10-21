# GATE 5 — UX/UI DESIGN SPECIFICATION
## Display Waktu Solat Malaysia (10-Metre Viewing Target)

**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-10-08  

---

## 1. 10-Metre Viewing Ergonomics & Aesthetic Direction

- **Primary Target:** 1920x1080 (16:9 Full HD) & 4K landscape displays viewed from **±10 metres** in a Mosque, Surau, Office, or Home.
- **Visual Identity:** *Architectural Islamic Sanctuary* — Deep obsidian-emerald slate canvas (`#060D0C` / `#0A1412`), crisp alabaster/ivory primary numerals (`#F8FAFC`), warm burnished gold accents (`#D4AF37` / `#F59E0B`) reserved strictly for the **Next Prayer** focal anchor, and emerald highlights (`#10B981`) for active prayer states.
- **Anti-Slop & Zero-Pill Discipline:**
  - Zero nested cards-within-cards.
  - Zero decorative pill badges on static metadata; metadata uses clean typographic separators (`·`).
  - Single-elevation structural panels separated by `1px solid rgba(255, 255, 255, 0.08)` hairlines.
- **Typography & Tabular Discipline:**
  - Display / Headings: `'Plus Jakarta Sans'`, semi-bold/bold, tight tracking.
  - Numerals / Countdown / Prayer Times: `'JetBrains Mono'` / monospace with mandatory `font-variant-numeric: tabular-nums` so countdown ticks never jitter horizontally.
  - Arabic Text (Zikir): `'Amiri'` / `'Scheherazade New'` / system Arabic serif with generous line-height (`1.8`) and vocalization clarity.

---

## 2. Six-Level Information Hierarchy (Section 8 Compliance)

| Level | Information Domain | Visual Weight & Placement | 1080p Target Scale |
| :--- | :--- | :--- | :--- |
| **LEVEL 1** | **Current / Next Prayer & Countdown** | Primary Focal Anchor (Hero Left/Center Panel). High-contrast gold/emerald border accent, giant tabular countdown (`HH:MM:SS`). | Countdown: `4.5rem–6rem` (`72px–96px`)<br>Prayer Name: `2.5rem–3.25rem` |
| **LEVEL 2** | **Prayer Timetable (6 Mandatory Times)** | Full-width 6-column architectural grid (*Subuh, Syuruk, Zohor, Asar, Maghrib, Isyak*). Next prayer column is highlighted with gold top border & elevated luminance. | Prayer Time: `2.25rem–3rem` (`36px–48px`)<br>Label: `1.25rem–1.5rem` |
| **LEVEL 3** | **Current Date (Gregorian + Hijri)** | Prominent top-right or header monument alongside live Malaysia clock (`HH:MM:SS`). | Clock: `2.5rem–3rem`<br>Dates: `1.25rem–1.5rem` |
| **LEVEL 4** | **Location / Prayer Zone** | Interactive zone selector bar in header showing State, Zone Code (`WLY01`), Zone Name, and detection status (`Lokasi Dikesan` / `Pilihan Manual`). | `1rem–1.25rem` |
| **LEVEL 5** | **Weather (`MetMalaysia`)** | Dedicated atmospheric panel showing temperature range (`24°C – 33°C`), condition icon, forecast summary, and `"Dikemas kini: HH:MM"`. | Temp: `2rem–2.5rem`<br>Summary: `1.125rem` |
| **LEVEL 6** | **Islamic Event, Malaysian History & Daily Zikir** | Quiet, dignified lower/right editorial panels with clear source attribution and zero visual competition against Levels 1 & 2. | Titles: `1.125rem–1.25rem`<br>Arabic Zikir: `1.75rem–2.25rem` |

---

## 3. Primary Display Wireframe (1920x1080 16:9 Layout)

```
+--------------------------------------------------------------------------------------------------+
| [Brand: DISPLAY WAKTU SOLAT MALAYSIA]   [Nav: Paparan Utama | Siaran Langsung]   [Zon: WLY01 v]  |
+--------------------------------------------------------------------------------------------------+
| TARIKH HARI INI (LEVEL 3 & 4)                        | WAKTU SEMASA (ASIA/KUALA LUMPUR)          |
| Khamis, 8 Oktober 2026  ·  26 Rabiulakhir 1448H      | 14 : 32 : 10                              |
| WLY01 — Kuala Lumpur, Putrajaya (Sumber: JAKIM)      | Dikemas kini: 14:00 · Status: Rasmi (Live)|
+------------------------------------------------------+-------------------------------------------+
|                                                      | CUACA TEMPATAN (LEVEL 5 - MetMalaysia)    |
| WAKTU SOLAT SETERUSNYA (LEVEL 1 - FOCAL ANCHOR)      | 24°C - 32°C  ·  WP Kuala Lumpur           |
|                                                      | Ribut petir di beberapa tempat (Petang)   |
|               A S A R                                +-------------------------------------------+
|                                                      | ZIKIR HARIAN (LEVEL 6 - ZIK-001)          |
|         0 1 : 4 4 : 5 0                              | سُبْحَانَ اللَّهِ وَبِحَمْدِهِ                       |
|      Menuju jam 16:17 (Waktu Semasa: Zohor)          | "Maha Suci Allah dan segala puji bagi-Nya"|
|                                                      | Riwayat Al-Bukhari & Muslim               |
+------------------------------------------------------+-------------------------------------------+
| JADUAL WAKTU SOLAT HARIAN (LEVEL 2 - 6 MANDATORY COLUMNS)                                        |
| +--------------+--------------+--------------+--------------+--------------+-------------------+ |
| | SUBUH        | SYURUK       | ZOHOR (Kini) | *ASAR (Seter)| MAGHRIB      | ISYAK             | |
| | 05:52        | 06:58        | 13:04        | 16:17        | 19:04        | 20:14             | |
| +--------------+--------------+--------------+--------------+--------------+-------------------+ |
+--------------------------------------------------------------------------------------------------+
| PERISTIWA ISLAM (LEVEL 6 - ISL-001)                  | HARI INI DALAM SEJARAH MALAYSIA (MY-001)  |
| 26 Rabiulakhir 1448H · Tiada peristiwa khas hari ini | 8 Oktober · Penubuhan / Peristiwa Sejarah |
| (Seterusnya: 1 Jamadilawal 1448H)                    | Sumber: Arkib Negara Malaysia             |
+--------------------------------------------------------------------------------------------------+
```

---

## 4. Second Page / Live Streaming UX (`MED-001` – `MED-003`)

1. **Persistent Top Mini-Prayer Ribbon:** Even while streaming a live lecture/khutbah, the top bar displays the current clock, **Next Prayer Name**, and **Live Countdown (`HH:MM:SS`)** so the congregation never misses prayer entry.
2. **State-Driven Main Stage:**
   - `WAITING` / `PAIRING`: Displays step-by-step instructions in Bahasa Melayu, a high-contrast **QR Code** (linking directly to `?mode=sender&room=XXXXXX`), and the large 6-digit Pairing Code (`849 201`), plus a button to open the Mobile Broadcaster directly on a phone or test camera locally.
   - `CONNECTING` / `RECONNECTING`: Shows connection progress with peer device name.
   - `CONNECTED` / `STREAMING`: Full-stage 16:9 `<video>` canvas with fullscreen toggle, audio mute/unmute toggle, connection badge, and `"Tamatkan Siaran / Kembali ke Paparan Solat"` button.
   - `DISCONNECTED` / `FAILED`: Clear diagnostic explanation with `"Cuba Semula ( Jana Kod Baharu )"` and `"Kembali ke Paparan Utama"`.

---

## 5. Responsive Multi-Resolution & Viewport Fit Rules (`UI-001`, `UI-002`)

1. **Landscape Fullscreen/Kiosk Viewport Lock (`>= 1024px` width & `>= 640px` height):**
   - `.app-viewport-shell` locks height to `100dvh` (`overflow: hidden`) so that `1280×720`, `1366×768`, `1600×900`, `1920×1080`, and `2560×1440` displays fit 100% of all 4 rows cleanly inside a single screen without vertical or horizontal scrollbars.
   - All flex/grid children enforce `min-w-0` and `min-h-0` so long JAKIM zone names (e.g., `SGR01`, `KTN01`, `SWK06`) and Arabic/translation texts truncate or clamp cleanly without pushing cards outside the viewport.
2. **2D Fluid Typography & Spacing (`clamp()` with `min(vw, vh)`):**
   - Typography and container padding scale proportionally to both viewport width and viewport height (`clamp(min, min(Xvw, Yvh), max)`), preserving the 8-level priority hierarchy at `720p`/`768p` while expanding to full 10-metre scale at `1080p`/`1440p`.
3. **Narrow / Portrait Viewport Fallback (`< 1024px` width or `< 640px` height):**
   - On smaller windows, tablets, and mobile portrait screens, vertical scrolling is enabled and the 6-column prayer timetable adapts smoothly to `3 columns` (`sm:grid-cols-3`) and `2 columns` (`grid-cols-2`).

---

## 6. Gate 11 — Remote Control UX & Interaction Design (`SEC-LAN-001` Compliant)

1. **Discoverable Non-Intrusive TV Pairing Dock (`TvPairingOverlay.tsx`):**
   - Because the Smart TV operates primarily as a dedicated prayer-time display (`Paparan Waktu Solat`), users must not be forced to attach a physical TV keyboard or mouse merely to navigate to the streaming screen before pairing a phone.
   - A compact, non-obscuring dock in the bottom-right corner (`Kawalan Telefon (LAN) · Bilik XXXXXX`) allows the QR code and short-lived token to be viewed on-demand without covering any prayer times or countdown numerals.
   - Furthermore, the TV maintains its background pairing listener while on `Paparan Waktu Solat`.
2. **Global TV Authorization Prompt (`PENDING_TV_APPROVAL`):**
   - When a phone submits a valid short-lived pairing token (`?mode=sender&room=XXXXXX&token=YYYYYY`), the TV automatically surfaces a prominent modal banner (`tv-pairing-approval-banner`) across whichever view is active (`Paparan Waktu Solat` or `Paparan Siaran Langsung`).
   - Supports Smart TV D-pad remote `Enter/OK` (auto-focused on `"Luluskan Telefon Ini"`), numeric key `1` (Approve), and `Escape/Back/2` (Reject), alongside touch/click.
3. **Touch-Friendly Mobile Remote Controller (`MobileSenderView.tsx`):**
   - Connects first in **Remote Control Mode** without demanding camera permissions upfront.
   - Provides three primary touch-friendly (`min-h-[56px]`) actions:
     1. `1. Paparan Waktu Solat` (`SWITCH_VIEW_PRIMARY` over `RTCDataChannel`)
     2. `2. Paparan Siaran Langsung` (`SWITCH_VIEW_STREAM` over `RTCDataChannel`)
     3. `3. Mod Kamera Telefon` (Displays camera permission explanation first, requests `getUserMedia` only on confirmation, and starts live broadcast)
   - Separates **Control Channel Status** (`dataChannelState === 'open'`), **Confirmed TV Mode** (`confirmedTvView`), and **Actual TV Video Playback** (`tvMediaPlaying` triggered by `<video onPlaying>`).

---

## 7. Gate 12 — Zero-Touch Smart TV UX & Trusted-Device Enrollment (`SEC-LAN-002`)

1. **Always-Scannable Zero-Touch QR Pairing Beacon (`tv-zero-touch-qr-beacon`):**
   - When the Smart TV is idle (`AWAITING_PHONE`), the bottom-right dock displays a scannable QR code and 6-digit Room ID directly on screen without obscuring any prayer times, countdown numerals, or contextual cards.
   - The ephemeral pairing token rotates automatically every 90 seconds while idle so the QR beacon never locks up with an expired token requiring a TV mouse/remote click.
2. **First-Time Enrollment & Trusted-Device Management (`TvPairingOverlay.tsx`):**
   - First-time pairing surfaces the TV approval banner with two approval choices: **`Luluskan & Daftarkan (14 Hari)`** (default focus, TV remote `OK/Enter/1`) and **`Sesi Ini Sahaja (30m)`** (TV remote `2`), plus **`Tolak`** (`Escape/3`).
   - A dedicated TV management drawer (`tv-trusted-devices-drawer`) lists all enrolled phones with remaining validity days and one-click **Single-Device Revocation** (`Batalkan`) and **All-Device Revocation** (`Batalkan Semua`).
3. **Zero-Touch Trusted Phone Reconnection (`MobileSenderView.tsx`):**
   - Enrolled administrator phones store their 14-day credential (`dws_phone_enrolled_creds_v1`) and automatically complete an HMAC-SHA256 challenge-response handshake on subsequent visits (`trusted-device-reconnect-card` / `btn-zero-touch-reconnect`), reconnecting to the TV's `RTCDataChannel` without requiring physical TV interaction.

---

## 8. QR Pairing & TV Display View Transition Workflow (Steps 1 through 9)

1. **Step 1 (QR Scan):** User points mobile phone camera at the Smart TV's QR pairing beacon.
2. **Step 2 (Pairing URL):** Mobile browser opens `?mode=sender&room=XXXXXX&token=YYYYYY`. `App.tsx` routes to `MobileSenderView` and disables redundant display WebRTC listeners.
3. **Step 3 (TV Pairing Request Identification):** Mobile connects to WebSocket signalling and joins the TV room. TV displays the `PENDING_TV_APPROVAL` banner.
4. **Step 4 (Authentication & Authorization):**
   - *First-Time Phone:* TV operator approves via remote/click (`approvePendingPairingOnTv`).
   - *Enrolled Trusted Phone:* Phone completes zero-touch HMAC-SHA256 challenge-response automatically.
5. **Step 5 (Approved Control Connection):** P2P host-only WebRTC establishes direct `RTCDataChannel` (`dataChannelState === 'open'`).
6. **Step 6 (Command Dispatch & TV UI Transition):** Mobile automatically dispatches `SWITCH_VIEW_STREAM` over the authenticated DataChannel. TV validates command with `sessionGuard`, calls `handleRemoteCommandExecuted('SWITCH_VIEW_STREAM')`, and transitions display UI to `StreamReceiverView`. TV responds with `lan-control-ack` (`resultingView: 'stream'`).
7. **Step 7 (Camera Permission):** Mobile user taps *Mod Kamera Telefon*, reviews permission explanation, and grants camera access via browser `getUserMedia`.
8. **Step 8 (Media Connection):** Mobile acquires local video tracks, adds tracks to PeerConnection, and renegotiates SDP offer/answer with TV.
9. **Step 9 (Remote Video Playback):** TV receives inbound video track in `pc.ontrack`, renders it into `<video>`, triggers `notifyTvVideoPlaying(true)`, and syncs confirmed playback state back to the mobile phone.
