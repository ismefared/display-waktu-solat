import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  KeyRound,
  Layers,
  Monitor,
  PhoneOff,
  Radio,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  SlidersHorizontal,
  Smartphone,
  Tv,
  VideoOff,
  Volume2,
  Bell,
  Sparkles,
} from 'lucide-react';
import { normalizeRoomCode } from '../domain/webrtcUtils';
import { useWebRTCStream } from '../hooks/useWebRTCStream';
import { AnnouncementManagerModal } from './AnnouncementManagerModal';
import { AnnouncementService } from '../services/announcementService';
import {
  AnnouncementItem,
  OverlayDensity,
  TickerConfig,
  VideoFitMode,
  VideoFrameRatePreset,
  VideoOrientationMode,
  VideoResolutionPreset,
  VideoRotationDegrees,
} from '../types/domain';

interface MobileSenderViewProps {
  initialRoomId?: string;
  initialPairingToken?: string;
  onReturnToDisplay: () => void;
}

/**
 * Gate 11, Gate 12 & Gate 16 (SEC-LAN-001 / SEC-LAN-002) —
 * Touch-Friendly Mobile Remote Controller, Broadcast Quality Controls ("Tetapan Siaran") & Announcement Ticker Manager
 */
export const MobileSenderView: React.FC<MobileSenderViewProps> = ({
  initialRoomId,
  initialPairingToken,
  onReturnToDisplay,
}) => {
  const {
    roomId,
    setRoomId,
    pairingToken,
    setPairingToken,
    sessionExpiresAtMs,
    maxSessionExpiresAtMs,
    enrolledCreds,
    authorizationStatus,
    state,
    failureCategory,
    diagnostics,
    peerDeviceName,
    errorMessage,
    lastCommandAck,
    commandStatus,
    pendingCommandAction,
    confirmedTvView,
    confirmedTvStreaming,
    tvMediaPlaying,
    localStream,
    facingMode,
    requestPhonePairing,
    reconnectAsTrustedPhone,
    startCameraBroadcast,
    stopCameraBroadcastOnly,
    disconnectStream,
    sendRemoteControlCommand,
    fitMode,
    setFitMode,
    theatreMode,
    setTheatreMode,
    overlayDensity,
    setOverlayDensity,
    orientationMode,
    setOrientationMode,
    rotationDegrees,
    setRotationDegrees,
    switchCameraFacingMode,
    announcements,
    setAnnouncements,
    tickerConfig,
    setTickerConfig,
    targetResolution,
    setTargetResolution,
    targetFps,
    setTargetFps,
    videoQualityStats,
    applyQualityPreset,
  } = useWebRTCStream({
    role: 'sender',
    initialRoomId,
    initialPairingToken,
  });

  const [inputRoomCode, setInputRoomCode] = useState<string>(
    initialRoomId || roomId
  );
  const [inputToken, setInputToken] = useState<string>(
    initialPairingToken || pairingToken
  );
  const [showCameraConsentPanel, setShowCameraConsentPanel] =
    useState<boolean>(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] =
    useState<boolean>(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedRoom = normalizeRoomCode(inputRoomCode);
    const cleanedToken = inputToken.trim();
    if (!cleanedRoom || !cleanedToken) return;
    setRoomId(cleanedRoom);
    setPairingToken(cleanedToken);
    requestPhonePairing(cleanedRoom, cleanedToken);
  };

  const handleActivateCameraMode = () => {
    const cleanedRoom = normalizeRoomCode(inputRoomCode || roomId);
    const cleanedToken = (inputToken || pairingToken).trim();
    setShowCameraConsentPanel(false);
    startCameraBroadcast(cleanedRoom, facingMode, cleanedToken);
  };

  const handleFlipCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    const cleanedRoom = normalizeRoomCode(inputRoomCode || roomId);
    const cleanedToken = (inputToken || pairingToken).trim();
    startCameraBroadcast(cleanedRoom, nextFacing, cleanedToken);
  };

  const handleSelectResolution = (res: VideoResolutionPreset) => {
    setTargetResolution(res);
    if (hasActiveLocalCamera) {
      applyQualityPreset(res, targetFps);
    }
  };

  const handleSelectFps = (fps: VideoFrameRatePreset) => {
    setTargetFps(fps);
    if (hasActiveLocalCamera) {
      applyQualityPreset(targetResolution, fps);
    }
  };

  const handleSelectFitMode = (mode: VideoFitMode) => {
    setFitMode(mode);
    if (isDataChannelOpen) {
      sendRemoteControlCommand('SET_FIT_MODE', { fitMode: mode });
    }
  };

  const handleSelectDensity = (density: OverlayDensity) => {
    setOverlayDensity(density);
    if (isDataChannelOpen) {
      sendRemoteControlCommand('SET_OVERLAY_DENSITY', {
        overlayDensity: density,
      });
    }
  };

  const handleToggleTheatreMode = () => {
    const next = !theatreMode;
    setTheatreMode(next);
    if (isDataChannelOpen) {
      sendRemoteControlCommand('SET_THEATRE_MODE', { theatreMode: next });
    }
  };

  const handleSelectOrientation = (mode: VideoOrientationMode) => {
    setOrientationMode(mode);
    if (isDataChannelOpen) {
      sendRemoteControlCommand('SET_ORIENTATION', { orientation: mode });
    }
  };

  const handleSelectRotation = (rot: VideoRotationDegrees) => {
    setRotationDegrees(rot);
    if (isDataChannelOpen) {
      sendRemoteControlCommand('SET_ROTATION', { rotation: rot });
    }
  };

  const handleSwitchCamera = async () => {
    if (hasActiveLocalCamera) {
      await switchCameraFacingMode();
    } else {
      handleFlipCamera();
    }
  };

  const handleSaveAnnouncements = (
    nextAnnouncements: AnnouncementItem[],
    nextConfig: TickerConfig
  ) => {
    setAnnouncements(nextAnnouncements);
    setTickerConfig(nextConfig);
    AnnouncementService.saveAnnouncements(nextAnnouncements);
    AnnouncementService.saveTickerConfig(nextConfig);
    if (isDataChannelOpen) {
      sendRemoteControlCommand('SYNC_ANNOUNCEMENTS', {
        announcements: nextAnnouncements,
        tickerConfig: nextConfig,
      });
    }
  };

  const isDataChannelOpen = diagnostics.dataChannelState === 'open';
  const isCommandBusy = pendingCommandAction !== null;
  const hasActiveLocalCamera = Boolean(localStream);

  // Format remaining 30m session expiry minutes & 4h max continuous session hours
  const remainingSessionMinutes =
    sessionExpiresAtMs > Date.now()
      ? Math.max(1, Math.ceil((sessionExpiresAtMs - Date.now()) / 60000))
      : null;

  const remainingMaxSessionMinutes =
    maxSessionExpiresAtMs > Date.now()
      ? Math.max(1, Math.ceil((maxSessionExpiresAtMs - Date.now()) / 60000))
      : null;

  // Check if this phone has a valid 14-day enrolled credential for any TV
  const validEnrolledCreds = enrolledCreds.filter(
    (c) => Date.now() < c.expiresAtMs
  );
  const activeEnrolledCred =
    validEnrolledCreds.find((c) => c.roomId === roomId) ||
    validEnrolledCreds[0] ||
    null;

  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col justify-between gap-4 overflow-y-auto">
      <div className="bg-[#0A1614] border border-white/10 rounded-2xl p-4 sm:p-6 space-y-5">
        {/* Top Mobile App Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-400 shrink-0" />
              <h1 className="text-base sm:text-xl font-bold text-slate-50 truncate">
                Alat Kawalan Jauh &amp; Kamera TV (LAN)
              </h1>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Kawal mod paparan Smart TV &amp; pancarkan kamera melalui
              rangkaian Wi-Fi/LAN tempatan (SEC-LAN-001 &amp; SEC-LAN-002).
            </p>
          </div>
          <button
            type="button"
            onClick={onReturnToDisplay}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/15 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Paparan TV</span>
          </button>
        </div>

        {/* Multi-Column Responsive Layout: Left Control Deck + Right Camera & Pairing */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT COLUMN (7 Cols): Paired TV Identity, Status Telemetry & 3 Primary Touch Actions */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Paired TV Identity & Distinct Control vs Media Status Card */}
            <section
              aria-label="Status Sambungan TV dan Saluran Kawalan"
              className="bg-[#07100E] border border-white/10 rounded-2xl p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Tv className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-slate-300">Identiti TV:</span>
                  <strong
                    data-testid="paired-tv-identity"
                    className="text-white font-bold font-mono-tabular"
                  >
                    Bilik TV #{roomId}
                  </strong>
                  {peerDeviceName && (
                    <span className="text-slate-400">({peerDeviceName})</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono-tabular">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span
                    data-testid="phone-auth-status"
                    className={
                      authorizationStatus === 'AUTHORIZED'
                        ? 'text-emerald-300 font-bold'
                        : authorizationStatus === 'PENDING_TV_APPROVAL'
                        ? 'text-amber-300 font-bold'
                        : 'text-slate-300'
                    }
                  >
                    {authorizationStatus}
                  </span>
                  {remainingSessionMinutes && (
                    <span
                      title="Sesi diperbaharui automatik setiap 30 minit sehingga had 4 jam"
                      className="text-slate-400"
                    >
                      · Sesi {remainingSessionMinutes}m
                    </span>
                  )}
                  {remainingMaxSessionMinutes && (
                    <span className="text-emerald-400/80">
                      (Maks {Math.ceil(remainingMaxSessionMinutes / 60)}j)
                    </span>
                  )}
                </div>
              </div>

              {/* Explicit Distinction: Control Channel vs Video Stream Status vs Confirmed TV Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="bg-[#0A1614] border border-white/10 rounded-xl p-2.5">
                  <div className="text-slate-400">Saluran Kawalan LAN</div>
                  <div
                    data-testid="control-channel-status"
                    className={`font-bold mt-0.5 ${
                      isDataChannelOpen ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {isDataChannelOpen
                      ? 'P2P Aktif (Sedia)'
                      : authorizationStatus === 'PENDING_TV_APPROVAL'
                      ? 'Menunggu Kelulusan TV'
                      : 'Belum Tersambung'}
                  </div>
                </div>

                <div className="bg-[#0A1614] border border-white/10 rounded-xl p-2.5">
                  <div className="text-slate-400">Mod Paparan TV (Disahkan)</div>
                  <div
                    data-testid="confirmed-tv-mode"
                    className="font-bold text-amber-300 mt-0.5"
                  >
                    {confirmedTvView === 'stream'
                      ? 'Paparan Siaran Langsung'
                      : 'Paparan Waktu Solat'}
                  </div>
                </div>

                <div className="bg-[#0A1614] border border-white/10 rounded-xl p-2.5">
                  <div className="text-slate-400">Status Video Pada TV</div>
                  <div
                    data-testid="confirmed-media-status"
                    className={`font-bold mt-0.5 ${
                      tvMediaPlaying
                        ? 'text-emerald-400'
                        : hasActiveLocalCamera
                        ? 'text-amber-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {tvMediaPlaying
                      ? 'Sedang Dimainkan (Streaming)'
                      : hasActiveLocalCamera || confirmedTvStreaming
                      ? 'Menghantar Video...'
                      : 'Tiada Siaran Video'}
                  </div>
                </div>
              </div>

              {/* Command Delivery Feedback Bar */}
              {commandStatus !== 'IDLE' && (
                <div
                  data-testid="command-delivery-feedback"
                  className="pt-2 border-t border-white/10 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    {commandStatus === 'SENT' && (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                        <span className="text-amber-200">
                          Menghantar arahan ke TV ({pendingCommandAction})...
                        </span>
                      </>
                    )}
                    {commandStatus === 'ACKNOWLEDGED' && lastCommandAck && (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">
                          Disahkan oleh TV (Seq #{lastCommandAck.seq}): Mod{' '}
                          {lastCommandAck.resultingView === 'primary'
                            ? 'Waktu Solat'
                            : 'Siaran Langsung'}
                        </span>
                      </>
                    )}
                    {(commandStatus === 'REJECTED' ||
                      commandStatus === 'TIMED_OUT') && (
                      <>
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                        <span className="text-rose-300">
                          Arahan gagal ({commandStatus})
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-mono-tabular text-slate-400">
                    Seq #{diagnostics.lastCommandSeq}
                  </span>
                </div>
              )}
            </section>

            {/* SEC-LAN-002 Zero-Touch Trusted-Device Reconnect Card */}
            {activeEnrolledCred && authorizationStatus !== 'AUTHORIZED' && (
              <section
                aria-label="Sambungan Tanpa Sentuhan Peranti Dipercayai"
                data-testid="trusted-device-reconnect-card"
                className="bg-[#0B221C] border border-emerald-500/50 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-emerald-300">
                    <KeyRound className="w-4 h-4 shrink-0" />
                    <span>
                      Peranti Dipercayai Berdaftar (Tanpa Sentuhan TV)
                    </span>
                  </div>
                  <p className="text-xs text-slate-200">
                    Telefon ini telah didaftarkan untuk{' '}
                    <strong>Bilik TV #{activeEnrolledCred.roomId}</strong> (Sah{' '}
                    {Math.max(
                      1,
                      Math.ceil(
                        (activeEnrolledCred.expiresAtMs - Date.now()) /
                          (24 * 60 * 60 * 1000)
                      )
                    )}{' '}
                    hari lagi). Sambung terus menggunakan pengesahan kriptografi
                    tanpa perlu menekan butang pada TV.
                  </p>
                </div>

                <button
                  type="button"
                  data-testid="btn-zero-touch-reconnect"
                  onClick={() => reconnectAsTrustedPhone(activeEnrolledCred)}
                  className="min-h-[48px] px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl inline-flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Sambung Terus ke TV</span>
                </button>
              </section>
            )}

            {/* Waiting for First-Time TV Approval Notice */}
            {authorizationStatus === 'PENDING_TV_APPROVAL' && (
              <div
                role="status"
                data-testid="phone-waiting-tv-approval"
                className="p-4 bg-amber-950/60 border border-amber-400/60 rounded-2xl space-y-1.5 text-xs sm:text-sm text-amber-100"
              >
                <div className="font-bold text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>
                    Menunggu Kelulusan Pendaftaran Kali Pertama Pada Skrin TV
                  </span>
                </div>
                <p className="leading-relaxed">
                  Permintaan gandingan telah dihantar ke Bilik TV{' '}
                  <strong>{roomId}</strong>. Sila lihat skrin TV dan pilih{' '}
                  <strong>&ldquo;Luluskan &amp; Daftarkan (14 Hari)&rdquo;</strong>{' '}
                  (atau tekan <strong>OK / 1</strong> pada alat kawalan TV)
                  supaya sambungan seterusnya berlaku secara automatik tanpa
                  sentuhan TV.
                </p>
              </div>
            )}

            {/* Immediate Quick-Start Banner after TV Manual Approval */}
            {authorizationStatus === 'AUTHORIZED' && !hasActiveLocalCamera && (
              <section
                aria-label="Pemberitahuan Kelulusan TV & Mulakan Siaran"
                data-testid="phone-authorized-broadcast-card"
                className="p-4 bg-[#0B251E] border-2 border-emerald-400 rounded-2xl shadow-xl space-y-3"
              >
                <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm sm:text-base">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span>Pengesahan Manual Berjaya! TV Bersedia Untuk Siaran</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  Telefon anda telah diluluskan oleh TV. Untuk memaparkan video kamera dari telefon ke skrin TV sekarang, sila tekan butang di bawah untuk mengaktifkan kamera.
                </p>
                <button
                  type="button"
                  data-testid="btn-quick-start-camera"
                  onClick={handleActivateCameraMode}
                  className="min-h-[48px] w-full px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl shadow-lg inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                  <span>Mulakan Siaran Kamera Telefon Sekarang</span>
                </button>
              </section>
            )}

            {/* Error / Security / Permission Alert Banner */}
            {errorMessage && (
              <div
                role="alert"
                data-testid="sender-error-banner"
                className="p-4 bg-rose-950/70 border border-rose-500/50 rounded-2xl text-xs sm:text-sm text-rose-100 space-y-2"
              >
                <div className="font-bold text-rose-300">
                  Kategori Ralat: {failureCategory}
                </div>
                <p className="leading-relaxed">{errorMessage}</p>
                {(state === 'FAILED' ||
                  state === 'DISCONNECTED' ||
                  authorizationStatus === 'EXPIRED') && (
                  <div className="flex flex-wrap items-center gap-2">
                    {failureCategory === 'PEER_NOT_FOUND' && (
                      <button
                        type="button"
                        data-testid="btn-retry-peer-connect"
                        onClick={() =>
                          requestPhonePairing(
                            normalizeRoomCode(inputRoomCode),
                            inputToken.trim()
                          )
                        }
                        className="min-h-[44px] px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Cuba Sambung Semula ke Bilik TV</span>
                      </button>
                    )}
                    {activeEnrolledCred && (
                      <button
                        type="button"
                        onClick={() =>
                          reconnectAsTrustedPhone(activeEnrolledCred)
                        }
                        className="min-h-[44px] px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>Sambung Semula (Peranti Dipercayai)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        requestPhonePairing(
                          normalizeRoomCode(inputRoomCode),
                          inputToken.trim()
                        )
                      }
                      className="min-h-[44px] px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Cuba Gandingan Token Baharu</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. PRIMARY 3 MOBILE REMOTE CONTROL ACTIONS (Gate 11 & Gate 12)
                Minimum 48px touch targets, thumb-friendly layout */}
            <section
              aria-label="Kawalan Utama Paparan TV"
              className="bg-[#07100E] border border-white/10 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Kawalan Mod Paparan TV (P2P LAN)
                </h2>
                <span className="text-xs text-slate-400">
                  Status mengikut pengesahan TV
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Action 1: Paparan Waktu Solat */}
                <button
                  type="button"
                  data-testid="remote-btn-primary-view"
                  disabled={!isDataChannelOpen || isCommandBusy}
                  onClick={() =>
                    sendRemoteControlCommand('SWITCH_VIEW_PRIMARY')
                  }
                  className={`min-h-[56px] p-3.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer disabled:opacity-40 ${
                    confirmedTvView === 'primary' && isDataChannelOpen
                      ? 'bg-[#102822] border-amber-400 text-white'
                      : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Tv className="w-5 h-5 text-amber-400" />
                    {confirmedTvView === 'primary' && isDataChannelOpen && (
                      <span className="text-[11px] font-bold text-amber-300">
                        AKTIF DI TV
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold">
                      1. Paparan Waktu Solat
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Tukar TV ke jadual solat utama
                    </div>
                  </div>
                </button>

                {/* Action 2: Paparan Siaran Langsung */}
                <button
                  type="button"
                  data-testid="remote-btn-stream-view"
                  disabled={!isDataChannelOpen || isCommandBusy}
                  onClick={() => sendRemoteControlCommand('SWITCH_VIEW_STREAM')}
                  className={`min-h-[56px] p-3.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer disabled:opacity-40 ${
                    confirmedTvView === 'stream' &&
                    !hasActiveLocalCamera &&
                    isDataChannelOpen
                      ? 'bg-[#102822] border-amber-400 text-white'
                      : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Radio className="w-5 h-5 text-emerald-400" />
                    {confirmedTvView === 'stream' && isDataChannelOpen && (
                      <span className="text-[11px] font-bold text-emerald-300">
                        AKTIF DI TV
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold">
                      2. Paparan Siaran Langsung
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Buka skrin penerima siaran di TV
                    </div>
                  </div>
                </button>

                {/* Action 3: Mod Kamera Telefon */}
                <button
                  type="button"
                  data-testid="remote-btn-camera-mode"
                  onClick={() => {
                    if (hasActiveLocalCamera) {
                      stopCameraBroadcastOnly();
                    } else {
                      handleActivateCameraMode();
                    }
                  }}
                  className={`min-h-[56px] p-3.5 rounded-xl border text-left flex flex-col justify-between transition-colors cursor-pointer ${
                    hasActiveLocalCamera
                      ? 'bg-emerald-950/90 border-emerald-400 text-white'
                      : 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/50 text-amber-100'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Camera className="w-5 h-5 text-amber-400" />
                    <span className="text-[11px] font-bold text-amber-300">
                      {hasActiveLocalCamera ? 'KAMERA AKTIF' : 'SEDIA'}
                    </span>
                  </div>
                  <div className="mt-2">
                    <div className="text-sm font-bold text-white">
                      3. Mod Kamera Telefon
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {hasActiveLocalCamera
                        ? 'Tekan untuk henti kamera'
                        : 'Pancarkan kamera ke TV'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Secondary Session & Stream Actions */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/10">
                <div className="flex flex-wrap items-center gap-2">
                  {(hasActiveLocalCamera || confirmedTvStreaming) && (
                    <button
                      type="button"
                      data-testid="remote-btn-stop-stream"
                      onClick={stopCameraBroadcastOnly}
                      className="min-h-[44px] px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <VideoOff className="w-4 h-4" />
                      <span>Henti Siaran Kamera</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={!isDataChannelOpen || isCommandBusy}
                    onClick={() => sendRemoteControlCommand('PING_STATE')}
                    className="min-h-[44px] px-3.5 py-2 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-slate-200 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Semak Status TV</span>
                  </button>
                </div>

                {(isDataChannelOpen ||
                  authorizationStatus === 'AUTHORIZED' ||
                  authorizationStatus === 'PENDING_TV_APPROVAL') && (
                  <button
                    type="button"
                    data-testid="remote-btn-disconnect"
                    onClick={disconnectStream}
                    className="min-h-[44px] px-3.5 py-2 bg-white/10 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Putuskan Sesi Kawalan</span>
                  </button>
                )}
              </div>
            </section>

            {/* 3. TETAPAN SIARAN & KUALITI VIDEO (Gate 16 Requirement #3) */}
            <section
              aria-label="Tetapan Siaran dan Kualiti Video"
              data-testid="broadcast-settings-section"
              className="bg-[#07100E] border border-white/10 rounded-2xl p-4 space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Tetapan Siaran &amp; Kualiti Video
                  </h2>
                </div>
                <span className="text-[11px] font-mono-tabular text-emerald-300">
                  Kawalan Terus Telefon
                </span>
              </div>

              {/* Resolution Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Sasaran Peleraian Video:</span>
                  <span className="font-mono-tabular text-amber-300 text-[11px]">
                    {targetResolution.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['480p', '720p', '1080p'] as VideoResolutionPreset[]).map((res) => (
                    <button
                      key={res}
                      type="button"
                      data-testid={`quality-btn-${res}`}
                      onClick={() => handleSelectResolution(res)}
                      className={`min-h-[44px] py-2 px-3 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer text-center ${
                        targetResolution === res
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-200'
                      }`}
                    >
                      {res === '480p' && '480p SD'}
                      {res === '720p' && '720p HD'}
                      {res === '1080p' && '1080p FHD'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Frame Rate Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Kadar Bingkai (FPS):</span>
                  <span className="font-mono-tabular text-emerald-300 text-[11px]">
                    {targetFps} FPS
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {([15, 24, 30] as VideoFrameRatePreset[]).map((fps) => (
                    <button
                      key={fps}
                      type="button"
                      data-testid={`fps-btn-${fps}`}
                      onClick={() => handleSelectFps(fps)}
                      className={`min-h-[44px] py-2 px-3 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer text-center ${
                        targetFps === fps
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                          : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-200'
                      }`}
                    >
                      {fps} FPS
                    </button>
                  ))}
                </div>
              </div>

              {/* Video Fit Mode */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Nisbah Paparan Video Pada TV:</span>
                  <span className="font-mono-tabular text-amber-300 text-[11px] uppercase">
                    {fitMode}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { mode: 'contain', label: 'Nisbah Asal' },
                      { mode: 'cover', label: 'Skrin Penuh' },
                      { mode: 'blurred', label: 'Latar Kabur' },
                    ] as const
                  ).map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`fit-btn-${mode}`}
                      onClick={() => handleSelectFitMode(mode)}
                      className={`min-h-[44px] py-2 px-2.5 rounded-xl border font-bold text-xs transition-colors cursor-pointer text-center ${
                        fitMode === mode
                          ? 'bg-[#102B23] text-emerald-300 border-emerald-400 shadow-md'
                          : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation Mode: Auto (Default), Portrait, Landscape */}
              <div className="space-y-1.5 pt-1 border-t border-white/10">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Orientasi Paparan Video (TV):</span>
                  <span className="font-mono-tabular text-amber-300 text-[11px] uppercase">
                    {orientationMode === 'auto' ? 'Auto (Pengecaman)' : orientationMode}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { mode: 'auto', label: 'Auto (Kamera)' },
                      { mode: 'portrait', label: 'Potret' },
                      { mode: 'landscape', label: 'Landskap' },
                    ] as const
                  ).map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`orientation-btn-${mode}`}
                      onClick={() => handleSelectOrientation(mode)}
                      className={`min-h-[44px] py-2 px-2.5 rounded-xl border font-bold text-xs transition-colors cursor-pointer text-center ${
                        orientationMode === mode
                          ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                          : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Rotation: 0°, 90°, 180°, 270° */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold">Putaran Paparan Video (TV):</span>
                  <span className="font-mono-tabular text-emerald-300 text-[11px]">
                    {rotationDegrees}°
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {([0, 90, 180, 270] as VideoRotationDegrees[]).map((deg) => (
                    <button
                      key={deg}
                      type="button"
                      data-testid={`rotation-btn-${deg}`}
                      onClick={() => handleSelectRotation(deg)}
                      className={`min-h-[44px] py-2 px-2 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer text-center ${
                        rotationDegrees === deg
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                          : 'bg-[#0A1614] hover:bg-white/5 border-white/10 text-slate-200'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
              </div>

              {/* Front/Rear Camera Switching Button */}
              <div className="pt-1 border-t border-white/10">
                <button
                  type="button"
                  data-testid="btn-switch-camera"
                  onClick={handleSwitchCamera}
                  className="min-h-[46px] w-full px-4 py-2.5 bg-[#0D241E] hover:bg-[#123028] border border-emerald-500/50 hover:border-emerald-400 text-emerald-200 font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-4 h-4 text-emerald-400" />
                  <span>
                    Tukar Kamera ({facingMode === 'user' ? 'Kamera Belakang' : 'Kamera Depan'})
                  </span>
                </button>
              </div>

              {/* Overlay Density & Theatre Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/10">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-300">
                    Ketumpatan Lapisan Solat:
                  </span>
                  <div className="grid grid-cols-3 gap-1">
                    {(['minimal', 'compact', 'standard'] as OverlayDensity[]).map((d) => (
                      <button
                        key={d}
                        type="button"
                        data-testid={`density-btn-${d}`}
                        onClick={() => handleSelectDensity(d)}
                        className={`py-1.5 px-2 rounded-lg border text-center font-bold text-[11px] capitalize cursor-pointer transition-colors ${
                          overlayDensity === d
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {d === 'standard' && 'Standard'}
                        {d === 'compact' && 'Padat'}
                        {d === 'minimal' && 'Ringkas'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-300">
                    Mod Teater TV:
                  </span>
                  <button
                    type="button"
                    data-testid="toggle-theatre-mode"
                    onClick={handleToggleTheatreMode}
                    className={`min-h-[38px] w-full py-1.5 px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-between transition-colors cursor-pointer ${
                      theatreMode
                        ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>Mod Teater (Automatik)</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-black ${
                        theatreMode
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {theatreMode ? 'AKTIF' : 'MATI'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Actual Video Track Statistics Card */}
              {videoQualityStats && (
                <div
                  data-testid="video-track-stats-card"
                  className="bg-[#0A1614] border border-white/10 rounded-xl p-3 space-y-1.5 text-xs font-mono-tabular"
                >
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Statistik Kamera Sebenar:</span>
                    <span
                      className={
                        videoQualityStats.isActualSupported
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {videoQualityStats.isActualSupported
                        ? 'Disokong Perkakasan'
                        : 'Alternatif Selamat'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200 font-bold">
                    <span>Peleraian Dihantar:</span>
                    <span className="text-emerald-300">
                      {videoQualityStats.actualQualityLabelBM}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span>Nisbah Aspek: {videoQualityStats.aspectRatio}</span>
                    <span>Kamera: {videoQualityStats.facingMode === 'user' ? 'Hadapan' : 'Belakang'}</span>
                  </div>
                  {!videoQualityStats.isActualSupported && (
                    <div className="text-[11px] text-amber-300 pt-1 border-t border-white/10 leading-relaxed font-sans">
                      Peleraian {targetResolution} tidak disokong penuh oleh penderia kamera telefon ini; pelayar melaras secara automatik ke kualiti maksimum yang disokong ({videoQualityStats.actualQualityLabelBM}).
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 4. PENGURUSAN PENGUMUMAN & TICKER TV (Gate 16 Requirement #5) */}
            <section
              aria-label="Pengurusan Pengumuman TV"
              data-testid="announcement-manager-section"
              className="bg-[#07100E] border border-white/10 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm sm:text-base font-bold text-white">
                    Pengumuman &amp; Ticker TV (10m Jelas)
                  </h2>
                </div>
                <span className="text-[11px] font-mono-tabular text-amber-300">
                  {announcements.filter((a) => a.enabled).length} Aktif
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                Urus maklumat kuliah, adab solat dan pengumuman dewan solat yang dipaparkan pada bar ticker bawah skrin Smart TV.
              </p>

              <button
                type="button"
                data-testid="btn-open-announcement-modal"
                disabled={!isDataChannelOpen}
                onClick={() => setIsAnnouncementModalOpen(true)}
                className="min-h-[48px] w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs sm:text-sm rounded-xl inline-flex items-center justify-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>Buka Pengurus Pengumuman TV</span>
              </button>
            </section>
          </div>

          {/* RIGHT COLUMN (5 Cols): Pairing Form & On-Demand Camera Broadcaster */}
          <div className="lg:col-span-5 space-y-4">
            {/* Pairing Credential Form (Pre-filled from QR code scan) */}
            <form
              onSubmit={handlePairSubmit}
              className="bg-[#07100E] border border-white/10 rounded-2xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-100">
                  Pendaftaran / Gandingan Baharu Bilik TV
                </h2>
                <span className="text-[11px] font-mono-tabular text-emerald-300">
                  Auto-Giliran Token: 90s
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="pairing-code-input"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    Kod Bilik 6-Digit TV
                  </label>
                  <input
                    id="pairing-code-input"
                    type="text"
                    value={inputRoomCode}
                    onChange={(e) => setInputRoomCode(e.target.value)}
                    placeholder="Contoh: 849201"
                    maxLength={12}
                    className="min-h-[44px] w-full px-3.5 py-2 bg-[#060D0C] border border-white/20 rounded-xl font-mono-tabular text-base font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="pairing-token-input"
                    className="block text-xs font-semibold text-slate-300"
                  >
                    Token Keselamatan Sementara
                  </label>
                  <input
                    id="pairing-token-input"
                    type="text"
                    value={inputToken}
                    onChange={(e) => setInputToken(e.target.value)}
                    placeholder="Token dari QR..."
                    className="min-h-[44px] w-full px-3.5 py-2 bg-[#060D0C] border border-white/20 rounded-xl font-mono-tabular text-xs text-emerald-300 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                data-testid="btn-connect-controller"
                className="min-h-[48px] w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-colors cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>
                  {authorizationStatus === 'AUTHORIZED'
                    ? 'Segarkan Sambungan Kawalan LAN'
                    : 'Sambung Alat Kawalan Telefon ke TV'}
                </span>
              </button>
            </form>

            {/* Camera Permission Explanation & On-Demand Consent Box (Gate 11 Section 7) */}
            {showCameraConsentPanel && !hasActiveLocalCamera && (
              <div
                data-testid="camera-consent-explanation"
                className="bg-[#0D201B] border border-amber-400/60 rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Kebenaran Kamera &amp; Mikrofon Diperlukan</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  Untuk memancarkan siaran langsung ceramah atau pengumuman ke
                  skrin TV, pelayar telefon memerlukan kebenaran akses{' '}
                  <strong>Kamera</strong> dan <strong>Mikrofon</strong>. Video
                  dihantar secara terus melalui rangkaian Wi-Fi/LAN tempatan
                  tanpa disimpan di pelayan awan.
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    data-testid="btn-confirm-start-camera"
                    onClick={handleActivateCameraMode}
                    className="min-h-[44px] flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl px-4 py-2 transition-colors cursor-pointer"
                  >
                    Benarkan &amp; Mulakan Siaran Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCameraConsentPanel(false)}
                    className="min-h-[44px] px-3.5 py-2 bg-white/10 hover:bg-white/15 text-slate-200 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Camera Preview Viewport */}
            <div className="bg-black border border-white/15 rounded-2xl overflow-hidden aspect-video relative flex items-center justify-center">
              {localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="p-5 text-center text-slate-400 text-xs space-y-2">
                  <Camera className="w-9 h-9 mx-auto text-slate-500" />
                  <div className="font-semibold text-slate-200">
                    Kamera Telefon Tidak Aktif (Mod Alat Kawalan Sahaja)
                  </div>
                  <p className="leading-relaxed">
                    Anda boleh mengawal mod paparan TV tanpa membuka kamera.
                    Tekan <strong>&ldquo;3. Mod Kamera Telefon&rdquo;</strong>{' '}
                    apabila anda ingin memulakan siaran video langsung.
                  </p>
                </div>
              )}
            </div>

            {/* Active Camera Controls */}
            {localStream && (
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={handleFlipCamera}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>
                    Tukar Kamera (
                    {facingMode === 'environment' ? 'Belakang' : 'Hadapan'})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={stopCameraBroadcastOnly}
                  className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>Hentikan Kamera</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Announcement Manager Modal */}
      <AnnouncementManagerModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        announcements={announcements}
        tickerConfig={tickerConfig}
        onSaveAnnouncements={handleSaveAnnouncements}
      />
    </main>
  );
};
