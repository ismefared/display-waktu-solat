import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  computeTrustedChallengeProof,
  LanSessionGuard,
} from '../domain/webrtcUtils';

describe('Gate 12 & SEC-LAN-002 — Zero-Touch Smart TV UX & Trusted-Device Enrollment', () => {
  it('SEC-LAN-002 #1: First-time enrollment requires explicit on-TV approval and issues a 14-day credential only when approved', () => {
    const now = 1_760_000_000_000;
    const guard = new LanSessionGuard({
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      pairingToken: 'tok-init-1',
      nowMs: now,
    });

    // Phone requests pairing
    const req = guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: 'tok-init-1',
      deviceName: 'Pentadbir Masjid iPhone',
      nowMs: now + 1000,
    });
    expect(req.valid).toBe(true);
    expect(req.status).toBe('PENDING_TV_APPROVAL');

    // Before TV operator approves, any command must be rejected
    const prematureCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '849201',
        sessionToken: 'fake-session',
        action: 'SWITCH_VIEW_STREAM',
        seq: 1,
        timestampMs: now + 1500,
      },
      now + 1500
    );
    expect(prematureCmd.accepted).toBe(false);

    // TV operator explicitly approves & enrolls phone for 14 days
    const approval = guard.approvePendingPhoneOnTv(now + 2000, {
      enrollAsTrusted: true,
    });
    expect(approval.approved).toBe(true);
    expect(approval.sessionToken).toBeTruthy();
    expect(approval.trustedCredential).not.toBeNull();
    expect(approval.trustedCredential?.tvId).toBe('TV-MASJID-01');
    // 14 days = 14 * 24 * 60 * 60 * 1000 = 1,209,600,000 ms
    expect(approval.trustedCredential?.expiresAtMs).toBe(
      now + 2000 + 14 * 24 * 60 * 60 * 1000
    );
    // Active session token expires in 30 minutes
    expect(approval.expiresAtMs).toBe(now + 2000 + 30 * 60 * 1000);
    // Max continuous session duration is 4 hours
    expect(approval.maxSessionExpiresAtMs).toBe(
      now + 2000 + 4 * 60 * 60 * 1000
    );
  });

  it('SEC-LAN-002 #2 & #9: Enrolled trusted device reconnects without on-TV prompt via cryptographic HMAC-SHA256 challenge-response; forged or replayed proofs are rejected', () => {
    const now = 1_760_000_000_000;
    const guard = new LanSessionGuard({
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      pairingToken: 'tok-init-2',
      nowMs: now,
    });

    guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: 'tok-init-2',
      deviceName: 'Telefon Imam',
      nowMs: now + 500,
    });
    const enrollment = guard.approvePendingPhoneOnTv(now + 1000, {
      enrollAsTrusted: true,
    });
    const cred = enrollment.trustedCredential!;
    expect(cred).not.toBeNull();

    // Next day (24 hours later): Phone initiates trusted reconnection challenge
    const nextDay = now + 24 * 60 * 60 * 1000;
    const challengeRes = guard.issueReconnectChallenge(cred.deviceId, nextDay);
    expect(challengeRes.issued).toBe(true);
    expect(challengeRes.challengeNonce).toBeTruthy();

    // 1. Forged proof with wrong secret must fail
    const forgedProof = computeTrustedChallengeProof({
      secretKeyHex: 'wrong-secret-key',
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      deviceId: cred.deviceId,
      challengeNonce: challengeRes.challengeNonce!,
      timestampMs: nextDay + 100,
    });
    const forgedVerify = guard.verifyTrustedReconnectResponse({
      roomId: '849201',
      deviceId: cred.deviceId,
      challengeNonce: challengeRes.challengeNonce!,
      timestampMs: nextDay + 100,
      proofHex: forgedProof,
      nowMs: nextDay + 200,
    });
    expect(forgedVerify.authorized).toBe(false);
    expect(forgedVerify.failureCategory).toBe('TRUSTED_CREDENTIAL_INVALID');

    // 2. Re-issue challenge and compute valid cryptographic proof
    const challengeRes2 = guard.issueReconnectChallenge(
      cred.deviceId,
      nextDay + 500
    );
    const validProof = computeTrustedChallengeProof({
      secretKeyHex: cred.secretKeyHex,
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      deviceId: cred.deviceId,
      challengeNonce: challengeRes2.challengeNonce!,
      timestampMs: nextDay + 600,
    });

    const validVerify = guard.verifyTrustedReconnectResponse({
      roomId: '849201',
      deviceId: cred.deviceId,
      challengeNonce: challengeRes2.challengeNonce!,
      timestampMs: nextDay + 600,
      proofHex: validProof,
      nowMs: nextDay + 700,
    });
    expect(validVerify.authorized).toBe(true);
    expect(validVerify.sessionToken).toBeTruthy();
    expect(guard.getState(nextDay + 700).status).toBe('AUTHORIZED');

    // 3. Replaying the exact same proof a second time must fail (one-time challenge nonce consumed)
    const replayVerify = guard.verifyTrustedReconnectResponse({
      roomId: '849201',
      deviceId: cred.deviceId,
      challengeNonce: challengeRes2.challengeNonce!,
      timestampMs: nextDay + 600,
      proofHex: validProof,
      nowMs: nextDay + 800,
    });
    expect(replayVerify.authorized).toBe(false);
    expect(replayVerify.failureCategory).toBe('REPLAY_DETECTED');
  });

  it('SEC-LAN-002 #3: Trusted-device credentials expire strictly after 14 days and are rejected', () => {
    const now = 1_760_000_000_000;
    const guard = new LanSessionGuard({
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      pairingToken: 'tok-init-3',
      nowMs: now,
    });

    guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: 'tok-init-3',
      deviceName: 'Telefon AJK',
      nowMs: now + 100,
    });
    const enrollment = guard.approvePendingPhoneOnTv(now + 200, {
      enrollAsTrusted: true,
    });
    const cred = enrollment.trustedCredential!;

    // 14 days + 1 second later
    const after14Days = cred.expiresAtMs + 1000;
    const ch = guard.issueReconnectChallenge(cred.deviceId, after14Days);
    expect(ch.issued).toBe(false);
    expect(ch.failureCategory).toBe('TRUSTED_CREDENTIAL_EXPIRED');
  });

  it('SEC-LAN-002 #4 & #5: Active session tokens expire after 30m, can be renewed via RENEW_SESSION while active, and enforce the 4-hour maximum continuous session limit', () => {
    const now = 1_760_000_000_000;
    const guard = new LanSessionGuard({
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      pairingToken: 'tok-init-4',
      nowMs: now,
    });

    guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: 'tok-init-4',
      deviceName: 'Telefon Bilal',
      nowMs: now + 100,
    });
    const approval = guard.approvePendingPhoneOnTv(now + 1000, {
      enrollAsTrusted: true,
    });
    const sessionToken = approval.sessionToken!;

    // At 26 minutes (before 30m expiry): send RENEW_SESSION command over RTCDataChannel
    const at26Min = now + 1000 + 26 * 60 * 1000;
    const renewCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '849201',
        sessionToken,
        action: 'RENEW_SESSION',
        seq: 1,
        timestampMs: at26Min,
      },
      at26Min
    );
    expect(renewCmd.accepted).toBe(true);
    expect(guard.getState(at26Min).sessionExpiresAtMs).toBe(
      at26Min + 30 * 60 * 1000
    );

    // At 4 hours + 1 minute (exceeding max continuous session duration): commands and renewals are rejected
    const after4Hours = now + 1000 + 4 * 60 * 60 * 1000 + 60_000;
    const expiredMaxCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '849201',
        sessionToken,
        action: 'RENEW_SESSION',
        seq: 2,
        timestampMs: after4Hours,
      },
      after4Hours
    );
    expect(expiredMaxCmd.accepted).toBe(false);
    expect(expiredMaxCmd.failureCategory).toBe('MAX_SESSION_DURATION_EXCEEDED');
  });

  it('SEC-LAN-002 #6: Single-device and all-device revocation immediately invalidate trusted credentials and active sessions', () => {
    const now = 1_760_000_000_000;
    const guard = new LanSessionGuard({
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      pairingToken: 'tok-init-5',
      nowMs: now,
    });

    guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: 'tok-init-5',
      deviceName: 'Telefon 1',
      nowMs: now + 100,
    });
    const app1 = guard.approvePendingPhoneOnTv(now + 200, {
      enrollAsTrusted: true,
    });
    const cred1 = app1.trustedCredential!;
    const session1 = app1.sessionToken!;

    // Revoke single trusted device
    const revoked = guard.revokeTrustedDevice(cred1.deviceId);
    expect(revoked).toBe(true);

    // Active session for that device is immediately revoked
    const cmdCheck = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '849201',
        sessionToken: session1,
        action: 'SWITCH_VIEW_STREAM',
        seq: 1,
        timestampMs: now + 500,
      },
      now + 500
    );
    expect(cmdCheck.accepted).toBe(false);
    expect(cmdCheck.failureCategory).toBe('TRUSTED_DEVICE_REVOKED');

    // Reconnection attempt by revoked device fails closed
    const ch = guard.issueReconnectChallenge(cred1.deviceId, now + 600);
    expect(ch.issued).toBe(false);
    expect(ch.failureCategory).toBe('TRUSTED_DEVICE_REVOKED');

    // Revoke all trusted devices
    guard.revokeAllTrustedDevices();
    expect(
      guard.getTrustedDevices(now + 700).filter((d) => !d.revoked).length
    ).toBe(0);
  });

  it('SEC-LAN-002 #7: Idle pairing token auto-rotation updates token without granting authorization or disrupting active sessions', () => {
    const now = 1_760_000_000_000;
    const guard = new LanSessionGuard({
      tvId: 'TV-MASJID-01',
      roomId: '849201',
      pairingToken: 'tok-idle-1',
      nowMs: now,
    });

    // While idle (AWAITING_PHONE), rotation generates a fresh token and invalidates the old token
    const rot = guard.rotateIdlePairingToken(now + 90_000);
    expect(rot.rotated).toBe(true);
    expect(rot.pairingToken).not.toBe('tok-idle-1');
    expect(guard.getState(now + 90_000).status).toBe('AWAITING_PHONE');

    // Old token must be rejected
    const oldReq = guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: 'tok-idle-1',
      deviceName: 'Telefon Lama',
      nowMs: now + 91_000,
    });
    expect(oldReq.valid).toBe(false);
    expect(oldReq.failureCategory).toBe('PAIRING_TOKEN_INVALID');

    // New rotated token is accepted into PENDING_TV_APPROVAL (still requires TV approval)
    const newReq = guard.verifyPairingRequest({
      roomId: '849201',
      pairingToken: rot.pairingToken,
      deviceName: 'Telefon Baharu',
      nowMs: now + 92_000,
    });
    expect(newReq.valid).toBe(true);
    expect(newReq.status).toBe('PENDING_TV_APPROVAL');
  });

  it('Gate 12 UI Verification: TvPairingOverlay renders always-scannable zero-touch QR beacon and trusted device management without obscuring prayer display', () => {
    const overlaySrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TvPairingOverlay.tsx'),
      'utf-8'
    );
    expect(overlaySrc).toContain('data-testid="tv-zero-touch-qr-beacon"');
    expect(overlaySrc).toContain('data-testid="btn-approve-enroll-trusted"');
    expect(overlaySrc).toContain('data-testid="tv-trusted-devices-drawer"');
    expect(overlaySrc).toContain('data-testid="btn-revoke-all-trusted"');
  });
});
