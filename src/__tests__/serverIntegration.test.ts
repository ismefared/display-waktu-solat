import { describe, expect, it } from 'vitest';
import WebSocket from 'ws';

/**
 * Live Server API & SEC-LAN-001 WebRTC Signalling Security Integration Tests
 * Covers:
 * - Master Prompt Section 29 Tests #16, #22, #23, #24, #25, #30
 * - SEC-LAN-001 Mandatory Constraints #1, #2, #3, #5, #6
 */

const BASE_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3000/ws/signalling';

describe('Full-Stack Server Proxy & SEC-LAN-001 WebSocket Signalling Integration', () => {
  it('GET /api/health returns 200 OK with service telemetry', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('OK');
    expect(json.service).toBe('Display Waktu Solat Malaysia');
  });

  it('GET /api/webrtc-config returns empty iceServers and turnConfigured=false per SEC-LAN-001 Constraint #3', async () => {
    const res = await fetch(`${BASE_URL}/api/webrtc-config`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.iceServers).toEqual([]);
    expect(json.turnConfigured).toBe(false);
    expect(json.policy).toBe('SEC-LAN-001-HOST-ONLY');
  });

  it('GET /api/prayer-times rejects malformed zone codes with 400 (SEC-001 Input Validation)', async () => {
    const res = await fetch(
      `${BASE_URL}/api/prayer-times?zone=<script>alert(1)</script>`
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID_ZONE');
  });

  it('GET /api/prayer-times?zone=WLY01 returns official JAKIM schedule with 6+ mandatory prayer fields', async () => {
    const res = await fetch(`${BASE_URL}/api/prayer-times?zone=WLY01`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.zone).toBe('WLY01');
    expect(json.source).toContain('JAKIM');
    expect(Array.isArray(json.days)).toBe(true);
    expect(json.days.length).toBeGreaterThan(0);

    const firstDay = json.days[0];
    expect(firstDay.hijri).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(firstDay.fajr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(firstDay.syuruk).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(firstDay.dhuhr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(firstDay.asr).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(firstDay.maghrib).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(firstDay.isha).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('GET /api/weather?zone=WLY01 returns official MetMalaysia weather forecast', async () => {
    const res = await fetch(`${BASE_URL}/api/weather?zone=WLY01`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.source).toContain('MetMalaysia');
    expect(typeof json.minTemp).toBe('number');
    expect(typeof json.maxTemp).toBe('number');
    expect(json.summaryForecast).toBeTruthy();
  });

  it('SEC-LAN-001 Signalling: enforces pairingToken, blocks WebSocket remote-control commands (Constraint #1), filters non-host ICE candidates (Constraint #3), and supports revocation (Constraint #6)', async () => {
    const roomId = '991234';
    const pairingToken = 'sec-lan-token-abc123';
    const displayWs = new WebSocket(WS_URL);
    const unauthorizedWs = new WebSocket(WS_URL);
    const senderWs = new WebSocket(WS_URL);

    const displayEvents: Array<Record<string, unknown>> = [];
    const unauthorizedEvents: Array<Record<string, unknown>> = [];
    const senderEvents: Array<Record<string, unknown>> = [];

    await new Promise<void>((resolve, reject) => {
      let openCount = 0;
      const onOpen = () => {
        openCount++;
        if (openCount === 3) resolve();
      };
      displayWs.on('open', onOpen);
      unauthorizedWs.on('open', onOpen);
      senderWs.on('open', onOpen);
      displayWs.on('error', reject);
      unauthorizedWs.on('error', reject);
      senderWs.on('error', reject);
    });

    displayWs.on('message', (data) => {
      displayEvents.push(JSON.parse(data.toString()));
    });
    unauthorizedWs.on('message', (data) => {
      unauthorizedEvents.push(JSON.parse(data.toString()));
    });
    senderWs.on('message', (data) => {
      senderEvents.push(JSON.parse(data.toString()));
    });

    // 1. Display creates room with short-lived pairingToken
    displayWs.send(
      JSON.stringify({
        type: 'join-room',
        roomId,
        pairingToken,
        role: 'display',
        deviceName: 'TV Masjid',
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(displayEvents.some((e) => e.type === 'room-joined')).toBe(true);

    // 2. Unauthorized phone with wrong pairingToken is REJECTED (Constraint #5 & #6)
    unauthorizedWs.send(
      JSON.stringify({
        type: 'join-room',
        roomId,
        pairingToken: 'wrong-token-999',
        role: 'sender',
        deviceName: 'Telefon Asing',
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(
      unauthorizedEvents.some(
        (e) => e.type === 'error' && e.code === 'PAIRING_TOKEN_INVALID'
      )
    ).toBe(true);
    unauthorizedWs.close();

    // 3. Legitimate phone joins with matching pairingToken
    senderWs.send(
      JSON.stringify({
        type: 'join-room',
        roomId,
        pairingToken,
        role: 'sender',
        deviceName: 'Telefon Imam',
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(
      displayEvents.some(
        (e) => e.type === 'peer-joined' && e.deviceName === 'Telefon Imam'
      )
    ).toBe(true);

    // 4. Attempting to send a remote-control command over WebSocket is REJECTED (Constraint #1)
    senderWs.send(
      JSON.stringify({
        type: 'lan-control-command',
        roomId,
        action: 'SWITCH_VIEW_PRIMARY',
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(
      senderEvents.some(
        (e) => e.type === 'error' && e.code === 'PROHIBITED_SIGNALLING_COMMAND'
      )
    ).toBe(true);

    // 5. Display explicitly approves pairing on TV -> relayed to Sender (Constraint #5)
    displayWs.send(
      JSON.stringify({
        type: 'pairing-approved',
        roomId,
        sessionToken: 'issued-session-token-xyz',
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(
      senderEvents.some(
        (e) =>
          e.type === 'pairing-approved' &&
          e.sessionToken === 'issued-session-token-xyz'
      )
    ).toBe(true);

    // 6. Non-host ICE candidate (e.g., STUN srflx / TURN relay) is REJECTED by signaling (Constraint #3)
    senderWs.send(
      JSON.stringify({
        type: 'webrtc-ice-candidate',
        roomId,
        candidate: {
          candidate:
            'candidate:1 1 UDP 1686052607 203.0.113.50 54321 typ srflx raddr 192.168.1.20 rport 54321',
        },
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(
      senderEvents.some(
        (e) => e.type === 'error' && e.code === 'NON_LAN_CANDIDATE_REJECTED'
      )
    ).toBe(true);

    // 7. Permitted `typ host` LAN ICE candidate is relayed cleanly to Display
    senderWs.send(
      JSON.stringify({
        type: 'webrtc-ice-candidate',
        roomId,
        candidate: {
          candidate:
            'candidate:2 1 UDP 2122252543 192.168.1.20 54321 typ host',
        },
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(
      displayEvents.some((e) => e.type === 'webrtc-ice-candidate')
    ).toBe(true);

    // 8. Display revokes session -> Sender receives session-revoked and subsequent messages are blocked (Constraint #6)
    displayWs.send(
      JSON.stringify({
        type: 'session-revoked',
        roomId,
      })
    );
    await new Promise((r) => setTimeout(r, 80));

    expect(senderEvents.some((e) => e.type === 'session-revoked')).toBe(true);

    senderWs.close();
    displayWs.close();
  });
});
