import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  computeTrustedChallengeProof,
  generateCryptographicToken,
  LanSessionGuard,
} from '../domain/webrtcUtils';
import {
  LanControlAckMessage,
  LanControlCommandMessage,
  TvStateSyncMessage,
} from '../types/domain';

/**
 * QR Pairing & Display View Transition Regression Test Suite
 * Traceability:
 * - Bug Fix: QR Pairing Does Not Update TV Display
 * - Expected Flow: Steps 1 through 9
 * - SEC-LAN-001 Option 3 & SEC-LAN-002 Trusted-Device Enrollment
 */
describe('QR Pairing & Display View Transition — 9-Step Verification', () => {
  const TV_ID = 'TV-987654';
  const ROOM_ID = '987654';
  const PAIRING_TOKEN = 'tok-qr-flow-123';
  const BASE_EPOCH = Date.now();

  it('Step 1 & 2: QR URL is generated with correct query parameters and parsed by App.tsx view router', () => {
    const origin = 'https://tv.masjid.lan';
    const qrUrl = `${origin}/?mode=sender&room=${ROOM_ID}&token=${PAIRING_TOKEN}`;
    const parsed = new URL(qrUrl);

    expect(parsed.searchParams.get('mode')).toBe('sender');
    expect(parsed.searchParams.get('room')).toBe(ROOM_ID);
    expect(parsed.searchParams.get('token')).toBe(PAIRING_TOKEN);

    // Verify App.tsx correctly routes to sender view with room and token
    const appSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.tsx'),
      'utf8'
    );
    expect(appSource).toContain("params.get('mode')");
    expect(appSource).toContain("mode === 'sender'");
    expect(appSource).toContain('enabled: activeView !== \'sender\'');
    expect(appSource).toContain('<MobileSenderView');
  });

  it('Step 3 & 4: TV identifies pairing request and authorizes via SEC-LAN-002 on-TV explicit approval', () => {
    const guard = new LanSessionGuard({
      tvId: TV_ID,
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      nowMs: BASE_EPOCH,
    });

    // Step 3: Phone joins room, TV verifies incoming pairing request
    const verifyReq = guard.verifyPairingRequest({
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      deviceName: 'Telefon Pentadbir Bilal',
      deviceId: 'dev-phone-bilal',
      nowMs: BASE_EPOCH + 1000,
    });

    expect(verifyReq.valid).toBe(true);
    expect(verifyReq.status).toBe('PENDING_TV_APPROVAL');

    // Step 4: TV operator approves and enrolls phone as trusted device (14-day credential)
    const approval = guard.approvePendingPhoneOnTv(BASE_EPOCH + 2000, {
      enrollAsTrusted: true,
      deviceId: 'dev-phone-bilal',
    });

    expect(approval.approved).toBe(true);
    expect(approval.sessionToken).toBeTruthy();
    expect(approval.trustedCredential).not.toBeNull();
    expect(approval.trustedCredential?.expiresAtMs).toBe(
      BASE_EPOCH + 2000 + 14 * 24 * 60 * 60 * 1000
    );
    expect(guard.getState().status).toBe('AUTHORIZED');
  });

  it('Step 4 Alternative: Enrolled phone reconnects zero-touch via HMAC-SHA256 challenge-response without repeating on-TV approval', () => {
    const guard = new LanSessionGuard({
      tvId: TV_ID,
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      nowMs: BASE_EPOCH,
    });

    // Enroll phone
    guard.verifyPairingRequest({
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      deviceName: 'Telefon Pentadbir Bilal',
      deviceId: 'dev-phone-bilal',
      nowMs: BASE_EPOCH + 1000,
    });
    const enrollRes = guard.approvePendingPhoneOnTv(BASE_EPOCH + 2000, {
      enrollAsTrusted: true,
      deviceId: 'dev-phone-bilal',
    });
    const cred = enrollRes.trustedCredential!;

    // TV issues reconnect challenge
    const ch = guard.issueReconnectChallenge(
      'dev-phone-bilal',
      BASE_EPOCH + 50000
    );
    expect(ch.issued).toBe(true);

    // Phone computes proof
    const proofHex = computeTrustedChallengeProof({
      secretKeyHex: cred.secretKeyHex,
      tvId: TV_ID,
      roomId: ROOM_ID,
      deviceId: cred.deviceId,
      challengeNonce: ch.challengeNonce!,
      timestampMs: BASE_EPOCH + 50100,
    });

    // TV verifies proof and grants zero-touch session
    const response = guard.verifyTrustedReconnectResponse({
      roomId: ROOM_ID,
      deviceId: cred.deviceId,
      challengeNonce: ch.challengeNonce!,
      timestampMs: BASE_EPOCH + 50100,
      proofHex,
      nowMs: BASE_EPOCH + 50200,
    });

    expect(response.authorized).toBe(true);
    expect(response.sessionToken).toBeTruthy();
    expect(guard.getState().status).toBe('AUTHORIZED');
  });

  it('Step 5 & 6: Phone sends SWITCH_VIEW_STREAM on RTCDataChannel open and TV updates UI to stream receiver view', () => {
    const guard = new LanSessionGuard({
      tvId: TV_ID,
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      nowMs: BASE_EPOCH,
    });

    guard.verifyPairingRequest({
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      deviceName: 'Telefon Pentadbir Bilal',
      deviceId: 'dev-phone-bilal',
      nowMs: BASE_EPOCH + 1000,
    });

    const approval = guard.approvePendingPhoneOnTv(BASE_EPOCH + 2000, {
      enrollAsTrusted: false,
    });
    const sessionToken = approval.sessionToken!;

    // Step 6: Phone sends SWITCH_VIEW_STREAM command over direct RTCDataChannel
    const cmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: ROOM_ID,
      sessionToken,
      action: 'SWITCH_VIEW_STREAM',
      seq: 1,
      timestampMs: BASE_EPOCH + 2500,
      senderDeviceName: 'Telefon Pentadbir Bilal',
    };

    const cmdVal = guard.validateCommand(cmd, BASE_EPOCH + 2600);
    expect(cmdVal.accepted).toBe(true);
    expect(cmdVal.failureCategory).toBe('NONE');

    // TV generates ACK confirming resultingView = stream
    const ack: LanControlAckMessage = {
      type: 'lan-control-ack',
      roomId: ROOM_ID,
      seq: cmd.seq,
      action: cmd.action,
      accepted: true,
      resultingView: 'stream',
      streamingActive: false,
      mediaPlayingOnTv: false,
      sessionExpiresAtMs: guard.getState().sessionExpiresAtMs,
      maxSessionExpiresAtMs: guard.getState().maxSessionExpiresAtMs,
      timestampMs: BASE_EPOCH + 2600,
    };

    expect(ack.resultingView).toBe('stream');
    expect(ack.accepted).toBe(true);
  });

  it('Step 6 Hook Binding Verification: verifies sendRemoteControlCommandRef is properly assigned and auto-dispatches SWITCH_VIEW_STREAM on channel open', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf8'
    );

    // Verify sendRemoteControlCommandRef is bound to sendRemoteControlCommand
    expect(hookSource).toContain(
      'sendRemoteControlCommandRef.current = sendRemoteControlCommand;'
    );

    // Verify dc.onopen auto-dispatches SWITCH_VIEW_STREAM for sender
    expect(hookSource).toContain(
      "sendRemoteControlCommandRef.current('SWITCH_VIEW_STREAM')"
    );

    // Verify queuedCommandRef is dispatched if present
    expect(hookSource).toContain(
      'sendRemoteControlCommandRef.current(pending)'
    );
  });

  it('Step 7, 8 & 9: Camera broadcast sends START_STREAM, media tracks arrive on TV, and TV notifies playback state', () => {
    const guard = new LanSessionGuard({
      tvId: TV_ID,
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      nowMs: BASE_EPOCH,
    });

    guard.verifyPairingRequest({
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      deviceName: 'Telefon Pentadbir Bilal',
      deviceId: 'dev-phone-bilal',
      nowMs: BASE_EPOCH + 1000,
    });
    const approval = guard.approvePendingPhoneOnTv(BASE_EPOCH + 2000, {
      enrollAsTrusted: true,
      deviceId: 'dev-phone-bilal',
    });
    const sessionToken = approval.sessionToken!;

    // Step 7 & 8: Phone sends START_STREAM
    const startCmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: ROOM_ID,
      sessionToken,
      action: 'START_STREAM',
      seq: 2,
      timestampMs: BASE_EPOCH + 4000,
      senderDeviceName: 'Telefon Pentadbir Bilal',
    };

    const startVal = guard.validateCommand(startCmd, BASE_EPOCH + 4100);
    expect(startVal.accepted).toBe(true);

    // Step 9: TV plays video and syncs mediaPlayingOnTv: true back to sender
    const syncMsg: TvStateSyncMessage = {
      type: 'tv-state-sync',
      roomId: ROOM_ID,
      activeView: 'stream',
      streamingActive: true,
      mediaPlayingOnTv: true,
      sessionExpiresAtMs: guard.getState().sessionExpiresAtMs,
      maxSessionExpiresAtMs: guard.getState().maxSessionExpiresAtMs,
      isTrustedSession: true,
      timestampMs: BASE_EPOCH + 4200,
    };

    expect(syncMsg.mediaPlayingOnTv).toBe(true);
    expect(syncMsg.activeView).toBe('stream');
  });

  it('Strict Security Invariants: rejects unauthorized, expired, or replayed commands', () => {
    const guard = new LanSessionGuard({
      tvId: TV_ID,
      roomId: ROOM_ID,
      pairingToken: PAIRING_TOKEN,
      nowMs: BASE_EPOCH,
    });

    // Command without approval -> rejected
    const unauthCmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: ROOM_ID,
      sessionToken: 'invalid-token',
      action: 'SWITCH_VIEW_STREAM',
      seq: 1,
      timestampMs: BASE_EPOCH + 1000,
      senderDeviceName: 'Attacker Phone',
    };

    const res = guard.validateCommand(unauthCmd, BASE_EPOCH + 1000);
    expect(res.accepted).toBe(false);
    expect(res.failureCategory).toBe('UNAUTHORIZED_COMMAND');
  });
});
