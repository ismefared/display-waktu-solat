/**
 * SEC-LAN-001 & SEC-LAN-002 Security, Pairing, Trusted-Device Enrollment & Host-Only WebRTC Policy Engine
 * Traceability:
 * - SEC-LAN-001 Mandatory Decision (Constraints #1 through #10)
 * - SEC-LAN-002 Mandatory Policy Requirements (#1 through #10):
 *   1. First-time trusted-device enrollment requires explicit on-TV approval.
 *   2. Previously enrolled devices reconnect via cryptographic challenge-response without repeated on-TV approval.
 *   3. Trusted-device credentials expire after 14 days.
 *   4. Active session tokens expire after 30 minutes and may be renewed only while authorized and active.
 *   5. Maximum continuous-session duration (4 hours) enforced before mandatory reauthentication.
 *   6. Immediate single-device and all-device revocation.
 *   7. Idle ephemeral pairing token rotation without granting authorization or bypassing enrollment.
 */

import {
  LanControlCommandMessage,
  PairingAuthorizationStatus,
  StreamingFailureCategory,
  TrustedDeviceRecord,
} from '../types/domain';

/**
 * Extracts the WebRTC ICE candidate type ('host' | 'srflx' | 'prflx' | 'relay' | 'unknown')
 * from an SDP candidate string without logging private IP addresses.
 */
export function parseIceCandidateType(
  candidateStr: string | undefined
): string {
  if (!candidateStr || typeof candidateStr !== 'string') return 'unknown';
  const match = candidateStr.match(/\btyp\s+(host|srflx|prflx|relay)\b/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

/**
 * SEC-LAN-001 Constraint #3 & #5:
 * Verifies that an ICE candidate is strictly a local `typ host` candidate
 * (RFC 1918 IPv4, loopback, IPv6 link-local/ULA, or RFC 8828 `.local` mDNS host candidate)
 * and rejects any `srflx`, `prflx`, `relay`, or public IPv4 address.
 */
export function isPermittedHostOnlyCandidate(
  candidateStr: string | undefined
): boolean {
  if (!candidateStr || typeof candidateStr !== 'string') return false;
  const trimmed = candidateStr.trim();
  if (!trimmed) return false;

  const cType = parseIceCandidateType(trimmed);
  if (cType !== 'host') {
    return false;
  }

  if (/\braddr\b/i.test(trimmed)) {
    return false;
  }

  const parts = trimmed.replace(/^candidate:/i, '').trim().split(/\s+/);
  if (parts.length < 6) return false;
  const address = parts[4].toLowerCase();

  if (address.endsWith('.local')) {
    return true;
  }

  if (isPrivateOrLoopbackIp(address)) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether an IP address string (IPv4, IPv4-mapped IPv6, or IPv6)
 * belongs to a private local network (RFC 1918 / RFC 4193 / Link-Local) or loopback.
 */
export function isPrivateOrLoopbackIp(rawIp: string | undefined): boolean {
  if (!rawIp || typeof rawIp !== 'string') return false;
  let ip = rawIp.trim().toLowerCase();

  const zoneIdx = ip.indexOf('%');
  if (zoneIdx !== -1) {
    ip = ip.slice(0, zoneIdx);
  }

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return true;
  }

  if (ip.includes(':')) {
    return (
      ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:')
    );
  }

  const octets = ip.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) {
    return false;
  }

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 127) return true;

  return false;
}

/**
 * SEC-LAN-001 Constraint #8:
 * Evaluates whether two private IPv4 addresses belong to the same /24 local subnet
 * when running on a local LAN appliance.
 */
export function areIpsInSameLocalSubnet(
  ipA: string | undefined,
  ipB: string | undefined
): boolean {
  if (!isPrivateOrLoopbackIp(ipA) || !isPrivateOrLoopbackIp(ipB)) {
    return false;
  }
  const norm = (s: string) => s.trim().toLowerCase().replace(/^::ffff:/, '');
  const a = norm(ipA!);
  const b = norm(ipB!);

  if (a === b) return true;
  if (
    (a === '127.0.0.1' || a === '::1') &&
    (b === '127.0.0.1' || b === '::1')
  ) {
    return true;
  }

  const partsA = a.split('.');
  const partsB = b.split('.');
  if (partsA.length === 4 && partsB.length === 4) {
    return (
      partsA[0] === partsB[0] &&
      partsA[1] === partsB[1] &&
      partsA[2] === partsB[2]
    );
  }
  return false;
}

/**
 * Generates a cryptographically random token in hex format.
 */
export function generateCryptographicToken(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Pure TypeScript SHA-256 & HMAC-SHA256 implementation for deterministic, synchronous
 * challenge-response cryptographic verification across both Node.js and Browser environments.
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Bytes(msg: Uint8Array): Uint8Array {
  const l = msg.length;
  const bitLen = l * 8;
  const padLen = ((l + 8) >> 6) * 64 + 64;
  const padded = new Uint8Array(padLen);
  padded.set(msg);
  padded[l] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 4, bitLen >>> 0, false);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

/**
 * Computes an HMAC-SHA256 hex digest over `(tvId, roomId, deviceId, challengeNonce, timestampMs)`
 * using the enrolled device's `secretKeyHex` for SEC-LAN-002 Requirement #2 & #9.
 */
export function computeTrustedChallengeProof(params: {
  secretKeyHex: string;
  tvId: string;
  roomId: string;
  deviceId: string;
  challengeNonce: string;
  timestampMs: number;
}): string {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(params.secretKeyHex.trim().toLowerCase());
  const messageStr = `${params.tvId}|${params.roomId}|${params.deviceId}|${params.challengeNonce}|${params.timestampMs}`;
  const msgBytes = encoder.encode(messageStr);

  const blockSize = 64;
  const normalizedKey =
    keyBytes.length > blockSize ? sha256Bytes(keyBytes) : keyBytes;
  const kPad = new Uint8Array(blockSize);
  kPad.set(normalizedKey);

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = kPad[i] ^ 0x5c;
    iKeyPad[i] = kPad[i] ^ 0x36;
  }

  const innerInput = new Uint8Array(blockSize + msgBytes.length);
  innerInput.set(iKeyPad);
  innerInput.set(msgBytes, blockSize);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(blockSize + innerHash.length);
  outerInput.set(oKeyPad);
  outerInput.set(innerHash, blockSize);
  const finalHash = sha256Bytes(outerInput);

  return Array.from(finalHash)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * SEC-LAN-001 & SEC-LAN-002 Stateful Pairing, Trusted-Device Enrollment & Command Authorization Verifier.
 *
 * Enforces:
 * 1. First-time enrollment requires explicit on-TV approval (`PENDING_TV_APPROVAL` -> `approvePendingPhoneOnTv(now, { enrollAsTrusted: true })`).
 * 2. Enrolled trusted devices reconnect via single-use challenge-response (`issueReconnectChallenge` + `verifyTrustedReconnectResponse`) without repeated TV approval.
 * 3. Trusted-device credentials expire after 14 days (`trustedDeviceTtlMs`).
 * 4. Active session tokens expire after 30 minutes (`sessionTtlMs`) and can be renewed (`renewActiveSession`) while active.
 * 5. Maximum continuous-session duration (`maxContinuousSessionMs`, default 4 hours) enforced before mandatory reauthentication.
 * 6. Immediate single-device (`revokeTrustedDevice`) and all-device (`revokeAllTrustedDevices`) revocation.
 * 7. Idle ephemeral pairing token rotation (`rotateIdlePairingToken`) without granting authorization or bypassing enrollment.
 */
export class LanSessionGuard {
  private tvId: string;
  private roomId: string;
  private pairingToken: string;
  private pairingExpiresAtMs: number;
  private previousPairingToken: string | null = null;
  private previousPairingExpiresAtMs: number = 0;
  private sessionToken: string | null = null;
  private sessionStartedAtMs: number = 0;
  private sessionExpiresAtMs: number = 0;
  private maxSessionExpiresAtMs: number = 0;
  private activeTrustedDeviceId: string | null = null;
  private status: PairingAuthorizationStatus = 'AWAITING_PHONE';
  private pendingDeviceName: string | null = null;
  private pendingDeviceId: string | null = null;
  private lastAcceptedSeq: number = 0;

  private pairingTtlMs: number;
  private sessionTtlMs: number;
  private maxContinuousSessionMs: number;
  private trustedDeviceTtlMs: number;
  private replayWindowMs: number;

  private trustedDevices: Map<string, TrustedDeviceRecord> = new Map();
  private pendingChallenges: Map<
    string,
    { challengeNonce: string; issuedAtMs: number; expiresAtMs: number }
  > = new Map();
  private usedChallengeNonces: Set<string> = new Set();

  constructor(params: {
    tvId?: string;
    roomId: string;
    pairingToken?: string;
    pairingTtlMs?: number;
    sessionTtlMs?: number;
    maxContinuousSessionMs?: number;
    trustedDeviceTtlMs?: number;
    replayWindowMs?: number;
    initialTrustedDevices?: TrustedDeviceRecord[];
    nowMs?: number;
  }) {
    const now = params.nowMs ?? Date.now();
    this.tvId = params.tvId || `TV-${params.roomId}`;
    this.roomId = params.roomId;
    this.pairingTtlMs = params.pairingTtlMs ?? 2 * 60 * 1000;
    this.sessionTtlMs = params.sessionTtlMs ?? 30 * 60 * 1000;
    this.maxContinuousSessionMs =
      params.maxContinuousSessionMs ?? 4 * 60 * 60 * 1000;
    this.trustedDeviceTtlMs =
      params.trustedDeviceTtlMs ?? 14 * 24 * 60 * 60 * 1000;
    this.replayWindowMs = params.replayWindowMs ?? 30 * 1000;
    this.pairingToken = params.pairingToken || generateCryptographicToken(12);
    this.pairingExpiresAtMs = now + this.pairingTtlMs;

    if (Array.isArray(params.initialTrustedDevices)) {
      for (const dev of params.initialTrustedDevices) {
        if (dev && dev.deviceId) {
          this.trustedDevices.set(dev.deviceId, { ...dev });
        }
      }
    }
  }

  public getState(nowMs: number = Date.now()) {
    this.checkExpiry(nowMs);
    return {
      tvId: this.tvId,
      roomId: this.roomId,
      pairingToken: this.pairingToken,
      pairingExpiresAtMs: this.pairingExpiresAtMs,
      sessionToken: this.sessionToken,
      sessionStartedAtMs: this.sessionStartedAtMs,
      sessionExpiresAtMs: this.sessionExpiresAtMs,
      maxSessionExpiresAtMs: this.maxSessionExpiresAtMs,
      activeTrustedDeviceId: this.activeTrustedDeviceId,
      status: this.status,
      pendingDeviceName: this.pendingDeviceName,
      lastAcceptedSeq: this.lastAcceptedSeq,
      trustedDevices: this.getTrustedDevices(nowMs),
    };
  }

  public getTrustedDevices(nowMs: number = Date.now()): TrustedDeviceRecord[] {
    const list: TrustedDeviceRecord[] = [];
    for (const dev of this.trustedDevices.values()) {
      list.push({
        ...dev,
        revoked: dev.revoked || nowMs > dev.expiresAtMs,
      });
    }
    return list;
  }

  private checkExpiry(nowMs: number): void {
    if (
      (this.status === 'AWAITING_PHONE' ||
        this.status === 'PENDING_TV_APPROVAL') &&
      nowMs > this.pairingExpiresAtMs
    ) {
      this.status = 'EXPIRED';
    } else if (this.status === 'AUTHORIZED') {
      if (
        this.maxSessionExpiresAtMs > 0 &&
        nowMs > this.maxSessionExpiresAtMs
      ) {
        this.status = 'EXPIRED';
        this.sessionToken = null;
      } else if (nowMs > this.sessionExpiresAtMs) {
        this.status = 'EXPIRED';
        this.sessionToken = null;
      }
    }
  }

  /**
   * SEC-LAN-002 Requirement #7:
   * Rotates the short-lived ephemeral pairing token while the TV is idle (`AWAITING_PHONE` or `EXPIRED`).
   * Strictly preserves security: NEVER grants authorization or bypasses enrollment.
   */
  public rotateIdlePairingToken(
    nowMs: number = Date.now(),
    nextToken?: string
  ): {
    rotated: boolean;
    pairingToken: string;
    pairingExpiresAtMs: number;
    status: PairingAuthorizationStatus;
  } {
    this.checkExpiry(nowMs);
    if (
      this.status === 'AUTHORIZED' ||
      this.status === 'PENDING_TV_APPROVAL'
    ) {
      return {
        rotated: false,
        pairingToken: this.pairingToken,
        pairingExpiresAtMs: this.pairingExpiresAtMs,
        status: this.status,
      };
    }

    this.previousPairingToken = this.pairingToken;
    this.previousPairingExpiresAtMs = nowMs + 45_000; // 45 seconds grace period for in-flight pairing
    this.pairingToken = nextToken || generateCryptographicToken(12);
    this.pairingExpiresAtMs = nowMs + this.pairingTtlMs;
    this.status = 'AWAITING_PHONE';

    return {
      rotated: true,
      pairingToken: this.pairingToken,
      pairingExpiresAtMs: this.pairingExpiresAtMs,
      status: this.status,
    };
  }

  /**
   * Step 1 (Unenrolled / First-Time Phone):
   * Phone presents the short-lived pairing token discovered via QR/code.
   * Transitions to `PENDING_TV_APPROVAL` so the TV operator must explicitly authorize the phone (SEC-LAN-002 Req #1).
   */
  public verifyPairingRequest(params: {
    roomId: string;
    pairingToken: string;
    deviceName: string;
    deviceId?: string;
    nowMs?: number;
  }): {
    valid: boolean;
    status: PairingAuthorizationStatus;
    failureCategory: StreamingFailureCategory;
    reasonBM: string;
  } {
    const now = params.nowMs ?? Date.now();
    this.checkExpiry(now);

    if (this.status === 'REVOKED') {
      return {
        valid: false,
        status: this.status,
        failureCategory: 'SESSION_REVOKED',
        reasonBM:
          'Sesi gandingan ini telah dibatalkan oleh TV (Session Revoked).',
      };
    }

    if (this.status === 'EXPIRED' || now > this.pairingExpiresAtMs) {
      this.status = 'EXPIRED';
      return {
        valid: false,
        status: 'EXPIRED',
        failureCategory: 'SESSION_EXPIRED',
        reasonBM:
          'Token gandingan telah tamat tempoh (Pairing Token Expired). Sila gunakan token baharu pada TV.',
      };
    }

    if (
      params.roomId !== this.roomId ||
      !params.pairingToken ||
      params.pairingToken !== this.pairingToken
    ) {
      return {
        valid: false,
        status: this.status,
        failureCategory: 'PAIRING_TOKEN_INVALID',
        reasonBM:
          'Token gandingan atau kod bilik tidak sah (Invalid Pairing Token).',
      };
    }

    this.pendingDeviceName = params.deviceName || 'Telefon Pintar';
    this.pendingDeviceId = params.deviceId || null;
    this.status = 'PENDING_TV_APPROVAL';
    return {
      valid: true,
      status: 'PENDING_TV_APPROVAL',
      failureCategory: 'NONE',
      reasonBM: 'Menunggu kelulusan eksplisit pada skrin TV.',
    };
  }

  /**
   * Step 2 (On-TV Explicit Approval):
   * TV operator explicitly approves the pending phone on the TV screen.
   * If `options.enrollAsTrusted` is true, also provisions a 14-day Trusted Device credential (`SEC-LAN-002` Req #1 & #3).
   */
  public approvePendingPhoneOnTv(
    nowMs: number = Date.now(),
    options?: { enrollAsTrusted?: boolean; deviceId?: string }
  ): {
    approved: boolean;
    sessionToken: string | null;
    expiresAtMs: number;
    maxSessionExpiresAtMs: number;
    trustedCredential: TrustedDeviceRecord | null;
    reasonBM: string;
  } {
    this.checkExpiry(nowMs);
    if (this.status !== 'PENDING_TV_APPROVAL') {
      return {
        approved: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        trustedCredential: null,
        reasonBM:
          'Tiada permintaan gandingan yang sah sedang menunggu kelulusan.',
      };
    }

    this.sessionToken = generateCryptographicToken(16);
    this.sessionStartedAtMs = nowMs;
    this.sessionExpiresAtMs = nowMs + this.sessionTtlMs;
    this.maxSessionExpiresAtMs = nowMs + this.maxContinuousSessionMs;
    this.lastAcceptedSeq = 0;
    this.status = 'AUTHORIZED';

    let trustedCredential: TrustedDeviceRecord | null = null;
    if (options?.enrollAsTrusted) {
      const devId =
        options.deviceId ||
        this.pendingDeviceId ||
        `dev-${generateCryptographicToken(8)}`;
      const secretKeyHex = generateCryptographicToken(24);
      trustedCredential = {
        deviceId: devId,
        deviceName: this.pendingDeviceName || 'Telefon Pentadbir',
        tvId: this.tvId,
        secretKeyHex,
        enrolledAtMs: nowMs,
        expiresAtMs: nowMs + this.trustedDeviceTtlMs, // 14-day TTL
        lastConnectedAtMs: nowMs,
        revoked: false,
      };
      this.trustedDevices.set(devId, trustedCredential);
      this.activeTrustedDeviceId = devId;
    } else {
      this.activeTrustedDeviceId = null;
    }

    return {
      approved: true,
      sessionToken: this.sessionToken,
      expiresAtMs: this.sessionExpiresAtMs,
      maxSessionExpiresAtMs: this.maxSessionExpiresAtMs,
      trustedCredential,
      reasonBM: trustedCredential
        ? 'Telefon diluluskan dan didaftarkan sebagai Peranti Pentadbir Dipercayai (14 Hari).'
        : 'Telefon diluluskan untuk sesi kawalan LAN tempatan (30 Minit).',
    };
  }

  /**
   * SEC-LAN-002 Requirement #2:
   * Issues a single-use cryptographic challenge nonce for a previously enrolled Trusted Device.
   */
  public issueReconnectChallenge(
    deviceId: string,
    nowMs: number = Date.now()
  ): {
    issued: boolean;
    challengeNonce: string | null;
    failureCategory: StreamingFailureCategory;
    reasonBM: string;
  } {
    const dev = this.trustedDevices.get(deviceId);
    if (!dev) {
      return {
        issued: false,
        challengeNonce: null,
        failureCategory: 'TRUSTED_CREDENTIAL_INVALID',
        reasonBM:
          'Peranti ini tidak berdaftar dalam senarai Peranti Dipercayai TV.',
      };
    }

    if (dev.revoked) {
      return {
        issued: false,
        challengeNonce: null,
        failureCategory: 'TRUSTED_DEVICE_REVOKED',
        reasonBM:
          'Kebenaran Peranti Dipercayai ini telah dibatalkan (Revoked) pada TV.',
      };
    }

    if (nowMs > dev.expiresAtMs) {
      return {
        issued: false,
        challengeNonce: null,
        failureCategory: 'TRUSTED_CREDENTIAL_EXPIRED',
        reasonBM:
          'Tauliah Peranti Dipercayai (14 hari) telah tamat tempoh. Sila imbas Kod QR untuk pendaftaran semula.',
      };
    }

    const challengeNonce = generateCryptographicToken(16);
    this.pendingChallenges.set(deviceId, {
      challengeNonce,
      issuedAtMs: nowMs,
      expiresAtMs: nowMs + 30_000,
    });

    return {
      issued: true,
      challengeNonce,
      failureCategory: 'NONE',
      reasonBM: 'Cabaran kriptografi dikeluarkan.',
    };
  }

  /**
   * SEC-LAN-002 Requirement #2, #3, #9:
   * Verifies the cryptographic challenge-response from an enrolled Trusted Device and grants
   * an authorized 30-minute session (bounded by the 4-hour max continuous session limit)
   * without requiring repeated physical button presses on the TV.
   */
  public verifyTrustedReconnectResponse(params: {
    roomId: string;
    deviceId: string;
    challengeNonce: string;
    timestampMs: number;
    proofHex: string;
    nowMs?: number;
  }): {
    authorized: boolean;
    sessionToken: string | null;
    expiresAtMs: number;
    maxSessionExpiresAtMs: number;
    deviceName: string | null;
    failureCategory: StreamingFailureCategory;
    reasonBM: string;
  } {
    const now = params.nowMs ?? Date.now();
    const dev = this.trustedDevices.get(params.deviceId);

    if (!dev || params.roomId !== this.roomId) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'TRUSTED_CREDENTIAL_INVALID',
        reasonBM: 'Identiti Peranti Dipercayai atau Bilik TV tidak sah.',
      };
    }

    if (dev.revoked) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'TRUSTED_DEVICE_REVOKED',
        reasonBM:
          'Akses ditolak: Peranti Dipercayai telah dibatalkan (Revoked) oleh TV.',
      };
    }

    if (now > dev.expiresAtMs) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'TRUSTED_CREDENTIAL_EXPIRED',
        reasonBM:
          'Akses ditolak: Tauliah Peranti Dipercayai (14 hari) telah tamat tempoh.',
      };
    }

    // Prevent replay of used challenge nonces
    if (
      !params.challengeNonce ||
      this.usedChallengeNonces.has(params.challengeNonce)
    ) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'REPLAY_DETECTED',
        reasonBM:
          'Akses ditolak: Nonce cabaran telah digunakan atau diulang (Replay Detected).',
      };
    }

    const pending = this.pendingChallenges.get(params.deviceId);
    if (
      !pending ||
      pending.challengeNonce !== params.challengeNonce ||
      now > pending.expiresAtMs
    ) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'TRUSTED_CREDENTIAL_INVALID',
        reasonBM: 'Cabaran pengesahan tidak sah atau telah tamat masa.',
      };
    }

    if (Math.abs(now - params.timestampMs) > this.replayWindowMs) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'REPLAY_DETECTED',
        reasonBM:
          'Cap masa pengesahan berada di luar tetingkap keselamatan (Replay Window).',
      };
    }

    const expectedProof = computeTrustedChallengeProof({
      secretKeyHex: dev.secretKeyHex,
      tvId: this.tvId,
      roomId: this.roomId,
      deviceId: dev.deviceId,
      challengeNonce: params.challengeNonce,
      timestampMs: params.timestampMs,
    });

    if (!params.proofHex || params.proofHex !== expectedProof) {
      return {
        authorized: false,
        sessionToken: null,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        deviceName: null,
        failureCategory: 'TRUSTED_CREDENTIAL_INVALID',
        reasonBM:
          'Tandatangan kriptografi Peranti Dipercayai tidak sah (Invalid Proof).',
      };
    }

    // Consume challenge nonce so it can never be replayed
    this.pendingChallenges.delete(params.deviceId);
    this.usedChallengeNonces.add(params.challengeNonce);

    dev.lastConnectedAtMs = now;
    this.pendingDeviceName = dev.deviceName;
    this.activeTrustedDeviceId = dev.deviceId;
    this.sessionToken = generateCryptographicToken(16);
    this.sessionStartedAtMs = now;
    this.sessionExpiresAtMs = now + this.sessionTtlMs;
    this.maxSessionExpiresAtMs = now + this.maxContinuousSessionMs;
    this.lastAcceptedSeq = 0;
    this.status = 'AUTHORIZED';

    return {
      authorized: true,
      sessionToken: this.sessionToken,
      expiresAtMs: this.sessionExpiresAtMs,
      maxSessionExpiresAtMs: this.maxSessionExpiresAtMs,
      deviceName: dev.deviceName,
      failureCategory: 'NONE',
      reasonBM:
        'Peranti Pentadbir Dipercayai disahkan secara automatik (Zero-Touch LAN).',
    };
  }

  /**
   * SEC-LAN-002 Requirement #4 & #5:
   * Renews an active 30-minute session token ONLY while the session is currently `AUTHORIZED` and active,
   * and strictly caps renewal at `maxSessionExpiresAtMs` (4 hours maximum continuous session duration).
   */
  public renewActiveSession(
    sessionToken: string,
    nowMs: number = Date.now()
  ): {
    renewed: boolean;
    expiresAtMs: number;
    maxSessionExpiresAtMs: number;
    failureCategory: StreamingFailureCategory;
    reasonBM: string;
  } {
    this.checkExpiry(nowMs);

    if (this.status === 'REVOKED') {
      return {
        renewed: false,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        failureCategory: 'SESSION_REVOKED',
        reasonBM: 'Sesi telah dibatalkan dan tidak boleh diperbaharui.',
      };
    }

    if (
      this.maxSessionExpiresAtMs > 0 &&
      nowMs >= this.maxSessionExpiresAtMs
    ) {
      this.status = 'EXPIRED';
      this.sessionToken = null;
      return {
        renewed: false,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: this.maxSessionExpiresAtMs,
        failureCategory: 'MAX_SESSION_DURATION_EXCEEDED',
        reasonBM:
          'Had tempoh sesi berterusan maksimum (4 jam) telah dicapai. Sila sahkan semula sambungan.',
      };
    }

    if (
      this.status !== 'AUTHORIZED' ||
      !this.sessionToken ||
      sessionToken !== this.sessionToken
    ) {
      return {
        renewed: false,
        expiresAtMs: 0,
        maxSessionExpiresAtMs: 0,
        failureCategory: 'SESSION_EXPIRED',
        reasonBM:
          'Sesi telah tamat tempoh atau tidak aktif dan tidak boleh diperbaharui.',
      };
    }

    const proposedExpiry = nowMs + this.sessionTtlMs;
    this.sessionExpiresAtMs = Math.min(
      proposedExpiry,
      this.maxSessionExpiresAtMs
    );

    return {
      renewed: true,
      expiresAtMs: this.sessionExpiresAtMs,
      maxSessionExpiresAtMs: this.maxSessionExpiresAtMs,
      failureCategory: 'NONE',
      reasonBM: 'Tempoh sesi aktif diperbaharui.',
    };
  }

  /**
   * Step 2 Alternative: TV operator rejects the pairing request.
   */
  public rejectPendingPhoneOnTv(): void {
    this.status = 'REJECTED';
    this.sessionToken = null;
  }

  /**
   * Step 3: TV operator revokes an active or pending session at any time (SEC-LAN-001 Constraint #6).
   */
  public revokeSession(): void {
    this.status = 'REVOKED';
    this.sessionToken = null;
    this.sessionExpiresAtMs = 0;
    this.maxSessionExpiresAtMs = 0;
  }

  /**
   * SEC-LAN-002 Requirement #6:
   * Immediately revokes a single enrolled Trusted Device by `deviceId`.
   * If that device is currently connected in an active session, terminates the active session immediately.
   */
  public revokeTrustedDevice(deviceId: string): boolean {
    const dev = this.trustedDevices.get(deviceId);
    if (!dev) return false;
    dev.revoked = true;
    this.pendingChallenges.delete(deviceId);

    if (this.activeTrustedDeviceId === deviceId) {
      this.revokeSession();
    }
    return true;
  }

  /**
   * SEC-LAN-002 Requirement #6:
   * Immediately revokes ALL enrolled Trusted Devices and terminates any active session.
   */
  public revokeAllTrustedDevices(): number {
    let count = 0;
    for (const dev of this.trustedDevices.values()) {
      if (!dev.revoked) {
        dev.revoked = true;
        count++;
      }
    }
    this.pendingChallenges.clear();
    if (this.status === 'AUTHORIZED' || this.activeTrustedDeviceId) {
      this.revokeSession();
      this.activeTrustedDeviceId = null;
    }
    return count;
  }

  /**
   * Step 4: Validates an incoming remote control command arriving over the direct
   * P2P RTCDataChannel (SEC-LAN-001 Constraints #4, #6, #7 & SEC-LAN-002 Req #4, #5, #9).
   */
  public validateCommand(
    cmd: LanControlCommandMessage,
    nowMs: number = Date.now()
  ): {
    accepted: boolean;
    failureCategory: StreamingFailureCategory;
    reasonBM: string;
  } {
    // Check if the active trusted device was revoked mid-session
    if (this.activeTrustedDeviceId) {
      const dev = this.trustedDevices.get(this.activeTrustedDeviceId);
      if (!dev || dev.revoked) {
        this.revokeSession();
        return {
          accepted: false,
          failureCategory: 'TRUSTED_DEVICE_REVOKED',
          reasonBM:
            'Arahan ditolak: Peranti Dipercayai telah dibatalkan (Revoked) oleh TV.',
        };
      }
      if (nowMs > dev.expiresAtMs) {
        this.status = 'EXPIRED';
        this.sessionToken = null;
        return {
          accepted: false,
          failureCategory: 'TRUSTED_CREDENTIAL_EXPIRED',
          reasonBM:
            'Arahan ditolak: Tauliah Peranti Dipercayai (14 hari) telah tamat tempoh.',
        };
      }
    }

    if (
      this.status === 'AUTHORIZED' &&
      this.maxSessionExpiresAtMs > 0 &&
      nowMs > this.maxSessionExpiresAtMs
    ) {
      this.status = 'EXPIRED';
      this.sessionToken = null;
      return {
        accepted: false,
        failureCategory: 'MAX_SESSION_DURATION_EXCEEDED',
        reasonBM:
          'Arahan ditolak: Had tempoh sesi berterusan maksimum (4 jam) telah tamat. Sila sambung semula.',
      };
    }

    this.checkExpiry(nowMs);

    if (this.status === 'REVOKED') {
      return {
        accepted: false,
        failureCategory: 'SESSION_REVOKED',
        reasonBM: 'Sesi kawalan jauh telah dibatalkan (Revoked).',
      };
    }

    if (this.status === 'EXPIRED') {
      return {
        accepted: false,
        failureCategory: 'SESSION_EXPIRED',
        reasonBM: 'Sesi kawalan jauh telah tamat tempoh (Expired).',
      };
    }

    if (
      this.status !== 'AUTHORIZED' ||
      !this.sessionToken ||
      cmd.roomId !== this.roomId ||
      cmd.sessionToken !== this.sessionToken
    ) {
      return {
        accepted: false,
        failureCategory: 'UNAUTHORIZED_COMMAND',
        reasonBM:
          'Arahan ditolak: Peranti tidak mempunyai kebenaran sesi aktif (Unauthorized).',
      };
    }

    const APPROVED_ACTIONS: Set<string> = new Set([
      'SWITCH_VIEW_STREAM',
      'SWITCH_VIEW_PRIMARY',
      'START_STREAM',
      'STOP_STREAM',
      'PING_STATE',
      'RENEW_SESSION',
      'SET_FIT_MODE',
      'SYNC_ANNOUNCEMENTS',
      'SET_OVERLAY_DENSITY',
      'SET_THEATRE_MODE',
      'SET_ORIENTATION',
      'SET_ROTATION',
    ]);

    if (!cmd.action || !APPROVED_ACTIONS.has(cmd.action)) {
      return {
        accepted: false,
        failureCategory: 'UNAUTHORIZED_COMMAND',
        reasonBM:
          'Arahan ditolak: Jenis arahan tidak sah atau tidak diluluskan (Invalid Command Action).',
      };
    }

    // Replay protection: strictly increasing sequence number (`seq > lastAcceptedSeq`)
    if (
      typeof cmd.seq !== 'number' ||
      !Number.isInteger(cmd.seq) ||
      cmd.seq <= this.lastAcceptedSeq
    ) {
      return {
        accepted: false,
        failureCategory: 'REPLAY_DETECTED',
        reasonBM:
          'Arahan ditolak: Nombor jujukan berulang atau lapuk dikesan (Replay Detected).',
      };
    }

    // Timestamp freshness check
    if (
      typeof cmd.timestampMs !== 'number' ||
      Math.abs(nowMs - cmd.timestampMs) > this.replayWindowMs
    ) {
      return {
        accepted: false,
        failureCategory: 'REPLAY_DETECTED',
        reasonBM:
          'Arahan ditolak: Cap masa arahan di luar tetingkap keselamatan (Stale Command Timestamp).',
      };
    }

    this.lastAcceptedSeq = cmd.seq;

    // If command is RENEW_SESSION, extend the 30m session window (bounded by 4h max continuous session)
    if (cmd.action === 'RENEW_SESSION') {
      const renewal = this.renewActiveSession(cmd.sessionToken, nowMs);
      if (!renewal.renewed) {
        return {
          accepted: false,
          failureCategory: renewal.failureCategory,
          reasonBM: renewal.reasonBM,
        };
      }
    }

    return {
      accepted: true,
      failureCategory: 'NONE',
      reasonBM: 'Arahan disahkan.',
    };
  }
}

/**
 * Safely buffers incoming remote ICE candidates when `pc.remoteDescription`
 * has not yet been applied, and flushes them in order once `setRemoteDescription` completes.
 * Enforces SEC-LAN-001 by only queueing permitted `typ host` candidates.
 */
export class IceCandidateQueue {
  private queue: RTCIceCandidateInit[] = [];

  public enqueue(candidate: RTCIceCandidateInit): boolean {
    if (!candidate || !candidate.candidate) return false;
    if (!isPermittedHostOnlyCandidate(candidate.candidate)) {
      return false;
    }
    if (this.queue.length < 100) {
      this.queue.push(candidate);
      return true;
    }
    return false;
  }

  public size(): number {
    return this.queue.length;
  }

  public clear(): void {
    this.queue = [];
  }

  public drain(): RTCIceCandidateInit[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }
}

/**
 * Classifies `navigator.mediaDevices.getUserMedia` errors into accurate,
 * evidence-backed categories.
 */
export function classifyMediaError(err: unknown): {
  category: StreamingFailureCategory;
  messageBM: string;
} {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name?: string }).name)
      : '';
  const msg = err instanceof Error ? err.message : String(err || '');

  if (
    name === 'NotAllowedError' ||
    name === 'PermissionDeniedError' ||
    msg.toLowerCase().includes('permission') ||
    msg.toLowerCase().includes('denied')
  ) {
    return {
      category: 'CAMERA_PERMISSION_DENIED',
      messageBM:
        'Kebenaran kamera atau mikrofon ditolak (Camera Permission Denied). Sila benarkan akses kamera pada pelayar telefon anda.',
    };
  }

  if (
    name === 'NotFoundError' ||
    name === 'DevicesNotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'NotReadableError'
  ) {
    return {
      category: 'CAMERA_UNAVAILABLE',
      messageBM:
        'Kamera peranti tidak ditemui atau sedang digunakan oleh aplikasi lain (Camera Unavailable).',
    };
  }

  return {
    category: 'CAMERA_UNAVAILABLE',
    messageBM:
      msg || 'Gagal mengakses kamera atau mikrofon peranti (Camera Unavailable).',
  };
}

/**
 * Determines the specific evidence-backed failure category and Bahasa Melayu explanation
 * when Host-Only Local LAN WebRTC ICE fails (SEC-LAN-001).
 */
export function classifyIceFailure(params: {
  localCandidateTypes: string[];
  remoteCandidateTypes: string[];
  sdpOfferCompleted: boolean;
  sdpAnswerCompleted: boolean;
}): {
  category: StreamingFailureCategory;
  messageBM: string;
} {
  if (!params.sdpOfferCompleted || !params.sdpAnswerCompleted) {
    return {
      category: 'SDP_NEGOTIATION_FAILED',
      messageBM:
        'Rundingan sesi SDP belum selesai antara telefon dan skrin paparan (SDP Negotiation Incomplete). Pastikan kedua-dua peranti menggunakan Kod Bilik & Token yang sah.',
    };
  }

  if (
    params.localCandidateTypes.length === 0 ||
    params.remoteCandidateTypes.length === 0
  ) {
    return {
      category: 'NO_VIABLE_ICE_CANDIDATE',
      messageBM:
        'Tiada calon laluan rangkaian tempatan (Host ICE Candidate) diterima. Kawalan jauh disekat mengikut polisi keselamatan SEC-LAN-001.',
    };
  }

  return {
    category: 'LAN_UNREACHABLE_OR_ISOLATED',
    messageBM:
      'Polisi Keselamatan SEC-LAN-001 (Fail-Closed): Sambungan terus LAN tempatan gagal ditubuhkan antara telefon dan TV. Pastikan telefon tidak menggunakan data mudah alih (4G/5G), berada pada rangkaian Wi-Fi/LAN tempatan yang sama dengan TV, dan tiada pengasingan klien Wi-Fi (AP/VLAN Client Isolation).',
  };
}

/**
 * Normalizes a TV pairing room code consistently across Display, Sender, and Server.
 * Strips hash tags (#), whitespace, dashes, and non-alphanumeric characters.
 * E.g. "#443743" -> "443743", "443 743" -> "443743"
 */
export function normalizeRoomCode(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 12);
}

/**
 * Creates an animated Malaysian Broadcast Test Pattern stream using HTML5 Canvas captureStream.
 * Used when camera hardware is unavailable, permission is pending, or on non-localhost HTTP origins,
 * guaranteeing that video frames always transmit reliably to the Smart TV receiver.
 */
export function createTestPatternStream(
  width = 1280,
  height = 720,
  label = 'Siaran Langsung Telefon'
): MediaStream {
  if (typeof document === 'undefined') {
    return typeof MediaStream !== 'undefined' ? new MediaStream() : ({} as MediaStream);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  let frame = 0;

  const draw = () => {
    if (!ctx) return;
    frame++;

    // Background gradient: Malaysian prayer hall obsidian & emerald aesthetic
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#041712');
    grad.addColorStop(0.5, '#0A261E');
    grad.addColorStop(1, '#020B08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Architectural grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Top Broadcast Status Badge
    ctx.fillStyle = '#10B981';
    ctx.fillRect(40, 36, 230, 44);
    ctx.fillStyle = '#020B08';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('● SIARAN LANGSUNG', 54, 65);

    // Center circular radar & pulse animation
    const centerX = width / 2;
    const centerY = height / 2;
    const pulse = Math.sin(frame * 0.06) * 18;

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 35, 95 + pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 35, 75, 0, Math.PI * 2);
    ctx.stroke();

    // Central Title Label
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, centerX, centerY - 25);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('Pancaran Video Telefon Pintar (P2P LAN WebRTC)', centerX, centerY + 15);

    // Audio level meter visualizer bars
    const bars = 16;
    const barWidth = 14;
    const barGap = 6;
    const totalBarsWidth = bars * (barWidth + barGap);
    const startX = centerX - totalBarsWidth / 2;
    for (let i = 0; i < bars; i++) {
      const h = 18 + Math.abs(Math.sin((frame + i * 3) * 0.12)) * 45;
      ctx.fillStyle = i < 12 ? '#10B981' : '#F59E0B';
      ctx.fillRect(startX + i * (barWidth + barGap), centerY + 55 + (45 - h), barWidth, h);
    }

    // Live Malaysia time and frame timestamp at bottom
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ms-MY', { hour12: false });
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAKTU TEMPATAN: ${timeStr}  |  FRAME #${frame}`, centerX, height - 60);
  };

  const timer = setInterval(draw, 1000 / 30);
  draw();

  const stream = (canvas as HTMLCanvasElement & { captureStream?: (fps: number) => MediaStream }).captureStream
    ? (canvas as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30)
    : (typeof MediaStream !== 'undefined' ? new MediaStream() : ({} as MediaStream));

  // Attach Audio Track if AudioContext is supported
  try {
    const AudioCtx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;
    if (AudioCtx && typeof stream.addTrack === 'function') {
      const actx = new AudioCtx();
      const dest = actx.createMediaStreamDestination();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      gain.gain.value = 0.001;
      osc.connect(gain);
      gain.connect(dest);
      osc.start();
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    }
  } catch {
    // Ignore audio context error in testing environments
  }

  // Cleanup on track stop
  if (typeof stream.getVideoTracks === 'function') {
    const track = stream.getVideoTracks()[0];
    if (track) {
      const origStop = track.stop ? track.stop.bind(track) : () => {};
      track.stop = () => {
        clearInterval(timer);
        origStop();
      };
    }
  }

  return stream;
}
