import { describe, expect, it } from 'vitest';
import {
  areIpsInSameLocalSubnet,
  classifyIceFailure,
  classifyMediaError,
  IceCandidateQueue,
  isPermittedHostOnlyCandidate,
  isPrivateOrLoopbackIp,
  LanSessionGuard,
  parseIceCandidateType,
} from '../domain/webrtcUtils';

/**
 * SEC-LAN-001 Security, Pairing & Host-Only WebRTC Policy Unit Tests
 * Traceability:
 * - SEC-LAN-001 Mandatory Constraints #1 through #10
 * - Phase I / Phase J Testing & Security Validation
 */

describe('SEC-LAN-001 Host-Only ICE & Local Network Validation', () => {
  it('permits RFC 1918 private IPv4 and RFC 8828 .local mDNS host candidates', () => {
    const privateLanCandidate =
      'candidate:1 1 UDP 2122252543 192.168.1.45 54321 typ host';
    const mdnsHostCandidate =
      'candidate:2 1 UDP 2122252543 a1b2c3d4-e5f6.local 54322 typ host';
    const tenNetCandidate =
      'candidate:3 1 UDP 2122252543 10.0.4.12 51111 typ host';

    expect(parseIceCandidateType(privateLanCandidate)).toBe('host');
    expect(isPermittedHostOnlyCandidate(privateLanCandidate)).toBe(true);
    expect(isPermittedHostOnlyCandidate(mdnsHostCandidate)).toBe(true);
    expect(isPermittedHostOnlyCandidate(tenNetCandidate)).toBe(true);
  });

  it('strictly rejects STUN server-reflexive (srflx), TURN relay, and public IPv4 candidates (Constraint #3)', () => {
    const stunSrflx =
      'candidate:4 1 UDP 1686052607 203.106.12.88 54321 typ srflx raddr 192.168.1.45 rport 54321';
    const turnRelay =
      'candidate:5 1 UDP 41885439 34.120.55.10 60000 typ relay raddr 203.106.12.88 rport 54321';
    const spoofedPublicHost =
      'candidate:6 1 UDP 2122252543 8.8.8.8 54321 typ host';

    expect(isPermittedHostOnlyCandidate(stunSrflx)).toBe(false);
    expect(isPermittedHostOnlyCandidate(turnRelay)).toBe(false);
    expect(isPermittedHostOnlyCandidate(spoofedPublicHost)).toBe(false);
  });

  it('IceCandidateQueue only queues permitted host-only candidates and drops srflx/relay candidates', () => {
    const queue = new IceCandidateQueue();

    const accepted = queue.enqueue({
      candidate: 'candidate:1 1 UDP 2122252543 192.168.1.10 50000 typ host',
    });
    const rejectedSrflx = queue.enqueue({
      candidate:
        'candidate:2 1 UDP 1686052607 203.0.113.5 50000 typ srflx raddr 192.168.1.10 rport 50000',
    });
    const rejectedRelay = queue.enqueue({
      candidate:
        'candidate:3 1 UDP 41885439 198.51.100.9 60000 typ relay raddr 203.0.113.5 rport 50000',
    });

    expect(accepted).toBe(true);
    expect(rejectedSrflx).toBe(false);
    expect(rejectedRelay).toBe(false);
    expect(queue.size()).toBe(1);

    const drained = queue.drain();
    expect(drained).toHaveLength(1);
    expect(queue.size()).toBe(0);
  });

  it('validates private/loopback IP addresses and same-/24 local subnet matching (Constraint #8)', () => {
    expect(isPrivateOrLoopbackIp('192.168.1.10')).toBe(true);
    expect(isPrivateOrLoopbackIp('::ffff:192.168.1.25')).toBe(true);
    expect(isPrivateOrLoopbackIp('172.20.5.4')).toBe(true);
    expect(isPrivateOrLoopbackIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackIp('203.0.113.50')).toBe(false);

    expect(areIpsInSameLocalSubnet('192.168.1.10', '192.168.1.99')).toBe(true);
    expect(areIpsInSameLocalSubnet('192.168.1.10', '192.168.2.10')).toBe(false);
    expect(areIpsInSameLocalSubnet('192.168.1.10', '203.0.113.10')).toBe(false);
  });
});

describe('SEC-LAN-001 LanSessionGuard — Pairing, Explicit TV Approval, Expiry, Revocation & Replay Protection', () => {
  it('enforces short-lived pairing token validation and requires explicit TV approval before issuing a sessionToken (Constraints #5 & #6)', () => {
    const startMs = 1_700_000_000_000;
    const guard = new LanSessionGuard({
      roomId: '881122',
      pairingToken: 'valid-secret-token',
      pairingTtlMs: 120_000,
      sessionTtlMs: 1_800_000,
      replayWindowMs: 30_000,
      nowMs: startMs,
    });

    // 1. Wrong token -> rejected
    const badAttempt = guard.verifyPairingRequest({
      roomId: '881122',
      pairingToken: 'wrong-token',
      deviceName: 'Attacker Phone',
      nowMs: startMs + 1000,
    });
    expect(badAttempt.valid).toBe(false);
    expect(badAttempt.failureCategory).toBe('PAIRING_TOKEN_INVALID');

    // 2. Correct token -> transitions to PENDING_TV_APPROVAL (not yet AUTHORIZED!)
    const goodAttempt = guard.verifyPairingRequest({
      roomId: '881122',
      pairingToken: 'valid-secret-token',
      deviceName: 'Telefon Bilal',
      nowMs: startMs + 2000,
    });
    expect(goodAttempt.valid).toBe(true);
    expect(goodAttempt.status).toBe('PENDING_TV_APPROVAL');

    // 3. Attempting to execute a command BEFORE TV approval -> rejected!
    const prematureCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '881122',
        sessionToken: 'valid-secret-token',
        action: 'SWITCH_VIEW_PRIMARY',
        seq: 1,
        timestampMs: startMs + 3000,
      },
      startMs + 3000
    );
    expect(prematureCmd.accepted).toBe(false);
    expect(prematureCmd.failureCategory).toBe('UNAUTHORIZED_COMMAND');

    // 4. TV explicitly approves the pending phone -> issues sessionToken
    const approval = guard.approvePendingPhoneOnTv(startMs + 4000);
    expect(approval.approved).toBe(true);
    expect(approval.sessionToken).toBeTruthy();

    // 5. Authenticated command with valid sessionToken and seq=1 -> ACCEPTED
    const validCmd1 = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '881122',
        sessionToken: approval.sessionToken!,
        action: 'PING_STATE',
        seq: 1,
        timestampMs: startMs + 5000,
      },
      startMs + 5000
    );
    expect(validCmd1.accepted).toBe(true);

    // 6. Replay attack with same seq=1 -> REJECTED (Constraint #7)
    const replayCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '881122',
        sessionToken: approval.sessionToken!,
        action: 'STOP_STREAM',
        seq: 1,
        timestampMs: startMs + 5500,
      },
      startMs + 5500
    );
    expect(replayCmd.accepted).toBe(false);
    expect(replayCmd.failureCategory).toBe('REPLAY_DETECTED');

    // 7. Stale timestamp outside replay window -> REJECTED
    const staleTimestampCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '881122',
        sessionToken: approval.sessionToken!,
        action: 'STOP_STREAM',
        seq: 2,
        timestampMs: startMs - 60_000,
      },
      startMs + 6000
    );
    expect(staleTimestampCmd.accepted).toBe(false);
    expect(staleTimestampCmd.failureCategory).toBe('REPLAY_DETECTED');

    // 8. TV operator revokes session -> subsequent valid seq=2 command is REJECTED (Constraint #6)
    guard.revokeSession();
    const afterRevokeCmd = guard.validateCommand(
      {
        type: 'lan-control-command',
        roomId: '881122',
        sessionToken: approval.sessionToken!,
        action: 'STOP_STREAM',
        seq: 2,
        timestampMs: startMs + 7000,
      },
      startMs + 7000
    );
    expect(afterRevokeCmd.accepted).toBe(false);
    expect(afterRevokeCmd.failureCategory).toBe('SESSION_REVOKED');
  });

  it('rejects expired pairing tokens automatically (Constraint #6)', () => {
    const startMs = 1_700_000_000_000;
    const guard = new LanSessionGuard({
      roomId: '990011',
      pairingToken: 'short-token',
      pairingTtlMs: 60_000,
      nowMs: startMs,
    });

    const expiredAttempt = guard.verifyPairingRequest({
      roomId: '990011',
      pairingToken: 'short-token',
      deviceName: 'Telefon Lewat',
      nowMs: startMs + 61_000,
    });
    expect(expiredAttempt.valid).toBe(false);
    expect(expiredAttempt.failureCategory).toBe('SESSION_EXPIRED');
  });

  it('classifies camera permission and LAN isolation failures accurately', () => {
    const denied = classifyMediaError({
      name: 'NotAllowedError',
      message: 'Permission denied',
    });
    expect(denied.category).toBe('CAMERA_PERMISSION_DENIED');

    const unavailable = classifyMediaError({
      name: 'NotFoundError',
      message: 'Requested device not found',
    });
    expect(unavailable.category).toBe('CAMERA_UNAVAILABLE');

    const isolated = classifyIceFailure({
      localCandidateTypes: ['host'],
      remoteCandidateTypes: ['host'],
      sdpOfferCompleted: true,
      sdpAnswerCompleted: true,
    });
    expect(isolated.category).toBe('LAN_UNREACHABLE_OR_ISOLATED');
    expect(isolated.messageBM).toContain('SEC-LAN-001');
  });
});
