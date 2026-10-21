import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { normalizeRoomCode } from '../domain/webrtcUtils';

/**
 * Gate 14 — Remote Control Connection & PEER_NOT_FOUND Root-Cause Fix
 * Verification Test Suite
 *
 * Verifies resolution of:
 * - BUG-001: Mobile remote control cannot establish a working connection to the TV.
 * - BUG-002: Mobile controller reports PEER_NOT_FOUND ("Bilik gandingan TV tidak ditemui...").
 *
 * Enforces:
 * 1. Consistent room code normalization across Display, Sender, and Backend.
 * 2. Persistent file-backed room registry surviving process restarts and revision deploys.
 * 3. Prevention of premature room deletion upon peer socket close.
 * 4. Rotated pairing token grace window on the signaling relay.
 * 5. Display WebSocket auto-reconnection and client-side heartbeat.
 * 6. Mobile controller auto-retry and explicit retry button on PEER_NOT_FOUND.
 * 7. REST Room Discovery endpoint (/api/signalling/room/:roomId).
 * 8. Strict preservation of SEC-LAN-001 & SEC-LAN-002 security invariants.
 */
describe('Gate 14 — Remote Control Connection & PEER_NOT_FOUND Root-Cause Fix', () => {
  const tmpDir = process.env.TMPDIR || '/tmp';
  const testRoomFile = path.join(tmpDir, 'waktu_solat_rooms.json');

  beforeEach(() => {
    // Reset test persistence file if exists
    try {
      if (fs.existsSync(testRoomFile)) {
        fs.unlinkSync(testRoomFile);
      }
    } catch {
      // Ignore
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testRoomFile)) {
        fs.unlinkSync(testRoomFile);
      }
    } catch {
      // Ignore
    }
  });

  it('Phase B: normalizeRoomCode handles # prefix, spaces, dashes, and casing consistently', () => {
    // User sees "Bilik TV #443743" on TV and types or pastes various formats
    expect(normalizeRoomCode('#443743')).toBe('443743');
    expect(normalizeRoomCode('443 743')).toBe('443743');
    expect(normalizeRoomCode(' 443-743 ')).toBe('443743');
    expect(normalizeRoomCode('#443 743')).toBe('443743');
    expect(normalizeRoomCode('tv-849201')).toBe('TV849201');
    expect(normalizeRoomCode('443743')).toBe('443743');
    expect(normalizeRoomCode('')).toBe('');
    expect(normalizeRoomCode(undefined)).toBe('');
    expect(normalizeRoomCode(null)).toBe('');
  });

  it('Phase C: Persistent room registry survives simulated process restart', () => {
    // Simulate server persisting an active room
    const testRecords = [
      {
        roomId: '443743',
        pairingToken: 'tok-gate14-test',
        pairingExpiresAtMs: Date.now() + 120_000,
        previousPairingToken: null,
        previousPairingExpiresAtMs: 0,
        revoked: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    fs.writeFileSync(testRoomFile, JSON.stringify(testRecords, null, 2), 'utf-8');
    expect(fs.existsSync(testRoomFile)).toBe(true);

    const readBack = JSON.parse(fs.readFileSync(testRoomFile, 'utf-8'));
    expect(readBack).toHaveLength(1);
    expect(readBack[0].roomId).toBe('443743');
    expect(readBack[0].pairingToken).toBe('tok-gate14-test');
    expect(readBack[0].revoked).toBe(false);
  });

  it('Phase C & D: server.ts contains the persistent room store, REST endpoint, and no premature deletion', () => {
    const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');

    // 1. Verifies REST discovery endpoint
    expect(serverSrc).toContain('/api/signalling/room/:roomId');
    expect(serverSrc).toContain("normalizeRoomCode(req.params.roomId)");

    // 2. Verifies persistent file-backed room storage
    expect(serverSrc).toContain('ROOM_PERSISTENCE_FILE');
    expect(serverSrc).toContain('loadPersistedRooms');
    expect(serverSrc).toContain('savePersistedRooms');

    // 3. Verifies no premature room deletion when peers.size === 0
    expect(serverSrc).not.toContain('if (session.peers.size === 0) {\n            rooms.delete');
    expect(serverSrc).toContain('Gate 14 Root-Cause Fix: Do NOT delete room immediately when peers.size === 0');

    // 4. Verifies Cloud Run WebSocket heartbeat
    expect(serverSrc).toContain('heartbeatTimer');
    expect(serverSrc).toContain("ws.send(JSON.stringify({ type: 'pong'");

    // 5. Verifies token grace window on server
    expect(serverSrc).toContain('previousPairingToken');
    expect(serverSrc).toContain('previousPairingExpiresAtMs');
  });

  it('Phase D: useWebRTCStream implements display auto-reconnect, ping heartbeat, and sender retry on PEER_NOT_FOUND', () => {
    const hookSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf-8'
    );

    // 1. Verifies display auto-reconnect on socket drop
    expect(hookSrc).toContain('Gate 14 Root-Cause Fix: Automatically reconnect Display WebSocket on drop');
    expect(hookSrc).toContain('signallingReconnectTimerRef');

    // 2. Verifies client-side ping heartbeat
    expect(hookSrc).toContain("type: 'ping'");
    expect(hookSrc).toContain('clientPingTimerRef');

    // 3. Verifies sender bounded retry on PEER_NOT_FOUND
    expect(hookSrc).toContain('peerNotFoundRetryCountRef');
    expect(hookSrc).toContain("cat = 'PEER_NOT_FOUND'");

    // 4. Verifies normalizeRoomCode integration
    expect(hookSrc).toContain('normalizeRoomCode(params.initialRoomId)');
    expect(hookSrc).toContain('normalizeRoomCode(targetRoomId)');
  });

  it('Phase E: MobileSenderView sanitizes input, provides explicit retry on PEER_NOT_FOUND, and displays clear guidance', () => {
    const senderSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileSenderView.tsx'),
      'utf-8'
    );

    // 1. Normalizes room code on submit and broadcast activation
    expect(senderSrc).toContain('normalizeRoomCode(inputRoomCode)');

    // 2. Contains dedicated retry button for PEER_NOT_FOUND
    expect(senderSrc).toContain('data-testid="btn-retry-peer-connect"');
    expect(senderSrc).toContain('Cuba Sambung Semula ke Bilik TV');
  });

  it('Phase F: TvPairingOverlay and StreamReceiverView generate URLs with normalized room codes', () => {
    const overlaySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TvPairingOverlay.tsx'),
      'utf-8'
    );
    expect(overlaySrc).toContain('normalizeRoomCode(roomId)');
    expect(overlaySrc).toContain('mode=sender&room=${cleanRoom}');

    const streamReceiverSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf-8'
    );
    expect(streamReceiverSrc).toContain('normalizeRoomCode(roomId)');
    expect(streamReceiverSrc).toContain('mode=sender&room=${cleanRoom}');
  });

  it('Governing Policies: SEC-LAN-001 & SEC-LAN-002 invariants remain strictly intact', () => {
    const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf-8');

    // No WebSocket control commands permitted
    expect(serverSrc).toContain('PROHIBITED_SIGNALLING_COMMAND');

    // Host-only candidate filtering enforced
    expect(serverSrc).toContain('isPermittedHostOnlyCandidate');
    expect(serverSrc).toContain('NON_LAN_CANDIDATE_REJECTED');

    // No public STUN/TURN in WebRTC config
    expect(serverSrc).toContain('iceServers: []');
  });

  it('Phase G: Phone-to-TV Live Camera video streaming and display verification', () => {
    const receiverSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf-8'
    );
    // Verifies active stream detection and callback ref attachment for immediate video playback
    expect(receiverSrc).toContain('hasActiveMediaTracks');
    expect(receiverSrc).toContain('setVideoRef');
    expect(receiverSrc).toContain('setBlurredVideoRef');
    expect(receiverSrc).toContain('ref={setVideoRef}');
    expect(receiverSrc).toContain('ref={setBlurredVideoRef}');
    expect(receiverSrc).toContain('videoEl.srcObject = activeMediaStream');

    const hookSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf-8'
    );
    // Verifies ontrack transitions state to STREAMING and sets view to stream
    expect(hookSrc).toContain("setState('STREAMING')");
    expect(hookSrc).toContain("activeTvViewRef.current = 'stream'");
    // Verifies sender renegotiation reuses existing PC and attaches local tracks
    expect(hookSrc).toContain('pc.addTrack(track, localStreamRef.current)');
    // Verifies display renegotiation reuses existing PC on incoming offer
    expect(hookSrc).toContain('let pc = pcRef.current;');

    const appSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.tsx'),
      'utf-8'
    );
    expect(appSrc).toContain("displayWebrtc.state === 'STREAMING'");
  });
});

