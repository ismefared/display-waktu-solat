import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Camera,
  Check,
  Copy,
  Maximize2,
  PhoneCall,
  PhoneOff,
  Radio,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  X,
  XCircle,
} from 'lucide-react';
import { MalaysiaDateParts } from '../domain/prayerEngine';
import { PrayerCountdownDisplay } from './PrayerCountdownDisplay';
import { AnnouncementTicker } from './AnnouncementTicker';
import {
  AnnouncementItem,
  LocationState,
  OverlayDensity,
  PairingAuthorizationStatus,
  ResolvedPrayerState,
  StreamingDiagnostics,
  StreamingFailureCategory,
  StreamingLifecycleState,
  TickerConfig,
  VideoFitMode,
  VideoOrientationMode,
  VideoRotationDegrees,
} from '../types/domain';
import { normalizeRoomCode } from '../domain/webrtcUtils';

export interface DisplayWebRTCController {
  tvId: string;
  roomId: string;
  setRoomId: (id: string) => void;
  pairingToken: string;
  setPairingToken: (t: string) => void;
  pairingExpiresAtMs: number;
  sessionExpiresAtMs: number;
  maxSessionExpiresAtMs: number;
  authorizationStatus: PairingAuthorizationStatus;
  state: StreamingLifecycleState;
  failureCategory: StreamingFailureCategory;
  diagnostics: StreamingDiagnostics;
  peerDeviceName: string | null;
  errorMessage: string | null;
  tvMediaPlaying: boolean;
  notifyTvVideoPlaying: (playing: boolean) => void;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  fitMode?: VideoFitMode;
  theatreMode?: boolean;
  overlayDensity?: OverlayDensity;
  orientationMode?: VideoOrientationMode;
  rotationDegrees?: VideoRotationDegrees;
  announcements?: AnnouncementItem[];
  tickerConfig?: TickerConfig;
  setFitMode?: (mode: VideoFitMode) => void;
  setTheatreMode?: (active: boolean) => void;
  setOverlayDensity?: (density: OverlayDensity) => void;
  setOrientationMode?: (mode: VideoOrientationMode) => void;
  setRotationDegrees?: (degrees: VideoRotationDegrees) => void;
  setAnnouncements?: (items: AnnouncementItem[]) => void;
  setTickerConfig?: (config: TickerConfig) => void;
  startCameraBroadcast: (
    targetRoomId?: string,
    cameraMode?: 'environment' | 'user',
    targetToken?: string
  ) => Promise<void>;
  disconnectStream: () => void;
  regenerateRoom: () => void;
  approvePendingPairingOnTv: (options?: { enrollAsTrusted?: boolean }) => void;
  rejectPendingPairingOnTv: () => void;
  revokePairingSessionOnTv: () => void;
  revokeTrustedDeviceOnTv: (deviceId: string) => void;
  revokeAllTrustedDevicesOnTv: () => void;
}

interface StreamReceiverViewProps {
  dateParts: MalaysiaDateParts;
  resolvedPrayer: ResolvedPrayerState | null;
  locationState: LocationState;
  webrtc: DisplayWebRTCController;
  onReturnToPrimary: () => void;
  onSwitchToSenderMode: (roomId: string, pairingToken: string) => void;
}

const STREAM_STATE_LABELS: Record<
  StreamingLifecycleState,
  { labelBM: string; descriptionBM: string; colorClass: string }
> = {
  INITIALIZING: {
    labelBM: 'Memulakan Sesi Tempatan (Initializing)',
    descriptionBM:
      'Menyediakan sesi gandingan keselamatan LAN tempatan (SEC-LAN-001)...',
    colorClass: 'text-slate-300',
  },
  REQUESTING_CAMERA: {
    labelBM: 'Meminta Akses Kamera (Requesting Camera)',
    descriptionBM: 'Mengaktifkan peranti kamera tempatan...',
    colorClass: 'text-amber-300',
  },
  WAITING_FOR_PEER: {
    labelBM: 'Menunggu Sambungan Telefon (LAN Tempatan)',
    descriptionBM:
      'Imbas Kod QR pada rangkaian Wi-Fi/LAN tempatan yang sama. Token gandingan mempunyai tempoh sah terhad (2 minit) dan memerlukan kelulusan pada skrin TV ini.',
    colorClass: 'text-amber-300',
  },
  SIGNALING: {
    labelBM: 'Menyambung Saluran Gandingan (Signaling)',
    descriptionBM: 'Mendaftarkan bilik gandingan sementara...',
    colorClass: 'text-amber-300',
  },
  NEGOTIATING: {
    labelBM: 'Rundingan Sesi P2P Tempatan (Negotiating SDP)',
    descriptionBM:
      'Menubuhkan rundingan media dan saluran data P2P tempatan selepas kelulusan TV...',
    colorClass: 'text-sky-300',
  },
  GATHERING_ICE: {
    labelBM: 'Mengumpul Laluan Host LAN (Gathering Host ICE)',
    descriptionBM:
      'Mengesahkan calon antara muka rangkaian tempatan (Host-Only ICE, Tiada STUN/TURN Awam)...',
    colorClass: 'text-sky-300',
  },
  CONNECTING: {
    labelBM: 'Mengesahkan Laluan Terus LAN (Connecting)',
    descriptionBM:
      'Menjalankan semakan ketersambungan terus antara telefon dan TV pada rangkaian tempatan...',
    colorClass: 'text-sky-300',
  },
  CONNECTED: {
    labelBM: 'Saluran Kawalan LAN P2P Tersambung — Menunggu Video Kamera',
    descriptionBM:
      'Sambungan kawalan jauh P2P tempatan telah disahkan. Tekan "Mod Kamera Telefon" pada telefon untuk memulakan siaran langsung.',
    colorClass: 'text-emerald-300',
  },
  WAITING_FOR_STREAM: {
    labelBM: 'Menunggu Siaran Video Telefon (Waiting for Phone Stream)',
    descriptionBM:
      'Kawalan telefon telah disahkan pada LAN tempatan. Telefon sedang menyediakan akses kamera untuk memulakan siaran video langsung...',
    colorClass: 'text-amber-300',
  },
  STREAMING: {
    labelBM: 'Siaran Langsung LAN Aktif (Streaming)',
    descriptionBM:
      'Memaparkan video dan audio secara langsung daripada telefon yang disahkan pada rangkaian tempatan.',
    colorClass: 'text-emerald-400',
  },
  RECONNECTING: {
    labelBM: 'Menyambung Semula Laluan LAN (Reconnecting)',
    descriptionBM:
      'Mengesan gangguan sementara pada rangkaian tempatan. Sedang memulihkan sambungan (10 saat)...',
    colorClass: 'text-amber-400',
  },
  STOPPING: {
    labelBM: 'Menghentikan Siaran (Stopping)',
    descriptionBM:
      'Menutup sesi siaran video dan melepaskan sumber media...',
    colorClass: 'text-amber-300',
  },
  RETURNING_TO_PRAYER_DISPLAY: {
    labelBM: 'Kembali ke Paparan Waktu Solat',
    descriptionBM:
      'Menyediakan semula paparan jadual waktu solat utama secara automatik...',
    colorClass: 'text-emerald-300',
  },
  PRAYER_DISPLAY: {
    labelBM: 'Paparan Waktu Solat Utama',
    descriptionBM: 'Paparan jadual waktu solat utama sedang beroperasi.',
    colorClass: 'text-slate-300',
  },
  DISCONNECTED: {
    labelBM: 'Sambungan Ditamatkan / Dibatalkan (Disconnected)',
    descriptionBM:
      'Sesi siaran langsung telah ditamatkan atau dibatalkan. Anda boleh menjana token baharu atau kembali ke paparan waktu solat.',
    colorClass: 'text-slate-300',
  },
  FAILED: {
    labelBM: 'Sambungan Disekat / Gagal (Fail-Closed SEC-LAN-001)',
    descriptionBM:
      'Laluan terus LAN tempatan tidak dapat disahkan atau token tidak sah. Kawalan jauh melalui internet awam atau rangkaian berasingan disekat secara automatik.',
    colorClass: 'text-rose-400',
  },
  CLOSED: {
    labelBM: 'Sesi Ditutup (Closed)',
    descriptionBM: 'Saluran WebRTC telah ditutup dengan selamat.',
    colorClass: 'text-slate-400',
  },
  WAITING: {
    labelBM: 'Menunggu Sambungan Telefon',
    descriptionBM:
      'Imbas kod QR di bawah pada rangkaian Wi-Fi/LAN tempatan yang sama.',
    colorClass: 'text-amber-300',
  },
  PAIRING: {
    labelBM: 'Permintaan Gandingan Diterima — Sila Sahkan Pada TV',
    descriptionBM:
      'Telefon pintar meminta kebenaran gandingan. Sila klik "Luluskan Telefon Ini" pada skrin TV untuk membenarkan kawalan dan siaran LAN.',
    colorClass: 'text-amber-300',
  },
};

/**
 * Gate 13 — Immersive Live Camera UX & Automatic Return to Main Display
 *
 * Objectives:
 * 1. Dominant near-fullscreen camera feed when stream is active (responsive, unconstrained).
 * 2. Elegant blurred ambient background fill for portrait phone feeds (no aspect-ratio distortion).
 * 3. High-contrast Prayer Information Overlay (Zone, Current Local Time, Next Prayer Name & Time, Countdown).
 * 4. Minimal Broadcast Status ("SIARAN LANGSUNG", "Dikawal oleh Telefon Pintar (LAN)").
 * 5. Hides pairing QR codes, room tokens, and diagnostics from audience view, with discreet operator controls access.
 * 6. Deterministic Automatic Return to Main Prayer Display upon STOP_STREAM, track end, revocation, or 10s network interruption.
 */
export const StreamReceiverView: React.FC<StreamReceiverViewProps> = ({
  dateParts,
  resolvedPrayer,
  locationState,
  webrtc,
  onReturnToPrimary,
  onSwitchToSenderMode,
}) => {
  const {
    roomId,
    pairingToken,
    authorizationStatus,
    state,
    failureCategory,
    diagnostics,
    peerDeviceName,
    errorMessage,
    notifyTvVideoPlaying,
    remoteStream,
    localStream,
    startCameraBroadcast,
    disconnectStream,
    regenerateRoom,
    approvePendingPairingOnTv,
    rejectPendingPairingOnTv,
    revokePairingSessionOnTv,
  } = webrtc;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const blurredVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoContainerRef = useRef<HTMLDivElement | null>(null);

  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [playbackBlocked, setPlaybackBlocked] = useState<boolean>(false);
  const [isOperatorDrawerOpen, setIsOperatorDrawerOpen] =
    useState<boolean>(false);

  const currentFitMode: VideoFitMode = webrtc.fitMode || 'blurred';
  const currentDensity: OverlayDensity = webrtc.overlayDensity || 'standard';

  // Remote control TV return shortcut (Escape / Back / 0)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === '0') {
        onReturnToPrimary();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReturnToPrimary]);

  const activeMediaStream = remoteStream || localStream;
  const hasActiveMediaTracks = Boolean(
    activeMediaStream &&
      activeMediaStream.getTracks().some((t) => t.readyState === 'live')
  );
  const isStreamingActive =
    hasActiveMediaTracks ||
    (Boolean(activeMediaStream) &&
      (state === 'STREAMING' ||
        state === 'CONNECTED' ||
        state === 'WAITING_FOR_STREAM' ||
        webrtc.tvMediaPlaying));

  const setVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && activeMediaStream) {
        el.muted = isMuted;
        el.defaultMuted = isMuted;
        el.playsInline = true;
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        if (isMuted) {
          el.setAttribute('muted', '');
        }
        if (el.srcObject !== activeMediaStream) {
          el.srcObject = activeMediaStream;
        }
        el.play()
          .then(() => {
            setPlaybackBlocked(false);
            notifyTvVideoPlaying(true);
          })
          .catch(() => {
            el.muted = true;
            el.defaultMuted = true;
            el.setAttribute('muted', '');
            setIsMuted(true);
            el.play()
              .then(() => {
                setPlaybackBlocked(false);
                notifyTvVideoPlaying(true);
              })
              .catch(() => {
                notifyTvVideoPlaying(false);
                setPlaybackBlocked(true);
              });
          });
      }
    },
    [activeMediaStream, isMuted, notifyTvVideoPlaying]
  );

  const setBlurredVideoRef = React.useCallback(
    (el: HTMLVideoElement | null) => {
      blurredVideoRef.current = el;
      if (el && activeMediaStream) {
        el.muted = true;
        el.defaultMuted = true;
        el.playsInline = true;
        el.setAttribute('playsinline', 'true');
        el.setAttribute('webkit-playsinline', 'true');
        el.setAttribute('muted', '');
        if (el.srcObject !== activeMediaStream) {
          el.srcObject = activeMediaStream;
        }
        el.play().catch(() => {});
      }
    },
    [activeMediaStream]
  );

  // Sync media stream with main and blurred background video elements
  useEffect(() => {
    const videoEl = videoRef.current;
    const blurredEl = blurredVideoRef.current;

    if (videoEl && activeMediaStream) {
      videoEl.muted = isMuted;
      videoEl.defaultMuted = isMuted;
      videoEl.playsInline = true;
      videoEl.setAttribute('playsinline', 'true');
      videoEl.setAttribute('webkit-playsinline', 'true');
      if (isMuted) {
        videoEl.setAttribute('muted', '');
      }
      if (videoEl.srcObject !== activeMediaStream) {
        videoEl.srcObject = activeMediaStream;
      }
      videoEl
        .play()
        .then(() => {
          setPlaybackBlocked(false);
          notifyTvVideoPlaying(true);
        })
        .catch(() => {
          videoEl.muted = true;
          videoEl.defaultMuted = true;
          videoEl.setAttribute('muted', '');
          setIsMuted(true);
          videoEl
            .play()
            .then(() => {
              setPlaybackBlocked(false);
              notifyTvVideoPlaying(true);
            })
            .catch(() => {
              notifyTvVideoPlaying(false);
              setPlaybackBlocked(true);
            });
        });
    } else if (!activeMediaStream) {
      notifyTvVideoPlaying(false);
    }

    if (blurredEl && activeMediaStream) {
      blurredEl.muted = true;
      blurredEl.defaultMuted = true;
      blurredEl.playsInline = true;
      if (blurredEl.srcObject !== activeMediaStream) {
        blurredEl.srcObject = activeMediaStream;
      }
      blurredEl.play().catch(() => {});
    }
  }, [activeMediaStream, notifyTvVideoPlaying, isStreamingActive, state]);

  const cleanRoom = normalizeRoomCode(roomId);
  const senderUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?mode=sender&room=${cleanRoom}&token=${pairingToken}`
      : `https://localhost:3000/?mode=sender&room=${cleanRoom}&token=${pairingToken}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(senderUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleFullscreenVideo = () => {
    if (!videoContainerRef.current) return;
    if (!document.fullscreenElement) {
      videoContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const stateMeta =
    STREAM_STATE_LABELS[state] || STREAM_STATE_LABELS.WAITING_FOR_PEER;

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. IMMERSIVE BROADCAST VIEW (Active Phone Camera Live Stream)
  // ─────────────────────────────────────────────────────────────────────────────
  if (isStreamingActive) {
    return (
      <main
        data-testid="immersive-live-stream-container"
        ref={videoContainerRef}
        className="relative flex-1 min-h-0 min-w-0 w-full h-full bg-[#020907] flex flex-col justify-between overflow-hidden select-none"
      >
        {/* Responsive Blurred Ambient Background for Portrait / Non-16:9 Video Feeds */}
        {currentFitMode === 'blurred' && (
          <video
            ref={setBlurredVideoRef}
            data-testid="portrait-blur-backdrop"
            aria-hidden="true"
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-35 scale-110 pointer-events-none"
          />
        )}

        {/* Contrast Gradient Shading to Guarantee Readability over Variable Camera Feeds */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#020907]/90 via-black/25 to-[#020907]/80 pointer-events-none z-[1]"
        />

        {/* Dominant Main Video Element (preserves aspect ratio without distortion) */}
        <video
          ref={setVideoRef}
          autoPlay
          playsInline
          muted={isMuted}
          onPlaying={() => notifyTvVideoPlaying(true)}
          onPause={() => notifyTvVideoPlaying(false)}
          onEnded={() => notifyTvVideoPlaying(false)}
          className={`relative z-10 w-full h-full pointer-events-auto ${
            currentFitMode === 'cover' ? 'object-cover' : 'object-contain'
          }`}
        />

        {/* TOP STATUS BAR: Minimal Broadcast Badge (Left) & Discreet Operator Controls (Right) */}
        <header className="absolute top-0 left-0 right-0 p-4 sm:p-5 flex items-start justify-between gap-3 z-20 pointer-events-none">
          {/* Minimal Broadcast Status Badge (Audience-Friendly) */}
          <div
            data-testid="broadcast-status-badge"
            className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 bg-[#061A14]/90 backdrop-blur-md border border-emerald-500/40 rounded-xl shadow-2xl min-w-0"
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
            </span>
            <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-white drop-shadow">
              SIARAN LANGSUNG
            </span>
            <span aria-hidden="true" className="text-slate-500">
              ·
            </span>
            <span className="text-[11px] sm:text-xs text-emerald-300 font-medium truncate max-w-[200px] sm:max-w-none">
              Dikawal oleh Telefon Pintar (LAN)
            </span>
            <span data-testid="streaming-state-label" className="sr-only">
              {stateMeta.labelBM}
            </span>
          </div>

          {/* Discreet Operator Controls Access (Keeps normal audience view clean) */}
          <div className="pointer-events-auto flex items-center gap-2">
            {playbackBlocked && (
              <button
                type="button"
                onClick={() => {
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.muted = false;
                    videoRef.current.play().catch(() => {});
                  }
                  setPlaybackBlocked(false);
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <VolumeX className="w-4 h-4" />
                <span>Nyahsenyap Audio TV</span>
              </button>
            )}

            <button
              type="button"
              data-testid="btn-toggle-operator-controls"
              onClick={() => setIsOperatorDrawerOpen((prev) => !prev)}
              aria-label="Kawalan &amp; Diagnostik Siaran TV"
              className="min-h-[38px] px-3.5 py-1.5 bg-[#061A14]/90 hover:bg-[#0B2720] border border-white/20 text-slate-200 text-xs sm:text-sm font-semibold rounded-xl backdrop-blur-md inline-flex items-center gap-2 transition-colors cursor-pointer shadow-xl"
            >
              <Settings className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Kawalan Siaran</span>
            </button>
          </div>
        </header>

        {/* Temporary Network Interruption Banner (10s Bounded Recovery Notice) */}
        {state === 'RECONNECTING' && (
          <div
            role="alert"
            className="absolute top-18 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 bg-amber-950/95 border-2 border-amber-400 text-amber-200 text-xs sm:text-sm font-bold rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-pulse"
          >
            <RefreshCw className="w-4 h-4 animate-spin text-amber-300 shrink-0" />
            <span>
              Sambungan LAN terputus sementara. Sedang memulihkan sambungan (10 saat)...
            </span>
          </div>
        )}

        {/* Graceful Transition Overlay on Stopping / Automatic Return */}
        {(state === 'STOPPING' || state === 'RETURNING_TO_PRAYER_DISPLAY') && (
          <div
            role="status"
            className="absolute inset-0 z-30 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-3"
          >
            <RefreshCw className="w-10 h-10 animate-spin text-emerald-400" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Menghentikan Siaran Langsung...
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Kembali ke paparan jadual waktu solat utama secara automatik.
            </p>
          </div>
        )}

        {/* LOWER SECTION: Next-Prayer Countdown Overlay + Full-Width Announcement Ticker */}
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col justify-end pointer-events-none">
          {/* Animated Next-Prayer Countdown Overlay positioned comfortably above ticker */}
          <div className="p-4 sm:p-5 flex items-end justify-between gap-3 pointer-events-none">
            {resolvedPrayer && (
              <aside
                data-testid="prayer-overlay-card"
                aria-label="Ringkasan Waktu Solat dan Kiraan Detik"
                className="pointer-events-auto max-w-[460px] bg-[#061A14]/92 backdrop-blur-md border border-[#D4AF37]/50 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-1.5 text-white"
              >
                {/* Location & Current Time */}
                <div className="flex items-center justify-between gap-3 text-xs sm:text-sm font-semibold text-slate-300 border-b border-white/10 pb-1.5">
                  <span className="truncate max-w-[240px] text-slate-100 font-bold">
                    Zon {locationState.activeZone.code} ({locationState.activeZone.name})
                  </span>
                  <span className="font-mono-tabular text-emerald-300 shrink-0 font-bold">
                    {dateParts.time24WithSeconds}
                  </span>
                </div>

                {/* Next Prayer Scheduled Info & Tabular Animated Countdown */}
                <div className="flex items-baseline justify-between gap-4 pt-0.5">
                  <div className="text-xs sm:text-sm text-slate-200 min-w-0">
                    <span className="text-slate-400">Solat Seterusnya: </span>
                    <div className="text-[#F6D860] font-extrabold text-base sm:text-lg truncate">
                      {resolvedPrayer.nextPrayer.labelBM} ({resolvedPrayer.nextPrayer.time24})
                    </div>
                  </div>
                  <div
                    data-testid="prayer-countdown-digits"
                    className={`font-mono-tabular text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight shrink-0 drop-shadow transition-colors ${
                      resolvedPrayer.countdown.totalSeconds <= 60
                        ? 'text-amber-400 motion-safe:animate-pulse'
                        : resolvedPrayer.countdown.totalSeconds <= 15 * 60
                        ? 'text-amber-300'
                        : 'text-amber-400'
                    }`}
                  >
                    -{resolvedPrayer.countdown.formatted}
                  </div>
                </div>

                {/* 15-Minute or Final-Minute Visual Indicator */}
                {resolvedPrayer.countdown.totalSeconds <= 60 &&
                resolvedPrayer.countdown.totalSeconds > 0 ? (
                  <div className="pt-1 flex items-center gap-1.5 text-[11px] font-black text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 motion-safe:animate-ping" />
                    <span>Saat Akhir Sebelum Masuk Waktu</span>
                  </div>
                ) : resolvedPrayer.countdown.totalSeconds <= 15 * 60 &&
                  resolvedPrayer.countdown.totalSeconds > 0 ? (
                  <div className="pt-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>15 Minit Menjelang Masuk Waktu Solat</span>
                  </div>
                ) : null}
              </aside>
            )}
          </div>

          {/* User-Managed Announcement Ticker across bottom of screen */}
          <AnnouncementTicker
            announcements={webrtc.announcements}
            tickerConfig={webrtc.tickerConfig}
            nowEpochMs={Date.now()}
            className="pointer-events-auto"
          />
        </div>

        {/* OPERATOR CONTROLS MODAL / POPUP (Accessible for TV Administrator / Mosque Crew) */}
        {isOperatorDrawerOpen && (
          <div
            role="dialog"
            aria-label="Panel Alat Kawalan Siaran TV"
            className="absolute top-18 right-4 z-40 w-80 sm:w-96 bg-[#061A14]/98 border border-amber-400/60 rounded-2xl p-4 shadow-2xl space-y-3.5 backdrop-blur-xl text-white"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-bold">Alat Kawalan Siaran LAN</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOperatorDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-300">
                <span>Peranti Penghantar:</span>
                <span className="font-bold text-emerald-300 truncate max-w-[160px]">
                  {peerDeviceName || 'Telefon Pintar LAN'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-300 font-mono-tabular">
                <span>Mod Nisbah Video:</span>
                <span className="font-bold text-amber-300 uppercase">
                  {currentFitMode}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-slate-300 font-mono-tabular">
                <span>Saluran Kawalan P2P:</span>
                <span
                  className={
                    diagnostics.dataChannelState === 'open'
                      ? 'text-emerald-400 font-bold'
                      : 'text-amber-400'
                  }
                >
                  {diagnostics.dataChannelState.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Quick Fit Mode Buttons */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="text-[11px] font-semibold text-slate-300">
                Nisbah Paparan Video:
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-xs font-bold">
                {(['contain', 'cover', 'blurred'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => webrtc.setFitMode?.(mode)}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-colors cursor-pointer ${
                      currentFitMode === mode
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {mode === 'contain' && 'Nisbah Asal'}
                    {mode === 'cover' && 'Skrin Penuh'}
                    {mode === 'blurred' && 'Latar Kabur'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setIsMuted((m) => {
                    const next = !m;
                    if (videoRef.current) videoRef.current.muted = next;
                    setPlaybackBlocked(false);
                    return next;
                  });
                }}
                className="min-h-[40px] px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-rose-400" />
                    <span>Nyahsenyap</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                    <span>Bisukan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleFullscreenVideo}
                className="min-h-[40px] px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Skrin Penuh</span>
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                data-testid="btn-return-primary-stream"
                onClick={() => {
                  setIsOperatorDrawerOpen(false);
                  onReturnToPrimary();
                }}
                className="min-h-[42px] w-full px-3.5 py-2 bg-white/15 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Paparan Waktu Solat</span>
              </button>

              <button
                type="button"
                data-testid="btn-revoke-session"
                onClick={() => {
                  setIsOperatorDrawerOpen(false);
                  revokePairingSessionOnTv();
                }}
                className="min-h-[42px] w-full px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Batalkan Sesi LAN (Revoke)</span>
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SETUP & WAITING VIEW (Before Phone Stream Begins / Manual Setup Stage)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <main className="flex-1 min-h-0 min-w-0 w-full max-w-[2560px] mx-auto display-main-grid flex flex-col justify-between overflow-x-hidden lg:overflow-hidden gap-3">
      {/* Persistent Mini Prayer & Countdown Bar */}
      <section
        aria-label="Bar Ringkasan Waktu Solat Semasa Siaran"
        className="w-full bg-[#0A1614] border border-white/10 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 min-w-0"
      >
        <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm xl:text-base min-w-0">
          <span className="font-bold text-slate-100 truncate max-w-[260px] sm:max-w-[420px]">
            Zon {locationState.activeZone.code} ({locationState.activeZone.name})
          </span>
          <span aria-hidden="true" className="text-slate-500">
            ·
          </span>
          <span className="font-mono-tabular font-semibold text-emerald-300 shrink-0">
            Waktu Semasa: {dateParts.time24WithSeconds}
          </span>
        </div>

        {resolvedPrayer && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="text-xs sm:text-sm xl:text-base text-slate-200">
              <span>Solat Seterusnya: </span>
              <strong className="text-amber-300 font-bold">
                {resolvedPrayer.nextPrayer.labelBM} (
                {resolvedPrayer.nextPrayer.time24})
              </strong>
            </div>
            <div className="font-mono-tabular text-lg sm:text-xl font-extrabold text-amber-400">
              -{resolvedPrayer.countdown.formatted}
            </div>
          </div>
        )}

        <button
          type="button"
          data-testid="btn-return-primary-stream"
          onClick={onReturnToPrimary}
          className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-100 bg-white/10 hover:bg-white/15 rounded-lg transition-colors shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Paparan Waktu Solat</span>
        </button>
      </section>

      {/* Inline TV Authorization Banner on Stream View if Pending */}
      {authorizationStatus === 'PENDING_TV_APPROVAL' && (
        <section
          role="alert"
          className="w-full bg-amber-950/80 border-2 border-amber-400 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <ShieldAlert className="w-6 h-6 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white">
                Pengesahan Keselamatan TV (SEC-LAN-001): Benarkan Gandingan Telefon?
              </h2>
              <p className="text-xs sm:text-sm text-amber-200 truncate">
                Peranti{' '}
                <strong className="text-white">
                  {peerDeviceName || 'Telefon Pintar'}
                </strong>{' '}
                meminta kebenaran untuk menyambung melalui rangkaian LAN tempatan
                (Bilik {roomId}).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => approvePendingPairingOnTv({ enrollAsTrusted: true })}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Luluskan &amp; Daftarkan (14 Hari)</span>
            </button>
            <button
              type="button"
              onClick={() => approvePendingPairingOnTv({ enrollAsTrusted: false })}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/60 text-amber-200 font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
            >
              <span>Sesi Ini Sahaja</span>
            </button>
            <button
              type="button"
              onClick={rejectPendingPairingOnTv}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Tolak</span>
            </button>
          </div>
        </section>
      )}

      {/* Main Content Grid: Left Video Stage (8 Cols) + Right Pairing & Security Controls (4 Cols) */}
      <section className="flex-1 min-h-0 min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left: Video Stage / Waiting Canvas */}
        <div
          ref={videoContainerRef}
          className="lg:col-span-8 min-h-[280px] lg:min-h-0 min-w-0 bg-[#050B0A] border border-white/15 rounded-xl overflow-hidden flex flex-col justify-between relative"
        >
          {/* Top Status Bar */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex flex-wrap items-center justify-between gap-2 z-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <span
                data-testid="streaming-state-label"
                className={`text-sm sm:text-base font-bold truncate ${stateMeta.colorClass}`}
              >
                {stateMeta.labelBM}
              </span>
              {peerDeviceName && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs sm:text-sm text-slate-200 font-medium truncate">
                    Peranti: {peerDeviceName}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 font-mono-tabular text-xs sm:text-sm text-slate-300 shrink-0">
              <span>
                Kawalan P2P:{' '}
                <strong
                  className={
                    diagnostics.dataChannelState === 'open'
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }
                >
                  {diagnostics.dataChannelState === 'open' ? 'AKTIF' : 'MENUNGGU'}
                </strong>
              </span>
              <span>·</span>
              <span>
                Bilik: <strong className="text-amber-300">{roomId}</strong>
              </span>
            </div>
          </div>

          {/* Center Waiting State Message */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 sm:p-6 text-center max-w-xl mx-auto space-y-3">
            <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shrink-0 ${
              authorizationStatus === 'AUTHORIZED'
                ? 'bg-emerald-950/80 border border-emerald-400 text-emerald-400 motion-safe:animate-pulse'
                : 'bg-emerald-950/80 border border-emerald-600/40 text-amber-400'
            }`}>
              {authorizationStatus === 'AUTHORIZED' ? (
                <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-emerald-400" />
              ) : (
                <PhoneCall className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-50">
              {authorizationStatus === 'AUTHORIZED'
                ? 'Telefon Pintar Berjaya Disahkan'
                : stateMeta.labelBM}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {authorizationStatus === 'AUTHORIZED'
                ? 'Pengesahan manual telah selesai dan telefon pintar kini terhubung sebagai alat kawalan. Sila aktifkan Mod Kamera pada telefon anda untuk mula memaparkan video siaran langsung pada skrin TV ini.'
                : stateMeta.descriptionBM}
            </p>
            {authorizationStatus === 'AUTHORIZED' && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-xs sm:text-sm text-emerald-200 font-medium space-y-1">
                <p>
                  Peringatan: Pada telefon anda, tekan <strong>&ldquo;3. Mod Kamera Telefon&rdquo;</strong> atau <strong>&ldquo;Mulakan Siaran Kamera&rdquo;</strong> untuk memulakan paparan video secara langsung.
                </p>
              </div>
            )}
            {errorMessage && (
              <div
                data-testid="stream-error-banner"
                className="p-3 bg-rose-950/70 border border-rose-500/50 rounded-lg text-xs sm:text-sm text-rose-200 font-medium max-w-lg"
              >
                <div>Kategori: {failureCategory}</div>
                <div className="mt-0.5">{errorMessage}</div>
              </div>
            )}
          </div>

          {/* Bottom Diagnostics Bar */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent flex flex-wrap items-center justify-between gap-2 z-10 shrink-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-mono-tabular text-slate-400">
                ICE: {diagnostics.iceConnectionState} · DataChannel:{' '}
                {diagnostics.dataChannelState} · Host:{' '}
                {diagnostics.localCandidateTypes.join(',') || 'tiada'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              {(authorizationStatus === 'AUTHORIZED' ||
                authorizationStatus === 'PENDING_TV_APPROVAL') && (
                <button
                  type="button"
                  data-testid="btn-revoke-session"
                  onClick={revokePairingSessionOnTv}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Batalkan Sesi LAN (Revoke)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: Phone Pairing Instructions, QR Code & SEC-LAN-001 Controls (4 Cols) */}
        <div className="lg:col-span-4 min-h-0 min-w-0 bg-[#0A1614] border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-3 overflow-y-auto">
          {authorizationStatus === 'AUTHORIZED' ? (
            <div className="space-y-4">
              <div className="bg-[#0D221C] border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2.5">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Telefon Pintar Telah Disahkan
                </h3>
                <p className="text-xs text-emerald-200">
                  Peranti <strong className="text-white">{peerDeviceName || 'Telefon Pintar (LAN)'}</strong> telah diluluskan oleh pentadbir TV.
                </p>
                <div className="pt-2 text-xs text-slate-300 border-t border-white/10 space-y-1.5 text-left font-mono-tabular">
                  <div className="flex justify-between">
                    <span>Saluran Kawalan:</span>
                    <strong className="text-emerald-400">P2P AKTIF</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Bilik TV:</span>
                    <strong className="text-amber-300">#{roomId}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Status Siaran:</span>
                    <strong className="text-amber-300">Menunggu Video</strong>
                  </div>
                </div>
              </div>

              <div className="bg-[#07100E] border border-white/10 rounded-2xl p-4 space-y-2 text-xs text-slate-300">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 text-sm">
                  <Camera className="w-4 h-4" />
                  <span>Arahan Pada Telefon Pintar:</span>
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-200 leading-relaxed">
                  <li>Lihat skrin telefon pintar anda yang sedang berhubung.</li>
                  <li>
                    Tekan butang hijau <strong>&ldquo;Mulakan Siaran Kamera Telefon&rdquo;</strong> (atau <strong>&ldquo;3. Mod Kamera Telefon&rdquo;</strong>).
                  </li>
                  <li>Berikan kebenaran akses kamera pada pelayar telefon.</li>
                  <li>Video kamera telefon akan terus dipaparkan dalam Mod Teater pada skrin TV ini.</li>
                </ol>
              </div>

              <button
                type="button"
                data-testid="btn-revoke-session"
                onClick={revokePairingSessionOnTv}
                className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Batalkan Sesi Gandingan (Revoke)</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-50">
                    Gandingan LAN Tempatan (SEC-LAN-001)
                  </h2>
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  Hanya telefon pada rangkaian Wi-Fi/LAN tempatan yang sama dibenarkan. Kawalan internet awam dan pelayan TURN luaran disekat sepenuhnya.
                </p>
              </div>

              {/* Responsive QR Code Box */}
              <div className="bg-white p-3.5 rounded-xl flex flex-col items-center justify-center gap-2 mx-auto w-fit">
                <QRCodeSVG
                  value={senderUrl}
                  size={136}
                  level="M"
                  includeMargin={false}
                />
                <span className="text-[11px] font-bold text-slate-900 tracking-wide">
                  IMBAS PADA WI-FI TEMPATAN SAMA
                </span>
              </div>

              {/* 6-Digit Pairing Code & Short-Lived Security Token */}
              <div className="bg-[#07100E] border border-white/10 rounded-xl p-3 text-center space-y-1">
                <div className="text-xs text-slate-400 font-medium">
                  Kod Bilik &amp; Token Keselamatan Sementara (TTL 2 Minit)
                </div>
                <div
                  data-testid="pairing-room-code"
                  className="font-mono-tabular text-2xl sm:text-3xl font-extrabold tracking-widest text-amber-400"
                >
                  {roomId.slice(0, 3)} {roomId.slice(3)}
                </div>
                <div
                  data-testid="pairing-security-token"
                  className="font-mono-tabular text-xs text-emerald-300 truncate px-2"
                >
                  Token: {pairingToken}
                </div>
                <div className="pt-1 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Pautan Disalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Pautan Gandingan</span>
                      </>
                    )}
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    type="button"
                    onClick={regenerateRoom}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Jana Token Baharu</span>
                  </button>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <ol className="space-y-1 text-xs text-slate-300 list-decimal list-inside">
                <li>
                  Sambungkan telefon ke Wi-Fi/LAN tempatan yang sama dengan TV.
                </li>
                <li>
                  Imbas Kod QR atau masukkan Kod Bilik &amp; Token Keselamatan.
                </li>
                <li>
                  Sahkan permintaan dengan menekan{' '}
                  <strong className="text-emerald-300">
                    &ldquo;Luluskan Telefon Ini&rdquo;
                  </strong>{' '}
                  pada skrin TV ini.
                </li>
              </ol>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-white/10 space-y-2 shrink-0">
            <button
              type="button"
              onClick={() => onSwitchToSenderMode(roomId, pairingToken)}
              className="min-h-[42px] w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-lg transition-colors cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Buka Alat Kawalan &amp; Kamera Telefon</span>
            </button>

            <button
              type="button"
              onClick={() => startCameraBroadcast(roomId)}
              className="min-h-[38px] w-full inline-flex items-center justify-center gap-2 px-3.5 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              <span>Uji Kamera Peranti Ini Secara Terus (Loopback)</span>
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};
