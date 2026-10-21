import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { getZoneByCode } from './src/data/jakimZones.ts';
import { normalizeJakimDateToIso } from './src/domain/prayerEngine.ts';
import {
  areIpsInSameLocalSubnet,
  isPermittedHostOnlyCandidate,
  isPrivateOrLoopbackIp,
  normalizeRoomCode,
} from './src/domain/webrtcUtils.ts';
import { DailyPrayerSchedule, PrayerApiPayload } from './src/types/domain.ts';

/**
 * Display Waktu Solat Malaysia — Full-Stack Server & WebRTC Signalling Hub
 * Traceability:
 * - Gate 3 (API Contracts: /api/prayer-times, /api/weather, /ws/signalling)
 * - Gate 4 (System Architecture: Proxy Adapter, In-Memory Cache, WS Room Relay)
 * - SEC-001 (Input Validation, Timeouts, Safe Error Responses)
 */

// In AI Studio / dev environments, dev server must bind to port 3000.
// In containerized production, use process.env.PORT if provided.
const PORT =
  process.env.NODE_ENV === 'production' && process.env.PORT
    ? Number(process.env.PORT)
    : 3000;

interface CacheEntry<T> {
  data: T;
  fetchedAtEpochMs: number;
  fetchedAtIso: string;
}

const prayerCache = new Map<string, CacheEntry<PrayerApiPayload>>();
const weatherCache = new Map<string, CacheEntry<Record<string, unknown>>>();

const PRAYER_FRESH_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const WEATHER_FRESH_TTL_MS = 30 * 60 * 1000; // 30 minutes
const UPSTREAM_TIMEOUT_MS = 8000;

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = UPSTREAM_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DisplayWaktuSolatMalaysia/1.0',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWithRetry(
  url: string,
  retries: number = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(url);
      if (res.ok) return res;
      lastError = new Error(`Upstream HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

export async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // Health Check Endpoint (Gate 9 Hardening)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'OK',
      service: 'Display Waktu Solat Malaysia',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  // SEC-LAN-001 Mandatory Constraint #3:
  // No public STUN or TURN service may be used for the protected local-only session.
  app.get('/api/webrtc-config', (_req, res) => {
    res.json({
      iceServers: [],
      turnConfigured: false,
      policy: 'SEC-LAN-001-HOST-ONLY',
      pairingTokenTtlMs: 120000,
    });
  });

  /**
   * Contract 1: Official JAKIM e-Solat Proxy Endpoint
   * GET /api/prayer-times?zone=WLY01&period=week
   */
  app.get('/api/prayer-times', async (req, res) => {
    const rawZone = String(req.query.zone || 'WLY01')
      .trim()
      .toUpperCase();
    if (!/^[A-Z]{3}\d{2}$/.test(rawZone)) {
      res.status(400).json({
        error: 'INVALID_ZONE',
        message: 'Kod zon JAKIM tidak sah.',
      });
      return;
    }

    const period = req.query.period === 'month' ? 'month' : 'week';
    const zoneMeta = getZoneByCode(rawZone);
    const cacheKey = `${zoneMeta.code}_${period}`;

    // 1. Check fresh server cache
    const cached = prayerCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAtEpochMs < PRAYER_FRESH_TTL_MS) {
      res.json({
        ...cached.data,
        isStale: false,
      });
      return;
    }

    // 2. Query official JAKIM e-Solat API
    const jakimUrl = `https://www.e-solat.gov.my/index.php?r=esolatApi/takwimsolat&period=${period}&zone=${encodeURIComponent(
      zoneMeta.code
    )}`;

    try {
      const upstreamRes = await fetchWithRetry(jakimUrl, 2);
      const rawJson = (await upstreamRes.json()) as {
        status?: string;
        prayerTime?: Array<Record<string, string>>;
      };

      if (
        !rawJson ||
        !Array.isArray(rawJson.prayerTime) ||
        rawJson.prayerTime.length === 0
      ) {
        throw new Error('Empty prayerTime array from JAKIM e-Solat');
      }

      const days: DailyPrayerSchedule[] = rawJson.prayerTime.map((item) => ({
        hijri: String(item.hijri || ''),
        date: String(item.date || ''),
        isoDate: normalizeJakimDateToIso(String(item.date || '')),
        day: String(item.day || ''),
        imsak: String(item.imsak || '05:40:00'),
        fajr: String(item.fajr || '05:50:00'),
        syuruk: String(item.syuruk || '07:00:00'),
        dhuha: String(item.dhuha || '07:25:00'),
        dhuhr: String(item.dhuhr || '13:10:00'),
        asr: String(item.asr || '16:25:00'),
        maghrib: String(item.maghrib || '19:15:00'),
        isha: String(item.isha || '20:25:00'),
      }));

      const fetchedAt = new Date().toISOString();
      const payload: PrayerApiPayload = {
        zone: zoneMeta.code,
        zoneName: zoneMeta.name,
        stateName: zoneMeta.state,
        source: 'e-Solat JAKIM',
        fetchedAt,
        isStale: false,
        days,
      };

      prayerCache.set(cacheKey, {
        data: payload,
        fetchedAtEpochMs: Date.now(),
        fetchedAtIso: fetchedAt,
      });

      res.json(payload);
    } catch (error) {
      // If upstream fails but we have a stale cache entry, serve stale with isStale: true
      if (cached) {
        res.json({
          ...cached.data,
          isStale: true,
        });
        return;
      }

      res.status(502).json({
        error: 'UPSTREAM_UNAVAILABLE',
        message:
          'Perkhidmatan e-Solat JAKIM tidak dapat dihubungi buat sementara waktu.',
        zone: zoneMeta.code,
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Contract 2: Official Malaysia Open Data / MetMalaysia Weather Proxy
   * GET /api/weather?zone=WLY01&query=Kuala+Lumpur
   */
  app.get('/api/weather', async (req, res) => {
    const rawZone = String(req.query.zone || 'WLY01')
      .trim()
      .toUpperCase();
    const zoneMeta = getZoneByCode(rawZone);
    const searchQuery = String(req.query.query || zoneMeta.weatherQuery).trim();
    const cacheKey = `wx_${zoneMeta.code}`;

    const cached = weatherCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAtEpochMs < WEATHER_FRESH_TTL_MS) {
      res.json({
        ...cached.data,
        isStale: false,
      });
      return;
    }

    try {
      const encodedQuery = encodeURIComponent(
        `${searchQuery}@location__location_name`
      );
      const url = `https://api.data.gov.my/weather/forecast/?contains=${encodedQuery}&limit=7`;

      let upstreamRes = await fetchWithRetry(url, 1);
      let items = (await upstreamRes.json()) as Array<{
        location?: { location_id?: string; location_name?: string };
        date?: string;
        morning_forecast?: string;
        afternoon_forecast?: string;
        night_forecast?: string;
        summary_forecast?: string;
        summary_when?: string;
        min_temp?: number;
        max_temp?: number;
      }>;

      // If specific district query returns empty, try state name query
      if (!Array.isArray(items) || items.length === 0) {
        const stateEncoded = encodeURIComponent(
          `${zoneMeta.state}@location__location_name`
        );
        upstreamRes = await fetchWithRetry(
          `https://api.data.gov.my/weather/forecast/?contains=${stateEncoded}&limit=7`,
          1
        );
        items = await upstreamRes.json();
      }

      // If still empty, fetch general national forecast list
      if (!Array.isArray(items) || items.length === 0) {
        upstreamRes = await fetchWithRetry(
          'https://api.data.gov.my/weather/forecast/?limit=25',
          1
        );
        items = await upstreamRes.json();
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('Tiada rekod ramalan cuaca daripada MetMalaysia');
      }

      // Sort or pick the record closest to today's date
      const todayIso = new Date(Date.now() + 8 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const chosen =
        items.find((i) => i.date === todayIso) ||
        items[items.length - 1] ||
        items[0];

      const fetchedAt = new Date().toISOString();
      const normalized = {
        locationId: chosen.location?.location_id || zoneMeta.code,
        locationName:
          chosen.location?.location_name ||
          `${zoneMeta.name} (${zoneMeta.state})`,
        date: chosen.date || todayIso,
        morningForecast: chosen.morning_forecast || 'Tiada Hujan',
        afternoonForecast: chosen.afternoon_forecast || 'Berawan',
        nightForecast: chosen.night_forecast || 'Tiada Hujan',
        summaryForecast:
          chosen.summary_forecast ||
          chosen.afternoon_forecast ||
          'Cuaca baik di kebanyakan kawasan',
        summaryWhen: chosen.summary_when || 'Hari Ini',
        minTemp: typeof chosen.min_temp === 'number' ? chosen.min_temp : 24,
        maxTemp: typeof chosen.max_temp === 'number' ? chosen.max_temp : 32,
        source: 'MetMalaysia (data.gov.my)',
        fetchedAt,
        isStale: false,
      };

      weatherCache.set(cacheKey, {
        data: normalized,
        fetchedAtEpochMs: Date.now(),
        fetchedAtIso: fetchedAt,
      });

      res.json(normalized);
    } catch (error) {
      if (cached) {
        res.json({
          ...cached.data,
          isStale: true,
        });
        return;
      }

      res.status(502).json({
        error: 'WEATHER_UNAVAILABLE',
        message: 'Perkhidmatan cuaca MetMalaysia tidak dapat dihubungi.',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Gate 14 Root Cause Fix: Persistent file-backed room storage
  // Survives server restarts, revision deployments, and process recycling.
  const ROOM_PERSISTENCE_FILE = path.join(
    process.env.TMPDIR || '/tmp',
    'waktu_solat_rooms.json'
  );

  interface PersistedRoomRecord {
    roomId: string;
    pairingToken: string;
    pairingExpiresAtMs: number;
    previousPairingToken?: string | null;
    previousPairingExpiresAtMs?: number;
    revoked: boolean;
    createdAt: number;
    updatedAt: number;
  }

  interface RoomPeer {
    ws: WebSocket;
    role: 'display' | 'sender';
    deviceName: string;
    remoteIp: string;
    isCloudProxied: boolean;
    joinedAt: number;
  }

  interface RoomSession {
    roomId: string;
    pairingToken: string;
    pairingExpiresAtMs: number;
    previousPairingToken?: string | null;
    previousPairingExpiresAtMs?: number;
    revoked: boolean;
    peers: Set<RoomPeer>;
    lastOfferSdp: unknown | null;
    senderCandidates: Array<{ candidate?: string; [k: string]: unknown }>;
    createdAt: number;
    updatedAt: number;
  }

  const PAIRING_TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes short-lived pairing token TTL
  const ROOM_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes max room lifecycle

  function loadPersistedRooms(): Map<string, RoomSession> {
    const map = new Map<string, RoomSession>();
    try {
      if (fs.existsSync(ROOM_PERSISTENCE_FILE)) {
        const raw = fs.readFileSync(ROOM_PERSISTENCE_FILE, 'utf-8');
        const records = JSON.parse(raw) as PersistedRoomRecord[];
        const now = Date.now();
        if (Array.isArray(records)) {
          for (const r of records) {
            if (r && r.roomId && now - r.updatedAt < ROOM_EXPIRY_MS) {
              map.set(r.roomId, {
                roomId: r.roomId,
                pairingToken: r.pairingToken,
                pairingExpiresAtMs: r.pairingExpiresAtMs,
                previousPairingToken: r.previousPairingToken || null,
                previousPairingExpiresAtMs: r.previousPairingExpiresAtMs || 0,
                revoked: Boolean(r.revoked),
                peers: new Set(),
                lastOfferSdp: null,
                senderCandidates: [],
                createdAt: r.createdAt || now,
                updatedAt: r.updatedAt || now,
              });
            }
          }
        }
      }
    } catch {
      // Ignore read error
    }
    return map;
  }

  const rooms = loadPersistedRooms();

  function savePersistedRooms(roomsMap: Map<string, RoomSession>): void {
    try {
      const records: PersistedRoomRecord[] = [];
      for (const s of roomsMap.values()) {
        records.push({
          roomId: s.roomId,
          pairingToken: s.pairingToken,
          pairingExpiresAtMs: s.pairingExpiresAtMs,
          previousPairingToken: s.previousPairingToken || null,
          previousPairingExpiresAtMs: s.previousPairingExpiresAtMs || 0,
          revoked: s.revoked,
          createdAt: s.createdAt,
          updatedAt: s.updatedAt,
        });
      }
      fs.writeFileSync(
        ROOM_PERSISTENCE_FILE,
        JSON.stringify(records, null, 2),
        'utf-8'
      );
    } catch {
      // Ignore write error
    }
  }

  // Gate 14: REST API to verify room existence, active state, and pairing status
  app.get('/api/signalling/room/:roomId', (req, res) => {
    const cleanId = normalizeRoomCode(req.params.roomId);
    const session = rooms.get(cleanId);
    if (!session) {
      res.status(404).json({
        exists: false,
        code: 'PEER_NOT_FOUND',
        message: 'Bilik TV tidak ditemui atau belum diaktifkan.',
      });
      return;
    }
    const hasDisplay = Array.from(session.peers).some(
      (p) => p.role === 'display' && p.ws.readyState === WebSocket.OPEN
    );
    res.json({
      exists: true,
      roomId: session.roomId,
      hasDisplay,
      revoked: session.revoked,
      pairingExpiresAtMs: session.pairingExpiresAtMs,
    });
  });

  // Create HTTP server and attach WebSocket signalling server
  const server = http.createServer(app);
  const wss = new WebSocketServer({
    server,
    path: '/ws/signalling',
  });

  // Periodic cleanup of expired signalling sessions (only after 15m of no peers or ROOM_EXPIRY_MS)
  const roomCleanupTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, session] of rooms.entries()) {
      if (
        (session.peers.size === 0 && now - session.updatedAt > 15 * 60 * 1000) ||
        now - session.updatedAt > ROOM_EXPIRY_MS
      ) {
        rooms.delete(id);
        changed = true;
      }
    }
    if (changed) {
      savePersistedRooms(rooms);
    }
  }, 30 * 1000);
  roomCleanupTimer.unref?.();

  // Cloud Run WebSocket Heartbeat (ping every 20s to prevent cloud proxy idle drop)
  const heartbeatTimer = setInterval(() => {
    wss.clients.forEach((wsClient) => {
      if (wsClient.readyState === WebSocket.OPEN) {
        try {
          wsClient.ping();
        } catch {
          // Ignore
        }
      }
    });
  }, 20 * 1000);
  heartbeatTimer.unref?.();

  wss.on('connection', (ws, req) => {
    let currentRoomId: string | null = null;
    let currentPeer: RoomPeer | null = null;

    const rawSocketIp = req.socket?.remoteAddress || '127.0.0.1';
    const isCloudProxied = Boolean(req.headers['x-forwarded-for']);

    ws.on('message', (rawBuffer) => {
      try {
        const msg = JSON.parse(rawBuffer.toString()) as {
          type?: string;
          roomId?: string;
          tvId?: string;
          pairingToken?: string;
          role?: 'display' | 'sender';
          deviceName?: string;
          deviceId?: string;
          reconnectAsTrusted?: boolean;
          challengeNonce?: string;
          timestampMs?: number;
          proofHex?: string;
          sessionToken?: string;
          expiresAtMs?: number;
          maxSessionExpiresAtMs?: number;
          trustedCredential?: unknown;
          sdp?: unknown;
          candidate?: { candidate?: string; [k: string]: unknown };
          action?: string;
        };

        if (!msg || typeof msg.type !== 'string') return;

        // SEC-LAN-001 & SEC-LAN-002 Mandatory Constraint:
        // Remote-control commands must NEVER be sent through the WebSocket signaling channel.
        // Reject any remote control command frame immediately on the signaling channel.
        if (
          msg.type === 'lan-control-command' ||
          msg.type === 'remote-command' ||
          msg.type === 'control-command' ||
          typeof msg.action === 'string'
        ) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'PROHIBITED_SIGNALLING_COMMAND',
              message:
                'Pelanggaran SEC-LAN-001: Arahan kawalan jauh dilarang sama sekali melalui saluran isyarat WebSocket. Semua arahan mesti melalui saluran P2P RTCDataChannel tempatan yang disahkan.',
            })
          );
          return;
        }

        const now = Date.now();

        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: now }));
          return;
        }

        const roomId = normalizeRoomCode(String(msg.roomId || currentRoomId || ''));

        if (!roomId) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'INVALID_ROOM_ID',
              message: 'Kod bilik gandingan tidak sah.',
            })
          );
          return;
        }

        if (msg.type === 'join-room') {
          const role = msg.role === 'sender' ? 'sender' : 'display';
          const deviceName = String(
            msg.deviceName ||
              (role === 'sender' ? 'Telefon Pintar' : 'Paparan Utama')
          ).slice(0, 40);
          const providedToken = String(msg.pairingToken || '').trim();
          const reconnectAsTrusted = Boolean(msg.reconnectAsTrusted);
          const deviceId = String(msg.deviceId || '').trim();

          // SEC-LAN-001 Mandatory Constraint #8:
          // Local socket/subnet validation when running directly on a local appliance (no cloud proxy)
          if (!isCloudProxied && !isPrivateOrLoopbackIp(rawSocketIp)) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'NON_LAN_SOCKET_REJECTED',
                message:
                  'Pelanggaran SEC-LAN-001: Sambungan daripada alamat IP awam luar ditolak oleh pelayan perkakas tempatan.',
              })
            );
            return;
          }

          if (currentRoomId && currentPeer && currentRoomId !== roomId) {
            const prevSession = rooms.get(currentRoomId);
            if (prevSession) {
              prevSession.peers.delete(currentPeer);
            }
          }

          if (role === 'display') {
            // Display initializes or refreshes the short-lived pairing session with a pairingToken
            const existing = rooms.get(roomId);
            const tokenToUse =
              providedToken ||
              existing?.pairingToken ||
              Math.random().toString(36).slice(2, 14);

            const session: RoomSession = existing || {
              roomId,
              pairingToken: tokenToUse,
              pairingExpiresAtMs: now + PAIRING_TOKEN_TTL_MS,
              previousPairingToken: null,
              previousPairingExpiresAtMs: 0,
              revoked: false,
              peers: new Set(),
              lastOfferSdp: null,
              senderCandidates: [],
              createdAt: now,
              updatedAt: now,
            };

            if (providedToken) {
              session.pairingToken = providedToken;
              session.pairingExpiresAtMs = now + PAIRING_TOKEN_TTL_MS;
              session.revoked = false;
            }
            session.updatedAt = now;
            rooms.set(roomId, session);
            savePersistedRooms(rooms);

            for (const p of Array.from(session.peers)) {
              if (p.ws === ws || p.ws.readyState !== WebSocket.OPEN) {
                session.peers.delete(p);
              }
            }

            currentRoomId = roomId;
            currentPeer = {
              ws,
              role: 'display',
              deviceName,
              remoteIp: rawSocketIp,
              isCloudProxied,
              joinedAt: now,
            };
            session.peers.add(currentPeer);

            const otherPeers = Array.from(session.peers).filter(
              (p) => p !== currentPeer && p.ws.readyState === WebSocket.OPEN
            );

            ws.send(
              JSON.stringify({
                type: 'room-joined',
                roomId,
                role: 'display',
                pairingToken: session.pairingToken,
                pairingExpiresAtMs: session.pairingExpiresAtMs,
                peerCount: otherPeers.length,
                peers: otherPeers.map((p) => ({
                  role: p.role,
                  deviceName: p.deviceName,
                })),
              })
            );
            return;
          }

          // SENDER ROLE JOINING:
          // Supports either:
          // (A) First-time / Unenrolled Phone with a valid short-lived `pairingToken` (SEC-LAN-001 Constraint #5 & #6)
          // (B) Enrolled Trusted Administrator Phone initiating cryptographic challenge-response (`reconnectAsTrusted: true`, SEC-LAN-002 Req #2)
          const session = rooms.get(roomId);
          if (!session) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'PEER_NOT_FOUND',
                message:
                  'Bilik gandingan TV tidak ditemui atau belum diaktifkan pada skrin paparan.',
              })
            );
            return;
          }

          if (session.revoked && !reconnectAsTrusted) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'SESSION_REVOKED',
                message:
                  'Sesi gandingan ini telah dibatalkan (Revoked) oleh skrin TV.',
              })
            );
            return;
          }

          // SEC-LAN-001 Constraint #8: Local Appliance Subnet Verification
          const displayPeer = Array.from(session.peers).find(
            (p) => p.role === 'display' && p.ws.readyState === WebSocket.OPEN
          );
          if (
            displayPeer &&
            !isCloudProxied &&
            !displayPeer.isCloudProxied &&
            !areIpsInSameLocalSubnet(displayPeer.remoteIp, rawSocketIp)
          ) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'DIFFERENT_SUBNET_REJECTED',
                message:
                  'Pelanggaran SEC-LAN-001: Telefon pintar dan TV tidak berada dalam subnet LAN tempatan yang sama.',
              })
            );
            return;
          }

          if (!reconnectAsTrusted) {
            const isCurrentToken =
              providedToken && providedToken === session.pairingToken;
            const isPreviousToken = Boolean(
              session.previousPairingToken &&
                providedToken === session.previousPairingToken &&
                now <= (session.previousPairingExpiresAtMs || 0)
            );

            if (!isCurrentToken && !isPreviousToken) {
              if (now > session.pairingExpiresAtMs) {
                ws.send(
                  JSON.stringify({
                    type: 'error',
                    code: 'SESSION_EXPIRED',
                    message:
                      'Token gandingan telah tamat tempoh (Expired). Sila imbas Kod QR baharu pada skrin TV.',
                  })
                );
                return;
              }

              ws.send(
                JSON.stringify({
                  type: 'error',
                  code: 'PAIRING_TOKEN_INVALID',
                  message:
                    'Token gandingan keselamatan tidak sah (Invalid Pairing Token). Imbas Kod QR rasmi pada skrin TV.',
                })
              );
              return;
            }
          } else if (!deviceId) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'TRUSTED_CREDENTIAL_INVALID',
                message: 'Identiti Peranti Dipercayai tidak dinyatakan.',
              })
            );
            return;
          }

          for (const p of Array.from(session.peers)) {
            if (
              p.ws === ws ||
              p.role === 'sender' ||
              p.ws.readyState !== WebSocket.OPEN
            ) {
              session.peers.delete(p);
            }
          }

          session.lastOfferSdp = null;
          session.senderCandidates = [];
          session.revoked = false;
          session.updatedAt = now;

          currentRoomId = roomId;
          currentPeer = {
            ws,
            role: 'sender',
            deviceName,
            remoteIp: rawSocketIp,
            isCloudProxied,
            joinedAt: now,
          };
          session.peers.add(currentPeer);

          const otherPeers = Array.from(session.peers).filter(
            (p) => p !== currentPeer && p.ws.readyState === WebSocket.OPEN
          );

          ws.send(
            JSON.stringify({
              type: 'room-joined',
              roomId,
              role: 'sender',
              reconnectAsTrusted,
              peerCount: otherPeers.length,
              peers: otherPeers.map((p) => ({
                role: p.role,
                deviceName: p.deviceName,
              })),
            })
          );

          for (const peer of otherPeers) {
            if (reconnectAsTrusted) {
              // Notify Display that an enrolled Trusted Device is requesting a cryptographic challenge
              peer.ws.send(
                JSON.stringify({
                  type: 'trusted-reconnect-request',
                  roomId,
                  deviceId,
                  deviceName,
                })
              );
            } else {
              // Notify Display that a verified token holder has requested first-time on-TV pairing approval
              peer.ws.send(
                JSON.stringify({
                  type: 'peer-joined',
                  roomId,
                  role: 'sender',
                  deviceName,
                  deviceId,
                  pairingToken: providedToken,
                })
              );
            }
          }
          return;
        }

        const session = rooms.get(roomId);
        if (!session || !currentPeer || !session.peers.has(currentPeer)) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'UNAUTHORIZED_SESSION',
              message:
                'Sesi tidak sah atau belum disahkan untuk bilik gandingan ini.',
            })
          );
          return;
        }

        // SEC-LAN-002 Requirement #7: Display rotates its idle ephemeral pairing token every 90s
        if (
          msg.type === 'rotate-pairing-token' &&
          currentPeer.role === 'display'
        ) {
          const nextToken = String(msg.pairingToken || '').trim();
          if (nextToken) {
            session.previousPairingToken = session.pairingToken;
            session.previousPairingExpiresAtMs = now + 45_000; // 45s grace window
            session.pairingToken = nextToken;
            session.pairingExpiresAtMs = now + PAIRING_TOKEN_TTL_MS;
            session.revoked = false;
            session.updatedAt = now;
            savePersistedRooms(rooms);
            ws.send(
              JSON.stringify({
                type: 'pairing-token-rotated',
                roomId,
                pairingToken: session.pairingToken,
                pairingExpiresAtMs: session.pairingExpiresAtMs,
              })
            );
          }
          return;
        }

        if (session.revoked) {
          ws.send(
            JSON.stringify({
              type: 'error',
              code: 'SESSION_REVOKED',
              message: 'Sesi gandingan telah dibatalkan oleh TV.',
            })
          );
          return;
        }

        session.updatedAt = now;

        // TV explicit pairing authorization / trusted challenge / revocation events (SEC-LAN-001 & SEC-LAN-002)
        if (
          (msg.type === 'pairing-approved' ||
            msg.type === 'pairing-rejected' ||
            msg.type === 'session-revoked' ||
            msg.type === 'trusted-challenge' ||
            msg.type === 'trusted-reconnect-approved' ||
            msg.type === 'trusted-reconnect-rejected' ||
            msg.type === 'trusted-device-revoked') &&
          currentPeer.role === 'display'
        ) {
          if (
            msg.type === 'session-revoked' ||
            msg.type === 'trusted-device-revoked'
          ) {
            session.revoked = true;
          }
          savePersistedRooms(rooms);
          for (const peer of session.peers) {
            if (peer.ws !== ws && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(JSON.stringify(msg));
            }
          }
          return;
        }

        // Sender submits cryptographic proof response to TV's challenge
        if (
          msg.type === 'trusted-challenge-response' &&
          currentPeer.role === 'sender'
        ) {
          for (const peer of session.peers) {
            if (peer.ws !== ws && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(JSON.stringify(msg));
            }
          }
          return;
        }

        // SEC-LAN-001 Constraint #3: Filter ICE candidates at the signaling boundary
        // Only permit `typ host` candidates; reject `srflx` / `relay` / public IPs
        if (msg.type === 'webrtc-ice-candidate') {
          const candStr = msg.candidate?.candidate;
          if (!isPermittedHostOnlyCandidate(candStr)) {
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'NON_LAN_CANDIDATE_REJECTED',
                message:
                  'Polisi SEC-LAN-001: Calon ICE bukan tempatan (STUN/TURN/Public IP) telah ditolak.',
              })
            );
            return;
          }
        }

        // SEC-LAN-001 Constraint #2: Signaling carries ONLY minimal short-lived SDP/ICE bootstrap messages
        if (
          msg.type === 'webrtc-offer' ||
          msg.type === 'webrtc-answer' ||
          msg.type === 'webrtc-ice-candidate' ||
          msg.type === 'request-offer'
        ) {
          for (const peer of session.peers) {
            if (peer.ws !== ws && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(JSON.stringify(msg));
            }
          }
        }

      } catch {
        // Ignore malformed JSON frames
      }
    });

    const cleanupPeer = () => {
      if (currentRoomId && currentPeer) {
        const session = rooms.get(currentRoomId);
        if (session) {
          session.peers.delete(currentPeer);
          if (currentPeer.role === 'sender') {
            session.lastOfferSdp = null;
            session.senderCandidates = [];
          }
          for (const peer of session.peers) {
            if (peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(
                JSON.stringify({
                  type: 'peer-left',
                  roomId: currentRoomId,
                  role: currentPeer.role,
                  deviceName: currentPeer.deviceName,
                })
              );
            }
          }
          session.updatedAt = Date.now();
          savePersistedRooms(rooms);
          // Gate 14 Root-Cause Fix: Do NOT delete room immediately when peers.size === 0.
          // Display or sender may be reconnecting; let ROOM_EXPIRY_MS or 15m idle cleanup handle it.
        }
      }
      currentRoomId = null;
      currentPeer = null;
    };

    ws.on('close', cleanupPeer);
    ws.on('error', cleanupPeer);
  });

  // Mount Vite in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Display Waktu Solat Malaysia] Server running on http://0.0.0.0:${PORT}`
    );
  });

  return server;
}

startServer();
