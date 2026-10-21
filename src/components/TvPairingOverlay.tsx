import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  CheckCircle2,
  KeyRound,
  PhoneOff,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  PairingAuthorizationStatus,
  StreamingDiagnostics,
  StreamingLifecycleState,
  TrustedDeviceRecord,
} from '../types/domain';
import { normalizeRoomCode } from '../domain/webrtcUtils';

interface TvPairingOverlayProps {
  roomId: string;
  pairingToken: string;
  pairingExpiresAtMs: number;
  sessionExpiresAtMs: number;
  maxSessionExpiresAtMs: number;
  trustedDevices: TrustedDeviceRecord[];
  authorizationStatus: PairingAuthorizationStatus;
  streamState: StreamingLifecycleState;
  diagnostics: StreamingDiagnostics;
  peerDeviceName: string | null;
  nowEpochMs: number;
  onApprovePairing: (options?: { enrollAsTrusted?: boolean }) => void;
  onRejectPairing: () => void;
  onRevokeSession: () => void;
  onRevokeTrustedDevice: (deviceId: string) => void;
  onRevokeAllTrustedDevices: () => void;
  onRegenerateRoom: () => void;
  hideDock?: boolean;
}

function formatRemainingTime(targetMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatRemainingDays(targetMs: number, nowMs: number): string {
  const diffDays = Math.max(
    1,
    Math.ceil((targetMs - nowMs) / (24 * 60 * 60 * 1000))
  );
  return `${diffDays} hari`;
}

/**
 * Gate 12 & SEC-LAN-002 — Zero-Touch Smart TV Pairing Beacon, Trusted-Device Enrollment & Management
 *
 * Addresses Gate 12 & SEC-LAN-002 Requirements:
 * - Provides an always-scannable, non-intrusive bottom-right QR Pairing Beacon on the Primary Prayer Display
 *   so first-time users can scan from a distance without touching a TV mouse/remote to open a popover.
 * - Auto-rotates ephemeral pairing tokens every 90 seconds while idle (handled in `useWebRTCStream`).
 * - First-time enrollment requires explicit on-TV approval (`PENDING_TV_APPROVAL`) with options for:
 *   1. Luluskan & Daftarkan Peranti Dipercayai (14 Hari) [Default / Key 1 / Enter]
 *   2. Luluskan Sesi Ini Sahaja (30 Minit) [Key 2]
 *   3. Tolak [Key 3 / Escape]
 * - Supports immediate single-device and all-device revocation (`revokeTrustedDevice`, `revokeAllTrustedDevices`).
 */
export const TvPairingOverlay: React.FC<TvPairingOverlayProps> = ({
  roomId,
  pairingToken,
  pairingExpiresAtMs,
  sessionExpiresAtMs,
  maxSessionExpiresAtMs,
  trustedDevices,
  authorizationStatus,
  streamState,
  diagnostics,
  peerDeviceName,
  nowEpochMs,
  onApprovePairing,
  onRejectPairing,
  onRevokeSession,
  onRevokeTrustedDevice,
  onRevokeAllTrustedDevices,
  onRegenerateRoom,
  hideDock = false,
}) => {
  const [isManageDrawerOpen, setIsManageDrawerOpen] = useState<boolean>(false);
  const [compactBeaconMode, setCompactBeaconMode] = useState<boolean>(false);

  const cleanRoom = normalizeRoomCode(roomId);
  const senderUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?mode=sender&room=${cleanRoom}&token=${pairingToken}`
      : `https://localhost:3000/?mode=sender&room=${cleanRoom}&token=${pairingToken}`;

  const tokenExpired =
    (authorizationStatus === 'AWAITING_PHONE' ||
      authorizationStatus === 'EXPIRED') &&
    nowEpochMs > pairingExpiresAtMs;

  const isControlConnected = diagnostics.dataChannelState === 'open';
  const activeTrustedDevices = trustedDevices.filter(
    (d) => nowEpochMs < d.expiresAtMs
  );

  // Close the management drawer automatically if a new phone requests approval
  useEffect(() => {
    if (authorizationStatus === 'PENDING_TV_APPROVAL') {
      setIsManageDrawerOpen(false);
    }
  }, [authorizationStatus]);

  // Keyboard / D-pad support for Smart TV remotes during First-Time Enrollment (SEC-LAN-002 Req #1)
  useEffect(() => {
    if (authorizationStatus !== 'PENDING_TV_APPROVAL') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '1') {
        e.preventDefault();
        onApprovePairing({ enrollAsTrusted: true });
      } else if (e.key === '2') {
        e.preventDefault();
        onApprovePairing({ enrollAsTrusted: false });
      } else if (e.key === '3' || e.key === 'Escape') {
        e.preventDefault();
        onRejectPairing();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authorizationStatus, onApprovePairing, onRejectPairing]);

  return (
    <>
      {/* 1. MANDATORY FIRST-TIME TV AUTHORIZATION & TRUSTED-DEVICE ENROLLMENT BANNER (SEC-LAN-002 Req #1) */}
      {authorizationStatus === 'PENDING_TV_APPROVAL' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tv-approval-title"
          data-testid="tv-pairing-approval-banner"
          className="fixed inset-x-0 top-14 z-50 mx-auto max-w-4xl px-4 animate-in fade-in duration-150"
        >
          <div className="bg-[#0C1D19] border-2 border-amber-400 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <h2
                  id="tv-approval-title"
                  className="text-base sm:text-lg font-bold text-white"
                >
                  Pengesahan Pendaftaran Peranti TV (SEC-LAN-002): Luluskan
                  Telefon Ini?
                </h2>
                <p className="text-xs sm:text-sm text-amber-200 leading-snug">
                  Peranti{' '}
                  <strong className="text-white font-bold">
                    {peerDeviceName || 'Telefon Pentadbir'}
                  </strong>{' '}
                  meminta kebenaran kawalan jauh LAN tempatan (Bilik{' '}
                  <span className="font-mono-tabular font-bold">{roomId}</span>
                  ).
                </p>
                <p className="text-[11px] text-slate-300">
                  Alat Kawalan TV: Tekan <strong>OK / Enter / 1</strong> untuk{' '}
                  <strong>Daftar Peranti Dipercayai (14 Hari)</strong>, kekunci{' '}
                  <strong>2</strong> untuk <strong>Sesi Ini Sahaja (30m)</strong>
                  , atau <strong>Back / 3</strong> untuk <strong>Tolak</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end shrink-0">
              <button
                type="button"
                autoFocus
                data-testid="btn-approve-enroll-trusted"
                onClick={() => onApprovePairing({ enrollAsTrusted: true })}
                className="min-h-[44px] px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 focus-visible:ring-4 focus-visible:ring-amber-300 text-slate-950 font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Luluskan &amp; Daftarkan (14 Hari)</span>
              </button>

              <button
                type="button"
                data-testid="btn-approve-pairing"
                onClick={() => onApprovePairing({ enrollAsTrusted: false })}
                className="min-h-[44px] px-3.5 py-2.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 focus-visible:ring-4 focus-visible:ring-amber-300 text-amber-200 font-semibold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Sesi Ini Sahaja (30m)</span>
              </button>

              <button
                type="button"
                data-testid="btn-reject-pairing"
                onClick={onRejectPairing}
                className="min-h-[44px] px-3.5 py-2.5 bg-rose-700 hover:bg-rose-600 focus-visible:ring-4 focus-visible:ring-rose-300 text-white font-semibold text-xs sm:text-sm rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Tolak</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. TRUSTED DEVICES & SECURITY MANAGEMENT DRAWER (SEC-LAN-002 Req #6) */}
      {isManageDrawerOpen && (
        <div
          role="dialog"
          aria-label="Pengurusan Peranti Dipercayai dan Gandingan LAN"
          data-testid="tv-trusted-devices-drawer"
          className="fixed bottom-20 right-4 z-40 w-80 sm:w-[420px] bg-[#0B1916] border border-amber-400/50 rounded-2xl p-4 shadow-2xl space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-sm font-bold text-white">
                Pengurusan Kawalan TV &amp; Peranti Dipercayai
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsManageDrawerOpen(false)}
              aria-label="Tutup Panel Pengurusan"
              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* QR Code & Auto-Rotating Beacon Info */}
          <div className="flex items-center gap-3.5 bg-[#07110F] border border-white/10 rounded-xl p-3">
            <div className="bg-white p-2 rounded-lg shrink-0">
              <QRCodeSVG
                value={senderUrl}
                size={96}
                level="M"
                includeMargin={false}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[11px] text-slate-300">
                Imbas untuk mendaftarkan telefon baharu pada Wi-Fi/LAN tempatan:
              </div>
              <div className="font-mono-tabular text-base font-extrabold text-amber-400">
                Bilik: {roomId.slice(0, 3)} {roomId.slice(3)}
              </div>
              <div className="font-mono-tabular text-[11px] text-emerald-300 truncate">
                Token: {pairingToken}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono-tabular pt-0.5">
                <span className="text-slate-400">
                  Auto-Giliran:{' '}
                  {formatRemainingTime(pairingExpiresAtMs, nowEpochMs)}
                </span>
                <button
                  type="button"
                  onClick={onRegenerateRoom}
                  className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 font-semibold cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Giliran</span>
                </button>
              </div>
            </div>
          </div>

          {/* Enrolled Trusted Administrator Phones List (SEC-LAN-002 Req #3 & #6) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-200">
                Telefon Pentadbir Berdaftar ({activeTrustedDevices.length})
              </span>
              {activeTrustedDevices.length > 0 && (
                <button
                  type="button"
                  data-testid="btn-revoke-all-trusted"
                  onClick={onRevokeAllTrustedDevices}
                  className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Batalkan Semua</span>
                </button>
              )}
            </div>

            {activeTrustedDevices.length === 0 ? (
              <div className="text-[11px] text-slate-400 bg-[#07110F] border border-white/5 rounded-xl p-3">
                Tiada peranti dipercayai berdaftar. Imbas Kod QR dan pilih{' '}
                <strong className="text-emerald-300">
                  &ldquo;Luluskan &amp; Daftarkan (14 Hari)&rdquo;
                </strong>{' '}
                untuk kawalan tanpa sentuhan TV pada sesi akan datang.
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {activeTrustedDevices.map((dev) => (
                  <div
                    key={dev.deviceId}
                    data-testid={`trusted-device-row-${dev.deviceId}`}
                    className="bg-[#07110F] border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-100 truncate">
                        {dev.deviceName}
                      </div>
                      <div className="text-[10px] font-mono-tabular text-slate-400">
                        ID: {dev.deviceId.slice(0, 8)} · Sah lagi{' '}
                        {formatRemainingDays(dev.expiresAtMs, nowEpochMs)}
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`btn-revoke-device-${dev.deviceId}`}
                      onClick={() => onRevokeTrustedDevice(dev.deviceId)}
                      className="px-2.5 py-1 bg-rose-900/70 hover:bg-rose-700 text-rose-200 hover:text-white text-[11px] font-semibold rounded-lg transition-colors shrink-0 cursor-pointer"
                    >
                      Batalkan
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ZERO-TOUCH SMART TV PAIRING BEACON & ACTIVE SESSION STATUS DOCK (Bottom-Right)
          Always scannable when idle so users never need a TV remote just to reveal the QR code */}
      {!hideDock && (
        <div
          data-testid="tv-lan-pairing-dock"
          className="fixed bottom-3 right-3 z-30 flex items-end gap-2"
        >
          {authorizationStatus === 'AUTHORIZED' ? (
            <div className="bg-[#0A1815]/95 backdrop-blur-md border border-emerald-500/50 rounded-2xl px-3.5 py-2 shadow-xl flex flex-wrap items-center gap-2.5 text-xs">
              <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="flex items-center gap-1.5 font-medium text-slate-200">
                <span className="truncate max-w-[160px] font-bold text-emerald-300">
                  {peerDeviceName || 'Telefon Tersambung'}
                </span>
                <span aria-hidden="true" className="text-slate-500">
                  ·
                </span>
                <span className="font-mono-tabular text-slate-200">
                  {streamState === 'STREAMING'
                    ? 'Siaran Aktif'
                    : isControlConnected
                    ? 'Kawalan LAN Aktif'
                    : 'Menyambung P2P'}
                </span>
                {sessionExpiresAtMs > nowEpochMs && (
                  <>
                    <span aria-hidden="true" className="text-slate-500">
                      ·
                    </span>
                    <span
                      title="Tempoh sah sesi kawalan LAN (diperbaharui automatik sehingga had 4 jam)"
                      className="font-mono-tabular text-slate-400"
                    >
                      {formatRemainingTime(sessionExpiresAtMs, nowEpochMs)}
                    </span>
                  </>
                )}
                {maxSessionExpiresAtMs > nowEpochMs && (
                  <span className="hidden sm:inline text-[10px] font-mono-tabular text-emerald-400/80">
                    (Had 4j)
                  </span>
                )}
              </div>

              <button
                type="button"
                data-testid="btn-open-trusted-drawer"
                onClick={() => setIsManageDrawerOpen((prev) => !prev)}
                className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-slate-200 font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <KeyRound className="w-3 h-3 text-amber-400" />
                <span>Peranti ({activeTrustedDevices.length})</span>
              </button>

              <button
                type="button"
                data-testid="dock-btn-revoke-session"
                onClick={onRevokeSession}
                className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white font-semibold rounded-lg inline-flex items-center gap-1 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-3 h-3" />
                <span>Putuskan</span>
              </button>
            </div>
          ) : compactBeaconMode ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                data-testid="btn-toggle-qr-pairing"
                onClick={() => setCompactBeaconMode(false)}
                className="bg-[#0A1815]/95 hover:bg-[#0F241F] backdrop-blur-md border border-amber-400/40 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 text-xs text-slate-100 transition-colors cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-semibold">Imbas Kawalan TV</span>
                <span className="font-mono-tabular font-bold text-amber-300">
                  #{roomId}
                </span>
              </button>
            </div>
          ) : (
            /* Always-Scannable Zero-Touch QR Beacon Card (Default when TV is idle) */
            <div
              data-testid="tv-zero-touch-qr-beacon"
              className="bg-[#0A1815]/95 backdrop-blur-md border border-amber-400/40 rounded-2xl p-2.5 shadow-2xl flex items-center gap-3 max-w-[340px]"
            >
              <div
                onClick={() => setIsManageDrawerOpen((prev) => !prev)}
                title="Klik untuk membuka pengurusan peranti dipercayai"
                className="bg-white p-1.5 rounded-xl shrink-0 cursor-pointer"
              >
                <QRCodeSVG
                  value={senderUrl}
                  size={68}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-amber-300 truncate">
                    Imbas Kawalan TV (LAN)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="btn-toggle-qr-pairing"
                      onClick={() => setIsManageDrawerOpen((prev) => !prev)}
                      title="Pengurusan Peranti Dipercayai"
                      className="p-1 text-slate-300 hover:text-amber-300 rounded cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompactBeaconMode(true)}
                      title="Kecilkan Kod QR"
                      className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="font-mono-tabular text-sm font-extrabold text-white tracking-wider">
                  Bilik {roomId.slice(0, 3)} {roomId.slice(3)}
                </div>

                <div className="flex items-center justify-between gap-2 text-[10px] font-mono-tabular text-slate-300">
                  <span className="text-emerald-300 truncate">
                    {activeTrustedDevices.length > 0
                      ? `${activeTrustedDevices.length} Peranti Dipercayai`
                      : 'Sedia Diimbas'}
                  </span>
                  <span className="text-slate-400 shrink-0">
                    {tokenExpired
                      ? 'Mengemas kini...'
                      : formatRemainingTime(pairingExpiresAtMs, nowEpochMs)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};
