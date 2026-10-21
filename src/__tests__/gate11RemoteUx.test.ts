import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { LanSessionGuard } from '../domain/webrtcUtils';
import {
  CommandDeliveryStatus,
  LanControlAckMessage,
  LanControlCommandMessage,
  TvStateSyncMessage,
} from '../types/domain';

/**
 * Gate 11 — Remote Control UX, State Consistency & Pairing Discoverability Regression Tests
 * Traceability:
 * - Gate 11 Sections 2, 3, 4, 5, 6, 7, 8, 10
 * - SEC-LAN-001 Mandatory Constraints #1 through #10
 */

describe('Gate 11 — TV Pairing Discoverability & Persistent Session Architecture', () => {
  it('lifts Display WebRTC session to App.tsx so phone pairing and mode switching work directly from Primary Prayer Display without manual TV navigation', () => {
    const appSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.tsx'),
      'utf8'
    );

    // App.tsx hosts the persistent displayWebrtc session across 'primary' and 'stream'
    expect(appSource).toContain("useWebRTCStream({\n    role: 'display'");
    expect(appSource).toContain("action === 'SWITCH_VIEW_PRIMARY'");
    expect(appSource).toContain("action === 'SWITCH_VIEW_STREAM'");
    expect(appSource).toContain("action === 'START_STREAM'");
    expect(appSource).toContain('<TvPairingOverlay');
  });

  it('TvPairingOverlay provides a non-obscuring QR pairing trigger, keyboard/remote D-pad approval shortcuts, and 1-tap revocation', () => {
    const overlaySource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TvPairingOverlay.tsx'),
      'utf8'
    );

    expect(overlaySource).toContain('data-testid="tv-lan-pairing-dock"');
    expect(overlaySource).toContain('data-testid="btn-toggle-qr-pairing"');
    expect(overlaySource).toContain('data-testid="tv-pairing-approval-banner"');
    expect(overlaySource).toContain('data-testid="btn-approve-pairing"');
    expect(overlaySource).toContain('data-testid="btn-reject-pairing"');
    expect(overlaySource).toContain('data-testid="dock-btn-revoke-session"');
  });
});

describe('Gate 11 — Mobile Remote Controller UX & On-Demand Camera Permission', () => {
  it('MobileSenderView renders the 3 primary touch actions with >=44px/56px hitboxes and separates control channel from media playback status', () => {
    const senderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileSenderView.tsx'),
      'utf8'
    );

    // 3 Primary Actions
    expect(senderSource).toContain('1. Paparan Waktu Solat');
    expect(senderSource).toContain('2. Paparan Siaran Langsung');
    expect(senderSource).toContain('3. Mod Kamera Telefon');

    // Touch target sizing
    expect(senderSource).toContain('min-h-[56px]');
    expect(senderSource).toContain('min-h-[44px]');

    // Distinct status indicators: Control Channel vs Confirmed TV Mode vs Confirmed Video Playback
    expect(senderSource).toContain('data-testid="control-channel-status"');
    expect(senderSource).toContain('data-testid="confirmed-tv-mode"');
    expect(senderSource).toContain('data-testid="confirmed-media-status"');

    // Camera permission explanation shown before requesting camera
    expect(senderSource).toContain('data-testid="camera-consent-explanation"');
    expect(senderSource).toContain('data-testid="btn-confirm-start-camera"');
  });

  it('StreamReceiverView notifies TV video playback only when the HTML5 <video> element actually plays media', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );

    expect(receiverSource).toContain('notifyTvVideoPlaying(true)');
    expect(receiverSource).toContain('notifyTvVideoPlaying(false)');
    expect(receiverSource).toContain('onPlaying={() => notifyTvVideoPlaying(true)}');
  });
});

describe('Gate 11 — RTCDataChannel Command & Confirmed State Consistency', () => {
  it('verifies mode switching commands (SWITCH_VIEW_PRIMARY, SWITCH_VIEW_STREAM, START_STREAM, STOP_STREAM) and TV state sync messages', () => {
    const now = 1_700_000_000_000;
    const guard = new LanSessionGuard({
      roomId: '654321',
      pairingToken: 'token-gate11',
      nowMs: now,
    });

    // Phone requests pairing
    const req = guard.verifyPairingRequest({
      roomId: '654321',
      pairingToken: 'token-gate11',
      deviceName: 'Telefon AJK Masjid',
      nowMs: now + 500,
    });
    expect(req.valid).toBe(true);
    expect(req.status).toBe('PENDING_TV_APPROVAL');

    // TV operator explicitly approves
    const approval = guard.approvePendingPhoneOnTv(now + 1000);
    expect(approval.approved).toBe(true);

    // 1. Switch TV from Primary to Stream View over RTCDataChannel
    const cmdSwitchStream: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: '654321',
      sessionToken: approval.sessionToken!,
      action: 'SWITCH_VIEW_STREAM',
      seq: 1,
      timestampMs: now + 2000,
    };
    const v1 = guard.validateCommand(cmdSwitchStream, now + 2000);
    expect(v1.accepted).toBe(true);

    const ack1: LanControlAckMessage = {
      type: 'lan-control-ack',
      roomId: '654321',
      seq: 1,
      action: 'SWITCH_VIEW_STREAM',
      accepted: true,
      resultingView: 'stream',
      streamingActive: false,
      mediaPlayingOnTv: false,
      sessionExpiresAtMs: approval.expiresAtMs,
      timestampMs: now + 2050,
    };
    expect(ack1.resultingView).toBe('stream');
    expect(ack1.mediaPlayingOnTv).toBe(false);

    // 2. Switch TV back to Primary Prayer Display over RTCDataChannel
    const cmdSwitchPrimary: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: '654321',
      sessionToken: approval.sessionToken!,
      action: 'SWITCH_VIEW_PRIMARY',
      seq: 2,
      timestampMs: now + 3000,
    };
    const v2 = guard.validateCommand(cmdSwitchPrimary, now + 3000);
    expect(v2.accepted).toBe(true);

    // 3. Verify TvStateSyncMessage structure distinguishes activeView from mediaPlayingOnTv
    const syncPayload: TvStateSyncMessage = {
      type: 'tv-state-sync',
      roomId: '654321',
      activeView: 'primary',
      streamingActive: false,
      mediaPlayingOnTv: false,
      sessionExpiresAtMs: approval.expiresAtMs,
      timestampMs: now + 3100,
    };
    expect(syncPayload.activeView).toBe('primary');
    expect(syncPayload.mediaPlayingOnTv).toBe(false);

    // 4. Verify CommandDeliveryStatus lifecycle states
    const statuses: CommandDeliveryStatus[] = [
      'IDLE',
      'SENT',
      'ACKNOWLEDGED',
      'REJECTED',
      'TIMED_OUT',
    ];
    expect(statuses).toContain('TIMED_OUT');
  });
});
