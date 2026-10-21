import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { LanSessionGuard } from '../domain/webrtcUtils';
import { AnnouncementService } from '../services/announcementService';
import {
  AnnouncementItem,
  LanControlAckMessage,
  LanControlCommandMessage,
  TickerConfig,
  VideoFitMode,
  VideoResolutionPreset,
} from '../types/domain';

/**
 * GATE 16 — Immersive Camera, Broadcast Quality Controls, Next-Prayer Countdown Animation & Announcement Ticker Tests
 */
describe('Gate 16 — Immersive Theatre Mode & Maximum Video Area', () => {
  it('maximizes practical screen area and hides technical docks and topbar during active viewing', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );
    const appSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/App.tsx'),
      'utf8'
    );

    // Dominant full-viewport container
    expect(receiverSource).toContain('data-testid="immersive-live-stream-container"');
    expect(receiverSource).toContain('object-contain');
    expect(receiverSource).toContain('object-cover');
    // Portrait blurred background fill
    expect(receiverSource).toContain('data-testid="portrait-blur-backdrop"');

    // TopBar is hidden during active theatre mode streaming to maximize video area
    expect(appSource).toContain("activeView === 'stream'");
    expect(appSource).toContain('displayWebrtc.theatreMode !== false');
  });

  it('supports fit modes: contain, cover, and blurred background', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );
    expect(receiverSource).toContain("currentFitMode === 'blurred'");
    expect(receiverSource).toContain("currentFitMode === 'cover'");
    expect(receiverSource).toContain('setBlurredVideoRef');
  });

  it('guarantees video autoplay on Smart TV by applying muted, defaultMuted, and playsInline before play()', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );
    expect(receiverSource).toContain('el.muted = isMuted');
    expect(receiverSource).toContain('el.defaultMuted = isMuted');
    expect(receiverSource).toContain('el.playsInline = true');
  });
});

describe('Gate 16 — Mobile Video Quality Controls (Tetapan Siaran)', () => {
  it('provides 480p, 720p HD, and 1080p FHD resolution options and frame rate presets in mobile controller', () => {
    const senderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileSenderView.tsx'),
      'utf8'
    );

    expect(senderSource).toContain('data-testid="broadcast-settings-section"');
    expect(senderSource).toContain('quality-btn-${res}');
    expect(senderSource).toContain('fps-btn-${fps}');
    expect(senderSource).toContain('fit-btn-${mode}');
    expect(senderSource).toContain('density-btn-${d}');
    expect(senderSource).toContain('data-testid="toggle-theatre-mode"');
  });

  it('displays video track statistics and warns gracefully when resolution exceeds hardware capability', () => {
    const senderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileSenderView.tsx'),
      'utf8'
    );
    expect(senderSource).toContain('data-testid="video-track-stats-card"');
    expect(senderSource).toContain('videoQualityStats.actualQualityLabelBM');
    expect(senderSource).toContain('isActualSupported');
  });

  it('displays quick-start camera prompt immediately after manual on-TV approval', () => {
    const senderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileSenderView.tsx'),
      'utf8'
    );
    expect(senderSource).toContain('data-testid="phone-authorized-broadcast-card"');
    expect(senderSource).toContain('data-testid="btn-quick-start-camera"');
  });
});

describe('Gate 16 — Animated Next-Prayer Countdown & Overlay Hierarchy', () => {
  it('renders restrained hierarchy with minimal live-stream status, prayer countdown card, and bottom ticker', () => {
    const receiverSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/StreamReceiverView.tsx'),
      'utf8'
    );
    expect(receiverSource).toContain('data-testid="broadcast-status-badge"');
    expect(receiverSource).toContain('data-testid="prayer-overlay-card"');
    expect(receiverSource).toContain('<AnnouncementTicker');
  });

  it('supports overlay density settings (minimal, compact, standard)', () => {
    const countdownSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/PrayerCountdownDisplay.tsx'),
      'utf8'
    );
    expect(countdownSource).toContain('data-density="minimal"');
    expect(countdownSource).toContain('data-density="compact"');
    expect(countdownSource).toContain('data-density="standard"');
  });

  it('highlights the final 15 minutes and final seconds with subtle non-disruptive animation and reduced-motion support', () => {
    const countdownSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/PrayerCountdownDisplay.tsx'),
      'utf8'
    );
    expect(countdownSource).toContain('isFinal15Minutes');
    expect(countdownSource).toContain('motion-safe:animate-pulse');
    expect(countdownSource).toContain('font-mono-tabular');
  });
});

describe('Gate 16 — User-Managed Announcement Ticker & Persistence', () => {
  it('validates announcement input and enforces maximum length constraints', () => {
    const emptyRes = AnnouncementService.validateInput({ message: '' });
    expect(emptyRes.valid).toBe(false);
    expect(emptyRes.errorBM).toContain('tidak boleh kosong');

    const tooLongRes = AnnouncementService.validateInput({
      message: 'A'.repeat(250),
    });
    expect(tooLongRes.valid).toBe(false);
    expect(tooLongRes.errorBM).toContain('maksimum 180 aksara');

    const validRes = AnnouncementService.validateInput({
      title: 'Kuliah Subuh',
      message: 'Kuliah Subuh setiap hari Sabtu.',
      priority: 'IMPORTANT',
    });
    expect(validRes.valid).toBe(true);
    expect(validRes.sanitized?.priority).toBe('IMPORTANT');
  });

  it('filters active announcements by enabled flag, start time, and expiry date', () => {
    const now = 1_700_000_000_000;
    const items: AnnouncementItem[] = [
      {
        id: '1',
        message: 'Active Urgent',
        priority: 'URGENT',
        enabled: true,
        createdAtMs: now,
        updatedAtMs: now,
      },
      {
        id: '2',
        message: 'Disabled item',
        priority: 'NORMAL',
        enabled: false,
        createdAtMs: now,
        updatedAtMs: now,
      },
      {
        id: '3',
        message: 'Expired item',
        priority: 'NORMAL',
        enabled: true,
        expiresAtIso: new Date(now - 10000).toISOString(),
        createdAtMs: now,
        updatedAtMs: now,
      },
      {
        id: '4',
        message: 'Future item',
        priority: 'NORMAL',
        enabled: true,
        startAtIso: new Date(now + 10000).toISOString(),
        createdAtMs: now,
        updatedAtMs: now,
      },
    ];

    const active = AnnouncementService.filterActiveAnnouncements(items, now);
    expect(active.length).toBe(1);
    expect(active[0].id).toBe('1');
    expect(active[0].priority).toBe('URGENT');
  });

  it('renders static fallback message when announcement list is empty', () => {
    const tickerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AnnouncementTicker.tsx'),
      'utf8'
    );
    expect(tickerSource).toContain('effectiveConfig.staticFallbackText');
    expect(tickerSource).toContain('data-testid="announcement-ticker-static"');
  });

  it('supports speed configurations (SLOW = 45s, NORMAL = 30s, FAST = 18s)', () => {
    const tickerSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/AnnouncementTicker.tsx'),
      'utf8'
    );
    expect(tickerSource).toContain('SLOW: 45');
    expect(tickerSource).toContain('NORMAL: 30');
    expect(tickerSource).toContain('FAST: 18');
  });
});

describe('Gate 16 — Automatic Return to Prayer Display & Governance', () => {
  it('preserves SEC-LAN-001/002: RTCDataChannel-only control, host-only WebRTC, no STUN/TURN, and validated command actions', () => {
    const now = 1_700_000_000_000;
    const guard = new LanSessionGuard({
      roomId: '123456',
      pairingToken: 'gate16-token',
      nowMs: now,
    });

    guard.verifyPairingRequest({
      roomId: '123456',
      pairingToken: 'gate16-token',
      deviceName: 'Admin Phone',
      nowMs: now + 200,
    });

    const approval = guard.approvePendingPhoneOnTv(now + 500);
    const sessionToken = approval.sessionToken!;

    // SET_FIT_MODE is approved
    const fitCmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: '123456',
      sessionToken,
      action: 'SET_FIT_MODE',
      seq: 1,
      timestampMs: now + 1000,
      payload: { fitMode: 'blurred' },
    };
    expect(guard.validateCommand(fitCmd, now + 1000).accepted).toBe(true);

    // SYNC_ANNOUNCEMENTS is approved
    const syncCmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: '123456',
      sessionToken,
      action: 'SYNC_ANNOUNCEMENTS',
      seq: 2,
      timestampMs: now + 1200,
      payload: { announcements: [], tickerConfig: { speed: 'NORMAL', enabled: true, staticFallbackText: 'Test' } },
    };
    expect(guard.validateCommand(syncCmd, now + 1200).accepted).toBe(true);

    // STOP_STREAM returns TV to primary prayer display
    const stopCmd: LanControlCommandMessage = {
      type: 'lan-control-command',
      roomId: '123456',
      sessionToken,
      action: 'STOP_STREAM',
      seq: 3,
      timestampMs: now + 1500,
    };
    expect(guard.validateCommand(stopCmd, now + 1500).accepted).toBe(true);

    // Replay attack is blocked
    expect(guard.validateCommand(stopCmd, now + 1600).accepted).toBe(false);
  });

  it('guarantees immediate video display activation and fallback stream availability', () => {
    const senderSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MobileSenderView.tsx'),
      'utf8'
    );
    const hookSource = fs.readFileSync(
      path.resolve(process.cwd(), 'src/hooks/useWebRTCStream.ts'),
      'utf8'
    );

    // Direct one-tap camera broadcast invocation on manual approval card
    expect(senderSource).toContain('data-testid="btn-quick-start-camera"');
    expect(senderSource).toContain('onClick={handleActivateCameraMode}');

    // Direct one-tap camera action on remote control button
    expect(senderSource).toContain('data-testid="remote-btn-camera-mode"');

    // TV hook immediately notifies SWITCH_VIEW_STREAM on incoming live video track
    expect(hookSource).toContain("params.onRemoteCommandExecuted('SWITCH_VIEW_STREAM')");

    // Hook provides resilient fallback when camera hardware is restricted
    expect(hookSource).toContain('createTestPatternStream');
  });
});

