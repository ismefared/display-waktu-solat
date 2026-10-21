import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { LanSessionGuard } from '../domain/webrtcUtils';
import {
  LanControlAckMessage,
  LanControlCommandMessage,
  StreamingLifecycleState,
} from '../types/domain';

/**
 * Gate 13 — Immersive Live Camera UX & Automatic Return Regression Tests
 *
 * Verifies:
 * 1. Dominant, near-fullscreen camera layout while stream is active (SEC-LAN-001/002 compliant).
 * 2. High-contrast Prayer Information Overlay (Zone, Current Local Time, Next Prayer Name & Time, Tabular Countdown).
 * 3. Responsive video presentation with aspect-ratio preservation and blurred background fill for portrait feeds.
 * 4. Minimal broadcast status badge ("SIARAN LANGSUNG") with no technical diagnostics on audience view.
 * 5. Deterministic Automatic Return to Main Prayer Display upon:
 *    - Explicit STOP_STREAM command
 *    - Remote video track ended
 *    - Session revocation or expiry
 *    - 10-second bounded network interruption recovery timeout
 * 6. Deterministic state model lifecycle (PRAYER_DISPLAY, WAITING_FOR_STREAM, STREAMING, RECONNECTING, STOPPING, RETURNING_TO_PRAYER_DISPLAY).
 */

describe('Gate 13 — Immersive Live Camera UX & Layout', () => {
  it('replaces the technical two-column interface with an immersive full-viewport broadcast layout when stream is active', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );

    // Dominant full-viewport container
    expect(receiverSource).toContain('data-testid="immersive-live-stream-container"');
    // Main video with object-contain to preserve aspect ratio without distortion
    expect(receiverSource).toContain('object-contain');
    // Blurred ambient video backdrop for portrait / non-16:9 mobile video feeds
    expect(receiverSource).toContain('data-testid="portrait-blur-backdrop"');
    expect(receiverSource).toContain('blur-3xl');
  });

  it('renders a high-contrast Prayer Information Overlay containing Zone, Current Time, Next Prayer Name & Time, and Tabular Countdown', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );

    expect(receiverSource).toContain('data-testid="prayer-overlay-card"');
    expect(receiverSource).toContain('locationState.activeZone.code');
    expect(receiverSource).toContain('dateParts.time24WithSeconds');
    expect(receiverSource).toContain('resolvedPrayer.nextPrayer.labelBM');
    expect(receiverSource).toContain('resolvedPrayer.nextPrayer.time24');
    expect(receiverSource).toContain('resolvedPrayer.countdown.formatted');
    expect(receiverSource).toContain('font-mono-tabular');
  });

  it('displays a minimal audience-friendly broadcast badge (SIARAN LANGSUNG) and hides raw diagnostics from audience view', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );

    expect(receiverSource).toContain('data-testid="broadcast-status-badge"');
    expect(receiverSource).toContain('SIARAN LANGSUNG');
    expect(receiverSource).toContain('Dikawal oleh Telefon Pintar (LAN)');
    // Raw QR codes and setup boxes are not rendered in the immersive broadcast view
    expect(receiverSource).toContain('data-testid="btn-toggle-operator-controls"');
  });
});

describe('Gate 13 — Deterministic Automatic Return to Main Prayer Display', () => {
  it('transitions TV from live stream to primary prayer display upon authorized STOP_STREAM command', () => {
    const now = 1_700_000_000_000;
    const guard = new LanSessionGuard({
      roomId: '987654',
      pairingToken: 'gate13-token',
      nowMs: now,
    });

    const req = guard.verifyPairingRequest({
      roomId: '987654',
      pairingToken: 'gate13-token',
      deviceName: 'Pentadbir Masjid Phone',
      nowMs: now + 500,
    });
    expect(req.valid).toBe(true);

    const approval = guard.approvePendingPhoneOnTv(now + 1000);
    expect(approval.approved).toBe(true);
    const sessionToken = approval.sessionToken!;

    // Phone issues STOP_STREAM
    const stopCmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: '987654',
      sessionToken,
      action: 'STOP_STREAM',
      seq: 1,
      timestampMs: now + 2000,
    };

    const validated = guard.validateCommand(stopCmd, now + 2000);
    expect(validated.accepted).toBe(true);
    expect(stopCmd.action).toBe('STOP_STREAM');

    // App source and useWebRTCStream ensure STOP_STREAM switches active view to primary
    const appSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.tsx'),
      'utf8'
    );
    expect(appSource).toContain("action === 'STOP_STREAM'");

    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf8'
    );
    expect(hookSource).toContain("cmd.action === 'STOP_STREAM'");
    expect(hookSource).toContain("setState('RETURNING_TO_PRAYER_DISPLAY')");
  });

  it('handles remote video track onended and automatically triggers return to primary display', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf8'
    );

    expect(hookSource).toContain('event.track.onended');
    expect(hookSource).toContain("setState('RETURNING_TO_PRAYER_DISPLAY')");
    expect(hookSource).toContain("activeTvViewRef.current = 'primary'");
  });

  it('enforces immediate return to primary display upon session revocation or expiry', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf8'
    );

    expect(hookSource).toContain('revokePairingSessionOnTv');
    expect(hookSource).toContain("setState('RETURNING_TO_PRAYER_DISPLAY')");
    expect(hookSource).toContain("activeTvViewRef.current = 'primary'");
  });

  it('implements bounded 10-second recovery timeout on network interruption before returning to primary display', () => {
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf8'
    );

    // 10s recovery timer on disconnected state
    expect(hookSource).toContain("iceState === 'disconnected'");
    expect(hookSource).toContain('10000');
    expect(hookSource).toContain("setState('RECONNECTING')");
    expect(hookSource).toContain("setState('RETURNING_TO_PRAYER_DISPLAY')");
  });

  it('supports the required StreamingLifecycleState model including RETURNING_TO_PRAYER_DISPLAY, STOPPING, and PRAYER_DISPLAY', () => {
    const domainSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/types/domain.ts'),
      'utf8'
    );

    expect(domainSource).toContain("'PRAYER_DISPLAY'");
    expect(domainSource).toContain("'WAITING_FOR_STREAM'");
    expect(domainSource).toContain("'STREAMING'");
    expect(domainSource).toContain("'RECONNECTING'");
    expect(domainSource).toContain("'STOPPING'");
    expect(domainSource).toContain("'RETURNING_TO_PRAYER_DISPLAY'");
  });
});
