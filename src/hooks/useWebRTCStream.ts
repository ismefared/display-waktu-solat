import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../config/appConfig';
import {
  classifyIceFailure,
  classifyMediaError,
  computeTrustedChallengeProof,
  createTestPatternStream,
  generateCryptographicToken,
  IceCandidateQueue,
  isPermittedHostOnlyCandidate,
  LanSessionGuard,
  normalizeRoomCode,
  parseIceCandidateType,
} from '../domain/webrtcUtils';
import { StorageService } from '../services/storageService';
import { AnnouncementService } from '../services/announcementService';
import {
  AnnouncementItem,
  CommandDeliveryStatus,
  EnrolledPhoneCredential,
  LanControlAckMessage,
  LanControlCommandMessage,
  LanRemoteCommandAction,
  OverlayDensity,
  PairingAuthorizationStatus,
  StreamingDiagnostics,
  StreamingFailureCategory,
  StreamingLifecycleState,
  TickerConfig,
  TrustedDeviceRecord,
  TvStateSyncMessage,
  VideoFitMode,
  VideoFrameRatePreset,
  VideoOrientationMode,
  VideoResolutionPreset,
  VideoRotationDegrees,
  VideoTrackStats,
} from '../types/domain';

const RESOLUTION_PRESETS: Record<
  VideoResolutionPreset,
  { width: number; height: number; labelBM: string }
> = {
  '480p': { width: 854, height: 480, labelBM: '480p SD' },
  '720p': { width: 1280, height: 720, labelBM: '720p HD' },
  '1080p': { width: 1920, height: 1080, labelBM: '1080p Full HD' },
};

/**
 * SEC-LAN-001, SEC-LAN-002 & Gate 12 Compliant WebRTC Live Streaming, Pairing,
 * Trusted-Device Enrollment & Local RTCDataChannel Hook
 *
 * Mandatory Policy Requirements Enforced:
 * 1. First-time trusted-device enrollment requires explicit on-TV approval (`approvePendingPairingOnTv({ enrollAsTrusted: true })`).
 * 2. Previously enrolled devices reconnect via single-use HMAC-SHA256 challenge-response without repeated on-TV approval.
 * 3. Trusted-device credentials expire after 14 days (`trustedDeviceTtlMs`).
 * 4. Active session tokens expire after 30 minutes and are renewed automatically (`RENEW_SESSION`) while active.
 * 5. Maximum continuous-session duration (4 hours) enforced before mandatory reauthentication.
 * 6. Immediate single-device (`revokeTrustedDeviceOnTv`) and all-device (`revokeAllTrustedDevicesOnTv`) revocation.
 * 7. Idle ephemeral pairing tokens rotate every 90s while the TV is idle (`AWAITING_PHONE`), never granting authorization.
 * 8. Preserves SEC-LAN-001 host-only WebRTC (`iceServers: []`), RTCDataChannel-only remote control, zero STUN/TURN, and zero WebSocket control commands.
 */

function generatePairingCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

function getOrCreatePersistentTvIdentity(): { tvId: string; roomId: string } {
  const saved = StorageService.getRawString(
    APP_CONFIG.storageKeys.tvIdentityId
  );
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { tvId?: string; roomId?: string };
      if (parsed.tvId && parsed.roomId) {
        return { tvId: parsed.tvId, roomId: parsed.roomId };
      }
    } catch {
      // Fall through
    }
  }
  const roomId = generatePairingCode();
  const tvId = `TV-${roomId}`;
  StorageService.setRawString(
    APP_CONFIG.storageKeys.tvIdentityId,
    JSON.stringify({ tvId, roomId })
  );
  return { tvId, roomId };
}

function loadTvTrustedDevices(): TrustedDeviceRecord[] {
  const raw = StorageService.getRawString(
    APP_CONFIG.storageKeys.tvTrustedDevices
  );
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTvTrustedDevices(devices: TrustedDeviceRecord[]): void {
  StorageService.setRawString(
    APP_CONFIG.storageKeys.tvTrustedDevices,
    JSON.stringify(devices)
  );
}

function loadPhoneEnrolledCredentials(): EnrolledPhoneCredential[] {
  const raw = StorageService.getRawString(
    APP_CONFIG.storageKeys.phoneEnrolledCredentials
  );
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePhoneEnrolledCredential(cred: EnrolledPhoneCredential): void {
  const existing = loadPhoneEnrolledCredentials().filter(
    (c) => c.roomId !== cred.roomId && c.deviceId !== cred.deviceId
  );
  existing.unshift(cred);
  StorageService.setRawString(
    APP_CONFIG.storageKeys.phoneEnrolledCredentials,
    JSON.stringify(existing.slice(0, 10))
  );
}

function removePhoneEnrolledCredentialForRoom(roomId: string): void {
  const remaining = loadPhoneEnrolledCredentials().filter(
    (c) => c.roomId !== roomId
  );
  StorageService.setRawString(
    APP_CONFIG.storageKeys.phoneEnrolledCredentials,
    JSON.stringify(remaining)
  );
}

export function useWebRTCStream(params: {
  role: 'display' | 'sender';
  enabled?: boolean;
  initialRoomId?: string;
  initialPairingToken?: string;
  activeTvView?: 'primary' | 'stream';
  onRemoteCommandExecuted?: (action: LanRemoteCommandAction) => void;
  onStreamEnded?: () => void;
}) {
  const initialTvIdentity = useRef(getOrCreatePersistentTvIdentity());

  const [tvId] = useState<string>(() => initialTvIdentity.current.tvId);
  const [roomId, setRoomIdState] = useState<string>(
    () =>
      normalizeRoomCode(params.initialRoomId) ||
      (params.role === 'display'
        ? initialTvIdentity.current.roomId
        : generatePairingCode())
  );
  const roomIdRef = useRef<string>(roomId);

  const [pairingToken, setPairingTokenState] = useState<string>(
    () => params.initialPairingToken || generateCryptographicToken(12)
  );
  const pairingTokenRef = useRef<string>(pairingToken);

  const [pairingExpiresAtMs, setPairingExpiresAtMs] = useState<number>(
    () => Date.now() + APP_CONFIG.webrtc.pairingTokenTtlMs
  );
  const [sessionExpiresAtMs, setSessionExpiresAtMs] = useState<number>(0);
  const [maxSessionExpiresAtMs, setMaxSessionExpiresAtMs] = useState<number>(0);

  // Display-side Trusted Device list & stateful security guard (SEC-LAN-001 & SEC-LAN-002)
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceRecord[]>(
    () => (params.role === 'display' ? loadTvTrustedDevices() : [])
  );

  const sessionGuardRef = useRef<LanSessionGuard>(
    new LanSessionGuard({
      tvId: initialTvIdentity.current.tvId,
      roomId: roomIdRef.current,
      pairingToken: pairingTokenRef.current,
      pairingTtlMs: APP_CONFIG.webrtc.pairingTokenTtlMs,
      sessionTtlMs: APP_CONFIG.webrtc.authorizedSessionTtlMs,
      maxContinuousSessionMs: APP_CONFIG.webrtc.maxContinuousSessionMs,
      trustedDeviceTtlMs: APP_CONFIG.webrtc.trustedDeviceTtlMs,
      replayWindowMs: APP_CONFIG.webrtc.commandReplayWindowMs,
      initialTrustedDevices:
        params.role === 'display' ? loadTvTrustedDevices() : [],
    })
  );

  // Sender-side enrolled credentials & issued sessionToken
  const [enrolledCreds, setEnrolledCreds] = useState<EnrolledPhoneCredential[]>(
    () => (params.role === 'sender' ? loadPhoneEnrolledCredentials() : [])
  );
  const senderSessionTokenRef = useRef<string | null>(null);
  const commandSeqRef = useRef<number>(0);

  const [authorizationStatus, setAuthorizationStatus] =
    useState<PairingAuthorizationStatus>('AWAITING_PHONE');
  const [state, setState] = useState<StreamingLifecycleState>('INITIALIZING');
  const [failureCategory, setFailureCategory] =
    useState<StreamingFailureCategory>('NONE');
  const [peerDeviceName, setPeerDeviceName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gate 11 / Gate 12 Command & TV Confirmed State Tracking
  const [lastCommandAck, setLastCommandAck] =
    useState<LanControlAckMessage | null>(null);
  const [commandStatus, setCommandStatus] =
    useState<CommandDeliveryStatus>('IDLE');
  const [pendingCommandAction, setPendingCommandAction] =
    useState<LanRemoteCommandAction | null>(null);
  const [confirmedTvView, setConfirmedTvView] = useState<'primary' | 'stream'>(
    params.activeTvView || 'primary'
  );
  const [confirmedTvStreaming, setConfirmedTvStreaming] =
    useState<boolean>(false);
  const [tvMediaPlaying, setTvMediaPlaying] = useState<boolean>(false);
  const tvMediaPlayingRef = useRef<boolean>(false);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );

  // Gate 16 Immersive Broadcast, Video Quality & Ticker States
  const [fitMode, setFitModeState] = useState<VideoFitMode>(() => {
    const saved = StorageService.getRawString(APP_CONFIG.storageKeys.fitMode);
    return (saved as VideoFitMode) || 'blurred';
  });
  const [theatreMode, setTheatreModeState] = useState<boolean>(() => {
    const saved = StorageService.getRawString(
      APP_CONFIG.storageKeys.theatreMode
    );
    return saved !== null ? saved === 'true' : true;
  });
  const [overlayDensity, setOverlayDensityState] =
    useState<OverlayDensity>(() => {
      const saved = StorageService.getRawString(
        APP_CONFIG.storageKeys.overlayDensity
      );
      return (saved as OverlayDensity) || 'standard';
    });
  const [orientationMode, setOrientationModeState] =
    useState<VideoOrientationMode>('auto');
  const [rotationDegrees, setRotationDegreesState] =
    useState<VideoRotationDegrees>(0);
  const [announcements, setAnnouncementsState] = useState<
    AnnouncementItem[]
  >(() => AnnouncementService.loadAnnouncements());
  const [tickerConfig, setTickerConfigState] = useState<TickerConfig>(() =>
    AnnouncementService.loadTickerConfig()
  );
  const [targetResolution, setTargetResolution] =
    useState<VideoResolutionPreset>('720p');
  const [targetFps, setTargetFps] = useState<VideoFrameRatePreset>(30);
  const [videoQualityStats, setVideoQualityStats] =
    useState<VideoTrackStats | null>(null);

  const setFitMode = useCallback((mode: VideoFitMode) => {
    setFitModeState(mode);
    StorageService.setRawString(APP_CONFIG.storageKeys.fitMode, mode);
  }, []);

  const setTheatreMode = useCallback((active: boolean) => {
    setTheatreModeState(active);
    StorageService.setRawString(
      APP_CONFIG.storageKeys.theatreMode,
      String(active)
    );
  }, []);

  const setOverlayDensity = useCallback((density: OverlayDensity) => {
    setOverlayDensityState(density);
    StorageService.setRawString(APP_CONFIG.storageKeys.overlayDensity, density);
  }, []);

  const setOrientationMode = useCallback((mode: VideoOrientationMode) => {
    setOrientationModeState(mode);
  }, []);

  const setRotationDegrees = useCallback((deg: VideoRotationDegrees) => {
    setRotationDegreesState(deg);
  }, []);

  const setAnnouncements = useCallback((items: AnnouncementItem[]) => {
    setAnnouncementsState(items);
    AnnouncementService.saveAnnouncements(items);
  }, []);

  const setTickerConfig = useCallback((cfg: TickerConfig) => {
    setTickerConfigState(cfg);
    AnnouncementService.saveTickerConfig(cfg);
  }, []);

  const applyQualityPreset = useCallback(
    async (
      targetRes: VideoResolutionPreset,
      targetFpsVal: VideoFrameRatePreset
    ) => {
      setTargetResolution(targetRes);
      setTargetFps(targetFpsVal);

      const stream = localStreamRef.current;
      const videoTrack = stream
        ?.getVideoTracks()
        .find((t) => t.readyState === 'live');
      const targetDim =
        RESOLUTION_PRESETS[targetRes] || RESOLUTION_PRESETS['720p'];

      if (videoTrack) {
        try {
          await videoTrack.applyConstraints({
            width: { ideal: targetDim.width },
            height: { ideal: targetDim.height },
            frameRate: { ideal: targetFpsVal },
          });
        } catch {
          // Fall back gracefully if applyConstraints rejected
        }

        const settings = videoTrack.getSettings();
        const actualW = settings.width || targetDim.width;
        const actualH = settings.height || targetDim.height;
        const actualFps = Math.round(settings.frameRate || targetFpsVal);
        const actualAspect =
          actualH > 0 ? Number((actualW / actualH).toFixed(2)) : 1.78;
        const isActualSupported = actualW >= targetDim.width * 0.8;

        const stats: VideoTrackStats = {
          width: actualW,
          height: actualH,
          frameRate: actualFps,
          aspectRatio: actualAspect,
          facingMode: settings.facingMode || facingMode,
          targetResolution: targetRes,
          targetFps: targetFpsVal,
          isActualSupported,
          actualQualityLabelBM: `${actualW}x${actualH} @ ${actualFps}fps`,
        };
        setVideoQualityStats(stats);
      }
    },
    [facingMode]
  );

  const activeTvViewRef = useRef<'primary' | 'stream'>(
    params.activeTvView || 'primary'
  );
  useEffect(() => {
    if (params.activeTvView) {
      activeTvViewRef.current = params.activeTvView;
    }
  }, [params.activeTvView]);

  const setRoomId = useCallback((nextId: string) => {
    const clean = normalizeRoomCode(nextId);
    roomIdRef.current = clean;
    setRoomIdState(clean);
  }, []);

  const setPairingToken = useCallback((nextToken: string) => {
    pairingTokenRef.current = nextToken;
    setPairingTokenState(nextToken);
  }, []);

  const syncTrustedDevicesToStorage = useCallback(() => {
    if (params.role !== 'display') return;
    const list = sessionGuardRef.current.getTrustedDevices();
    setTrustedDevices(list);
    saveTvTrustedDevices(list);
  }, [params.role]);

  const [diagnostics, setDiagnostics] = useState<StreamingDiagnostics>(() => ({
    signalingConnected: false,
    roomId,
    role: params.role,
    hasDisplayPeer: params.role === 'display',
    hasSenderPeer: params.role === 'sender',
    sdpOfferSentOrReceived: false,
    sdpAnswerSentOrReceived: false,
    iceGatheringState: 'new',
    iceConnectionState: 'new',
    peerConnectionState: 'new',
    dataChannelState: 'closed',
    authorizationStatus: 'AWAITING_PHONE',
    localCandidateTypes: [],
    remoteCandidateTypes: [],
    rejectedNonHostCandidates: 0,
    queuedCandidatesFlushed: 0,
    localTrackCount: 0,
    remoteTrackCount: 0,
    lastCommandSeq: 0,
    failureCategory: 'NONE',
    lastStageTimestamp: new Date().toISOString(),
  }));

  const updateDiagnostics = useCallback(
    (patch: Partial<StreamingDiagnostics>) => {
      setDiagnostics((prev) => ({
        ...prev,
        ...patch,
        lastStageTimestamp: new Date().toISOString(),
      }));
    },
    []
  );

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const candidateQueueRef = useRef<IceCandidateQueue>(new IceCandidateQueue());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const negotiationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const isConnectingRef = useRef<boolean>(false);
  const authorizationStatusRef =
    useRef<PairingAuthorizationStatus>(authorizationStatus);
  useEffect(() => {
    authorizationStatusRef.current = authorizationStatus;
  }, [authorizationStatus]);

  const isMountedRef = useRef<boolean>(true);
  const peerNotFoundRetryCountRef = useRef<number>(0);
  const signallingReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientPingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queuedCommandRef = useRef<LanRemoteCommandAction | null>(null);
  const hasAutoActivatedStreamRef = useRef<boolean>(false);
  const sendRemoteControlCommandRef = useRef<
    (action: LanRemoteCommandAction) => boolean
  >(() => false);

  const clearNegotiationTimers = useCallback(() => {
    if (negotiationTimerRef.current) {
      clearTimeout(negotiationTimerRef.current);
      negotiationTimerRef.current = null;
    }
  }, []);

  const clearCommandTimer = useCallback(() => {
    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    clearNegotiationTimers();
    clearCommandTimer();
    // Note: candidateQueueRef is preserved here and drained by flushQueuedCandidates to prevent dropping host ICE candidates during negotiation
    if (dataChannelRef.current) {
      try {
        dataChannelRef.current.onmessage = null;
        dataChannelRef.current.onopen = null;
        dataChannelRef.current.onclose = null;
        dataChannelRef.current.close();
      } catch {
        // Ignore
      }
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.onicecandidate = null;
        pcRef.current.onicegatheringstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.ontrack = null;
        pcRef.current.ondatachannel = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.close();
      } catch {
        // Ignore close errors
      }
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    setRemoteStream(null);
    tvMediaPlayingRef.current = false;
    setTvMediaPlaying(false);
    setConfirmedTvStreaming(false);
    setPendingCommandAction(null);
    updateDiagnostics({ dataChannelState: 'closed', remoteTrackCount: 0 });
  }, [clearCommandTimer, clearNegotiationTimers, updateDiagnostics]);

  const stopLocalMedia = useCallback(() => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignore
        }
      }
      localStreamRef.current = null;
    }
    setLocalStream(null);
    updateDiagnostics({ localTrackCount: 0 });
  }, [updateDiagnostics]);

  const sendSignal = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }, []);

  const broadcastTvStateOverDataChannel = useCallback(
    (overridePatch?: {
      activeView?: 'primary' | 'stream';
      streamingActive?: boolean;
      mediaPlayingOnTv?: boolean;
    }) => {
      if (params.role !== 'display') return;
      const dc = dataChannelRef.current;
      if (!dc || dc.readyState !== 'open') return;

      const guardState = sessionGuardRef.current.getState();
      const syncMsg: TvStateSyncMessage = {
        type: 'tv-state-sync',
        roomId: roomIdRef.current,
        activeView: overridePatch?.activeView ?? activeTvViewRef.current,
        streamingActive:
          overridePatch?.streamingActive ?? Boolean(remoteStreamRef.current),
        mediaPlayingOnTv:
          overridePatch?.mediaPlayingOnTv ?? tvMediaPlayingRef.current,
        sessionExpiresAtMs: guardState.sessionExpiresAtMs,
        maxSessionExpiresAtMs: guardState.maxSessionExpiresAtMs,
        isTrustedSession: Boolean(guardState.activeTrustedDeviceId),
        timestampMs: Date.now(),
        fitMode,
        theatreMode,
        overlayDensity,
        orientationMode,
        rotationDegrees,
        announcements,
        tickerConfig,
      };
      try {
        dc.send(JSON.stringify(syncMsg));
      } catch {
        // Ignore send error
      }
    },
    [
      announcements,
      fitMode,
      orientationMode,
      overlayDensity,
      params.role,
      rotationDegrees,
      theatreMode,
      tickerConfig,
    ]
  );

  useEffect(() => {
    if (params.role === 'display' && params.activeTvView) {
      activeTvViewRef.current = params.activeTvView;
      broadcastTvStateOverDataChannel({ activeView: params.activeTvView });
    }
  }, [broadcastTvStateOverDataChannel, params.activeTvView, params.role]);

  const notifyTvVideoPlaying = useCallback(
    (isPlaying: boolean) => {
      tvMediaPlayingRef.current = isPlaying;
      setTvMediaPlaying(isPlaying);
      if (params.role === 'display') {
        if (isPlaying) {
          setState('STREAMING');
        } else if (activeTvViewRef.current === 'stream') {
          setState('WAITING_FOR_STREAM');
        }
        broadcastTvStateOverDataChannel({
          streamingActive: isPlaying || Boolean(remoteStreamRef.current),
          mediaPlayingOnTv: isPlaying,
        });
      }
    },
    [broadcastTvStateOverDataChannel, params.role]
  );

  const flushQueuedCandidates = useCallback(
    async (pc: RTCPeerConnection) => {
      if (!pc.remoteDescription) return;
      const queued = candidateQueueRef.current.drain();
      if (queued.length === 0) return;

      let flushedCount = 0;
      for (const cand of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
          flushedCount++;
        } catch {
          // Ignore individual candidate error
        }
      }
      if (flushedCount > 0) {
        setDiagnostics((prev) => ({
          ...prev,
          queuedCandidatesFlushed: prev.queuedCandidatesFlushed + flushedCount,
        }));
      }
    },
    []
  );

  const attachDataChannelHandlers = useCallback(
    (dc: RTCDataChannel) => {
      dataChannelRef.current = dc;
      updateDiagnostics({ dataChannelState: dc.readyState });

      dc.onopen = () => {
        updateDiagnostics({ dataChannelState: 'open' });
        if (params.role === 'display') {
          broadcastTvStateOverDataChannel();
        } else if (params.role === 'sender') {
          if (
            authorizationStatusRef.current === 'AUTHORIZED' &&
            senderSessionTokenRef.current
          ) {
            if (queuedCommandRef.current) {
              const pending = queuedCommandRef.current;
              queuedCommandRef.current = null;
              sendRemoteControlCommandRef.current(pending);
            } else if (
              !hasAutoActivatedStreamRef.current &&
              params.role === 'sender'
            ) {
              hasAutoActivatedStreamRef.current = true;
              sendRemoteControlCommandRef.current('SWITCH_VIEW_STREAM');
            }
          }
        }
      };

      dc.onclose = () => {
        updateDiagnostics({ dataChannelState: 'closed' });
        setPendingCommandAction(null);
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(String(event.data));
          if (!msg || typeof msg.type !== 'string') return;

          if (msg.type === 'lan-control-command' && params.role === 'display') {
            const cmd = msg as LanControlCommandMessage;
            const validation = sessionGuardRef.current.validateCommand(cmd);
            const guardState = sessionGuardRef.current.getState();

            if (!validation.accepted) {
              setFailureCategory(validation.failureCategory);
              setErrorMessage(validation.reasonBM);
              setAuthorizationStatus(guardState.status);
              updateDiagnostics({
                authorizationStatus: guardState.status,
                failureCategory: validation.failureCategory,
              });

              const nack: LanControlAckMessage = {
                type: 'lan-control-ack',
                roomId: roomIdRef.current,
                seq: cmd.seq,
                action: cmd.action,
                accepted: false,
                reason: validation.reasonBM,
                resultingView: activeTvViewRef.current,
                streamingActive: Boolean(remoteStreamRef.current),
                mediaPlayingOnTv: tvMediaPlayingRef.current,
                sessionExpiresAtMs: guardState.sessionExpiresAtMs,
                maxSessionExpiresAtMs: guardState.maxSessionExpiresAtMs,
                timestampMs: Date.now(),
              };
              if (dc.readyState === 'open') {
                dc.send(JSON.stringify(nack));
              }
              return;
            }

            updateDiagnostics({ lastCommandSeq: cmd.seq });
            setSessionExpiresAtMs(guardState.sessionExpiresAtMs);
            setMaxSessionExpiresAtMs(guardState.maxSessionExpiresAtMs);

            let nextView: 'primary' | 'stream' = activeTvViewRef.current;
            if (
              cmd.action === 'SWITCH_VIEW_PRIMARY' ||
              cmd.action === 'STOP_STREAM'
            ) {
              nextView = 'primary';
            } else if (
              cmd.action === 'SWITCH_VIEW_STREAM' ||
              cmd.action === 'START_STREAM'
            ) {
              nextView = 'stream';
            }

            if (cmd.action === 'STOP_STREAM') {
              remoteStreamRef.current = null;
              setRemoteStream(null);
              tvMediaPlayingRef.current = false;
              setTvMediaPlaying(false);
              setState('RETURNING_TO_PRAYER_DISPLAY');
              updateDiagnostics({ remoteTrackCount: 0 });
              if (params.onStreamEnded) {
                params.onStreamEnded();
              }
            } else if (
              cmd.action === 'SWITCH_VIEW_STREAM' ||
              cmd.action === 'START_STREAM'
            ) {
              if (remoteStreamRef.current || tvMediaPlayingRef.current) {
                setState('STREAMING');
              } else {
                setState('WAITING_FOR_STREAM');
              }
            } else if (cmd.action === 'SWITCH_VIEW_PRIMARY') {
              setState('CONNECTED');
            } else if (cmd.action === 'SET_FIT_MODE') {
              const newFit =
                (cmd.payload?.fitMode as VideoFitMode) || 'blurred';
              setFitMode(newFit);
            } else if (cmd.action === 'SET_THEATRE_MODE') {
              const newTheatre = cmd.payload?.theatreMode !== false;
              setTheatreMode(newTheatre);
            } else if (cmd.action === 'SET_OVERLAY_DENSITY') {
              const newDensity =
                (cmd.payload?.overlayDensity as OverlayDensity) || 'standard';
              setOverlayDensity(newDensity);
            } else if (cmd.action === 'SET_ORIENTATION') {
              const newOrient =
                (cmd.payload?.orientation as VideoOrientationMode) || 'auto';
              setOrientationModeState(newOrient);
            } else if (cmd.action === 'SET_ROTATION') {
              const newRot =
                (cmd.payload?.rotation as VideoRotationDegrees) ?? 0;
              setRotationDegreesState(newRot);
            } else if (cmd.action === 'SYNC_ANNOUNCEMENTS') {
              if (Array.isArray(cmd.payload?.announcements)) {
                const nextAnn = cmd.payload.announcements as AnnouncementItem[];
                setAnnouncements(nextAnn);
                AnnouncementService.saveAnnouncements(nextAnn);
              }
              if (cmd.payload?.tickerConfig) {
                const nextCfg = cmd.payload.tickerConfig as TickerConfig;
                setTickerConfig(nextCfg);
                AnnouncementService.saveTickerConfig(nextCfg);
              }
            }

            activeTvViewRef.current = nextView;
            if (
              params.onRemoteCommandExecuted &&
              cmd.action !== 'RENEW_SESSION'
            ) {
              params.onRemoteCommandExecuted(cmd.action);
            }

            const isStreamingNow =
              cmd.action === 'STOP_STREAM'
                ? false
                : (tvMediaPlayingRef.current || Boolean(remoteStreamRef.current));

            const ack: LanControlAckMessage = {
              type: 'lan-control-ack',
              roomId: roomIdRef.current,
              seq: cmd.seq,
              action: cmd.action,
              accepted: true,
              resultingView: nextView,
              streamingActive: isStreamingNow,
              mediaPlayingOnTv:
                cmd.action === 'STOP_STREAM'
                  ? false
                  : tvMediaPlayingRef.current,
              sessionExpiresAtMs: guardState.sessionExpiresAtMs,
              maxSessionExpiresAtMs: guardState.maxSessionExpiresAtMs,
              timestampMs: Date.now(),
              fitMode,
              theatreMode,
              overlayDensity,
              orientationMode,
              rotationDegrees,
              announcements,
            };
            if (dc.readyState === 'open') {
              dc.send(JSON.stringify(ack));
            }
          } else if (
            msg.type === 'lan-control-ack' &&
            params.role === 'sender'
          ) {
            clearCommandTimer();
            setPendingCommandAction(null);
            const ack = msg as LanControlAckMessage;
            setLastCommandAck(ack);
            setConfirmedTvView(ack.resultingView);
            setConfirmedTvStreaming(Boolean(ack.streamingActive));
            if (ack.fitMode) setFitModeState(ack.fitMode);
            if (typeof ack.theatreMode === 'boolean')
              setTheatreModeState(ack.theatreMode);
            if (ack.overlayDensity) setOverlayDensityState(ack.overlayDensity);
            if (ack.orientationMode) setOrientationModeState(ack.orientationMode);
            if (typeof ack.rotationDegrees === 'number')
              setRotationDegreesState(ack.rotationDegrees);
            if (Array.isArray(ack.announcements))
              setAnnouncementsState(ack.announcements);
            if (typeof ack.mediaPlayingOnTv === 'boolean') {
              setTvMediaPlaying(ack.mediaPlayingOnTv);
              if (ack.mediaPlayingOnTv) {
                setState('STREAMING');
              } else if (ack.resultingView === 'stream') {
                setState((prev) =>
                  prev === 'STREAMING' || prev === 'CONNECTED'
                    ? 'WAITING_FOR_STREAM'
                    : prev
                );
              } else if (!ack.streamingActive) {
                setState((prev) =>
                  prev === 'STREAMING' ? 'CONNECTED' : prev
                );
              }
            }
            if (typeof ack.sessionExpiresAtMs === 'number') {
              setSessionExpiresAtMs(ack.sessionExpiresAtMs);
            }
            if (typeof ack.maxSessionExpiresAtMs === 'number') {
              setMaxSessionExpiresAtMs(ack.maxSessionExpiresAtMs);
            }
            if (ack.accepted) {
              setCommandStatus('ACKNOWLEDGED');
              setErrorMessage(null);
            } else {
              setCommandStatus('REJECTED');
              if (ack.reason) {
                setErrorMessage(ack.reason);
              }
            }
          } else if (msg.type === 'tv-state-sync' && params.role === 'sender') {
            const sync = msg as TvStateSyncMessage;
            setConfirmedTvView(sync.activeView);
            setConfirmedTvStreaming(sync.streamingActive);
            setTvMediaPlaying(sync.mediaPlayingOnTv);
            if (sync.sessionExpiresAtMs) {
              setSessionExpiresAtMs(sync.sessionExpiresAtMs);
            }
            if (sync.maxSessionExpiresAtMs) {
              setMaxSessionExpiresAtMs(sync.maxSessionExpiresAtMs);
            }
            if (sync.fitMode) setFitModeState(sync.fitMode);
            if (typeof sync.theatreMode === 'boolean')
              setTheatreModeState(sync.theatreMode);
            if (sync.overlayDensity) setOverlayDensityState(sync.overlayDensity);
            if (sync.orientationMode) setOrientationModeState(sync.orientationMode);
            if (typeof sync.rotationDegrees === 'number')
              setRotationDegreesState(sync.rotationDegrees);
            if (Array.isArray(sync.announcements))
              setAnnouncementsState(sync.announcements);
            if (sync.tickerConfig) setTickerConfigState(sync.tickerConfig);
            if (sync.mediaPlayingOnTv) {
              setState('STREAMING');
            } else if (!sync.streamingActive) {
              setState((prev) => (prev === 'STREAMING' ? 'CONNECTED' : prev));
            }
          }
        } catch {
          // Ignore malformed data channel frame
        }
      };
    },
    [
      announcements,
      broadcastTvStateOverDataChannel,
      clearCommandTimer,
      fitMode,
      orientationMode,
      overlayDensity,
      params,
      rotationDegrees,
      setAnnouncements,
      setFitMode,
      setOverlayDensity,
      setTheatreMode,
      setTickerConfig,
      theatreMode,
      updateDiagnostics,
    ]
  );

  const sendRemoteControlCommand = useCallback(
    (
      action: LanRemoteCommandAction,
      payload?: Record<string, unknown>
    ): boolean => {
      const dc = dataChannelRef.current;
      const sessionToken = senderSessionTokenRef.current;

      if (!dc || dc.readyState !== 'open' || !sessionToken) {
        // If phone is authorized or pending approval, queue the action to dispatch as soon as data channel opens
        if (
          authorizationStatusRef.current === 'AUTHORIZED' ||
          authorizationStatusRef.current === 'PENDING_TV_APPROVAL'
        ) {
          queuedCommandRef.current = action;
          setPendingCommandAction(action);
          setCommandStatus('SENT');
          return true;
        }

        setCommandStatus('REJECTED');
        setErrorMessage(
          'Saluran kawalan LAN P2P (RTCDataChannel) belum aktif atau belum diluluskan oleh TV.'
        );
        return false;
      }

      if (pendingCommandAction !== null) {
        return false;
      }

      commandSeqRef.current += 1;
      const currentSeq = commandSeqRef.current;
      const cmd: LanControlCommandMessage = {
        type: 'lan-control-command',
        roomId: roomIdRef.current,
        sessionToken,
        action,
        seq: currentSeq,
        timestampMs: Date.now(),
        senderDeviceName: 'Telefon Pintar (Kawalan LAN)',
        payload,
      };

      setPendingCommandAction(action);
      setCommandStatus('SENT');
      setErrorMessage(null);

      try {
        dc.send(JSON.stringify(cmd));
        updateDiagnostics({ lastCommandSeq: cmd.seq });
      } catch {
        setPendingCommandAction(null);
        setCommandStatus('REJECTED');
        setErrorMessage(
          'Gagal menghantar arahan melalui saluran data P2P tempatan.'
        );
        return false;
      }

      clearCommandTimer();
      commandTimeoutRef.current = setTimeout(() => {
        setPendingCommandAction((pending) => {
          if (pending === action) {
            setCommandStatus('TIMED_OUT');
            setFailureCategory('CONNECTION_TIMED_OUT');
            setErrorMessage(
              `Arahan "${action}" tamat masa tanpa pengesahan daripada TV (Command Timed Out). Sila semak sambungan Wi-Fi tempatan.`
            );
            return null;
          }
          return pending;
        });
      }, 4500);

      return true;
    },
    [clearCommandTimer, pendingCommandAction, updateDiagnostics]
  );

  sendRemoteControlCommandRef.current = sendRemoteControlCommand;
  useEffect(() => {
    sendRemoteControlCommandRef.current = sendRemoteControlCommand;
  }, [sendRemoteControlCommand]);

  const createPeerConnection = useCallback(
    (activeRoomId: string) => {
      cleanupPeerConnection();

      const pc = new RTCPeerConnection({
        iceServers: [],
      });
      pcRef.current = pc;

      updateDiagnostics({
        iceGatheringState: pc.iceGatheringState,
        iceConnectionState: pc.iceConnectionState,
        peerConnectionState: pc.connectionState,
        localCandidateTypes: [],
        remoteCandidateTypes: [],
      });

      if (params.role === 'sender') {
        const dc = pc.createDataChannel(APP_CONFIG.webrtc.dataChannelLabel, {
          ordered: true,
        });
        attachDataChannelHandlers(dc);
      } else {
        pc.ondatachannel = (event) => {
          if (event.channel.label === APP_CONFIG.webrtc.dataChannelLabel) {
            attachDataChannelHandlers(event.channel);
          }
        };
      }

      pc.onicegatheringstatechange = () => {
        updateDiagnostics({ iceGatheringState: pc.iceGatheringState });
        if (pc.iceGatheringState === 'gathering') {
          setState((prev) =>
            prev === 'STREAMING' || prev === 'CONNECTED' ? prev : 'GATHERING_ICE'
          );
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candStr = event.candidate.candidate;
          const cType = parseIceCandidateType(candStr);

          if (!isPermittedHostOnlyCandidate(candStr)) {
            setDiagnostics((prev) => ({
              ...prev,
              rejectedNonHostCandidates: prev.rejectedNonHostCandidates + 1,
            }));
            return;
          }

          setDiagnostics((prev) => ({
            ...prev,
            localCandidateTypes: Array.from(
              new Set([...prev.localCandidateTypes, cType])
            ),
          }));

          sendSignal({
            type: 'webrtc-ice-candidate',
            roomId: activeRoomId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        clearNegotiationTimers();
        let inboundStream: MediaStream;
        if (event.streams && event.streams[0]) {
          inboundStream = event.streams[0];
        } else if (remoteStreamRef.current) {
          if (
            !remoteStreamRef.current
              .getTracks()
              .some((t) => t.id === event.track.id)
          ) {
            remoteStreamRef.current.addTrack(event.track);
          }
          inboundStream = remoteStreamRef.current;
        } else {
          inboundStream = new MediaStream([event.track]);
        }

        remoteStreamRef.current = inboundStream;
        setRemoteStream(new MediaStream(inboundStream.getTracks()));
        setState('STREAMING');
        activeTvViewRef.current = 'stream';
        tvMediaPlayingRef.current = true;
        setTvMediaPlaying(true);
        setFailureCategory('NONE');
        setErrorMessage(null);
        updateDiagnostics({
          remoteTrackCount: inboundStream.getTracks().length,
          failureCategory: 'NONE',
        });

        if (params.onRemoteCommandExecuted) {
          params.onRemoteCommandExecuted('SWITCH_VIEW_STREAM');
        }

        // Gate 13: Detect when remote camera track ends
        event.track.onended = () => {
          const liveTracks = inboundStream
            .getVideoTracks()
            .filter((t) => t.readyState === 'live');
          if (liveTracks.length === 0) {
            remoteStreamRef.current = null;
            setRemoteStream(null);
            tvMediaPlayingRef.current = false;
            setTvMediaPlaying(false);
            setState('RETURNING_TO_PRAYER_DISPLAY');
            activeTvViewRef.current = 'primary';
            if (params.onStreamEnded) {
              params.onStreamEnded();
            } else if (params.onRemoteCommandExecuted) {
              params.onRemoteCommandExecuted('STOP_STREAM');
            }
          }
        };
      };

      pc.oniceconnectionstatechange = () => {
        const iceState = pc.iceConnectionState;
        updateDiagnostics({ iceConnectionState: iceState });

        if (iceState === 'checking') {
          setState((prev) => (prev === 'STREAMING' ? 'STREAMING' : 'CONNECTING'));
        } else if (iceState === 'connected' || iceState === 'completed') {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          clearNegotiationTimers();
          setFailureCategory('NONE');
          setErrorMessage(null);
          setState((prev) =>
            prev === 'STREAMING' || Boolean(remoteStreamRef.current)
              ? 'STREAMING'
              : 'CONNECTED'
          );
        } else if (iceState === 'disconnected') {
          setState('RECONNECTING');
          setErrorMessage(
            'Sambungan LAN terputus sementara (Connection Interrupted). Mengesahkan semula laluan tempatan...'
          );
          // Gate 13: Bounded 10-second recovery timeout before returning to main prayer display
          if (!reconnectTimerRef.current) {
            reconnectTimerRef.current = setTimeout(() => {
              reconnectTimerRef.current = null;
              if (params.role === 'display') {
                remoteStreamRef.current = null;
                setRemoteStream(null);
                tvMediaPlayingRef.current = false;
                setTvMediaPlaying(false);
                cleanupPeerConnection();
                setState('RETURNING_TO_PRAYER_DISPLAY');
                activeTvViewRef.current = 'primary';
                if (params.onStreamEnded) {
                  params.onStreamEnded();
                } else if (params.onRemoteCommandExecuted) {
                  params.onRemoteCommandExecuted('STOP_STREAM');
                }
              }
            }, 10000);
          }
        } else if (iceState === 'failed') {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          setDiagnostics((prev) => {
            const classification = classifyIceFailure({
              localCandidateTypes: prev.localCandidateTypes,
              remoteCandidateTypes: prev.remoteCandidateTypes,
              sdpOfferCompleted: prev.sdpOfferSentOrReceived,
              sdpAnswerCompleted: prev.sdpAnswerSentOrReceived,
            });
            setFailureCategory(classification.category);
            setErrorMessage(classification.messageBM);
            setState('FAILED');
            return {
              ...prev,
              failureCategory: classification.category,
            };
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const connState = pc.connectionState;
        updateDiagnostics({ peerConnectionState: connState });

        if (connState === 'connecting') {
          setState((prev) => (prev === 'STREAMING' ? 'STREAMING' : 'CONNECTING'));
        } else if (connState === 'connected') {
          clearNegotiationTimers();
          setFailureCategory('NONE');
          setErrorMessage(null);
          setState((prev) => (prev === 'STREAMING' ? 'STREAMING' : 'CONNECTED'));
        } else if (connState === 'closed') {
          setState('CLOSED');
        }
      };

      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        for (const track of tracks) {
          pc.addTrack(track, localStreamRef.current);
        }
        updateDiagnostics({ localTrackCount: tracks.length });
      }

      return pc;
    },
    [
      attachDataChannelHandlers,
      cleanupPeerConnection,
      clearNegotiationTimers,
      params.role,
      sendSignal,
      updateDiagnostics,
    ]
  );

  const sendOfferFromSender = useCallback(
    async (targetRoomId: string) => {
      setState('NEGOTIATING');
      let pc = pcRef.current;
      if (!pc || pc.signalingState === 'closed' || pc.signalingState !== 'stable') {
        pc = createPeerConnection(targetRoomId);
      } else if (localStreamRef.current) {
        const currentSenders = pc.getSenders();
        const existingTrackIds = new Set(
          currentSenders.map((s) => s.track?.id).filter(Boolean)
        );
        for (const track of localStreamRef.current.getTracks()) {
          if (!existingTrackIds.has(track.id)) {
            const sameKindSender = currentSenders.find(
              (s) => s.track?.kind === track.kind
            );
            if (sameKindSender && typeof sameKindSender.replaceTrack === 'function') {
              await sameKindSender.replaceTrack(track).catch(() => {});
            } else {
              try {
                pc.addTrack(track, localStreamRef.current);
              } catch {
                // Ignore duplicate track
              }
            }
          }
        }
        updateDiagnostics({
          localTrackCount: localStreamRef.current.getTracks().length,
        });
      }

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await pc.setLocalDescription(offer);
        updateDiagnostics({ sdpOfferSentOrReceived: true });

        sendSignal({
          type: 'webrtc-offer',
          roomId: targetRoomId,
          sdp: pc.localDescription,
        });
      } catch {
        // Fallback: Recreate clean peer connection if negotiation glare or state mismatch occurred
        const freshPc = createPeerConnection(targetRoomId);
        const offer = await freshPc.createOffer({
          offerToReceiveAudio: false,
          offerToReceiveVideo: false,
        });
        await freshPc.setLocalDescription(offer);
        updateDiagnostics({ sdpOfferSentOrReceived: true });
        sendSignal({
          type: 'webrtc-offer',
          roomId: targetRoomId,
          sdp: freshPc.localDescription,
        });
        pc = freshPc;
      }

      clearNegotiationTimers();
      negotiationTimerRef.current = setTimeout(() => {
        if (
          pcRef.current === pc &&
          pc.connectionState !== 'connected' &&
          pc.iceConnectionState !== 'connected' &&
          pc.iceConnectionState !== 'completed'
        ) {
          setFailureCategory('LAN_UNREACHABLE_OR_ISOLATED');
          setErrorMessage(
            'Polisi SEC-LAN-001 (Fail-Closed): Laluan terus LAN tempatan antara telefon dan TV tidak dapat disahkan (Pengasingan Klien Wi-Fi, Rangkaian Berbeza, atau Data Mudah Alih). Kawalan jauh kekal dikunci.'
          );
          setState('FAILED');
          updateDiagnostics({
            failureCategory: 'LAN_UNREACHABLE_OR_ISOLATED',
          });
        }
      }, 12000);
    },
    [
      clearNegotiationTimers,
      createPeerConnection,
      sendSignal,
      updateDiagnostics,
    ]
  );

  const connectSignalling = useCallback(
    (
      targetRoomId: string,
      targetPairingToken: string = pairingTokenRef.current,
      deviceLabel?: string,
      trustedReconnectCred?: EnrolledPhoneCredential
    ): Promise<void> => {
      return new Promise((resolve) => {
        if (wsRef.current) {
          try {
            wsRef.current.onclose = null;
            wsRef.current.close();
          } catch {
            // Ignore
          }
        }

        setState('SIGNALING');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}${APP_CONFIG.api.signallingPath}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        let settled = false;
        const settle = () => {
          if (!settled) {
            settled = true;
            resolve();
          }
        };

        const openTimeout = setTimeout(settle, 3500);

        const cleanRoomId = normalizeRoomCode(targetRoomId);

        ws.onopen = () => {
          reconnectAttemptsRef.current = 0;
          updateDiagnostics({
            signalingConnected: true,
            roomId: cleanRoomId,
          });

          if (clientPingTimerRef.current) {
            clearInterval(clientPingTimerRef.current);
          }
          clientPingTimerRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping' }));
              } catch {
                // Ignore
              }
            } else if (clientPingTimerRef.current) {
              clearInterval(clientPingTimerRef.current);
              clientPingTimerRef.current = null;
            }
          }, 15000);

          ws.send(
            JSON.stringify({
              type: 'join-room',
              roomId: cleanRoomId,
              pairingToken: trustedReconnectCred ? '' : targetPairingToken,
              reconnectAsTrusted: Boolean(trustedReconnectCred),
              deviceId: trustedReconnectCred?.deviceId,
              role: params.role,
              deviceName:
                trustedReconnectCred?.deviceName ||
                deviceLabel ||
                (params.role === 'sender'
                  ? 'Telefon Pintar (Kawalan LAN)'
                  : 'Paparan Utama TV'),
            })
          );
        };

        ws.onmessage = async (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (!msg || typeof msg.type !== 'string') return;

            if (msg.type === 'room-joined') {
              clearTimeout(openTimeout);
              peerNotFoundRetryCountRef.current = 0;
              if (params.role === 'display' && msg.pairingToken) {
                setPairingToken(msg.pairingToken);
                if (typeof msg.pairingExpiresAtMs === 'number') {
                  setPairingExpiresAtMs(msg.pairingExpiresAtMs);
                }
                sessionGuardRef.current = new LanSessionGuard({
                  tvId: initialTvIdentity.current.tvId,
                  roomId: targetRoomId,
                  pairingToken: msg.pairingToken,
                  pairingTtlMs: APP_CONFIG.webrtc.pairingTokenTtlMs,
                  sessionTtlMs: APP_CONFIG.webrtc.authorizedSessionTtlMs,
                  maxContinuousSessionMs:
                    APP_CONFIG.webrtc.maxContinuousSessionMs,
                  trustedDeviceTtlMs: APP_CONFIG.webrtc.trustedDeviceTtlMs,
                  replayWindowMs: APP_CONFIG.webrtc.commandReplayWindowMs,
                  initialTrustedDevices: loadTvTrustedDevices(),
                });
                syncTrustedDevicesToStorage();
                setAuthorizationStatus('AWAITING_PHONE');
                updateDiagnostics({ authorizationStatus: 'AWAITING_PHONE' });
                setState('WAITING_FOR_PEER');
              } else if (params.role === 'sender') {
                if (!msg.reconnectAsTrusted) {
                  setAuthorizationStatus('PENDING_TV_APPROVAL');
                  setState('PAIRING');
                  updateDiagnostics({
                    authorizationStatus: 'PENDING_TV_APPROVAL',
                  });
                }
              }

              settle();
            } else if (
              msg.type === 'pairing-token-rotated' &&
              params.role === 'display'
            ) {
              if (msg.pairingToken) {
                setPairingToken(msg.pairingToken);
              }
              if (typeof msg.pairingExpiresAtMs === 'number') {
                setPairingExpiresAtMs(msg.pairingExpiresAtMs);
              }
            } else if (
              msg.type === 'peer-joined' &&
              params.role === 'display'
            ) {
              // First-Time / Unenrolled Phone: Requires Explicit On-TV Approval (SEC-LAN-002 Req #1)
              const verify = sessionGuardRef.current.verifyPairingRequest({
                roomId: targetRoomId,
                pairingToken: String(msg.pairingToken || ''),
                deviceName: String(msg.deviceName || 'Telefon Pintar'),
                deviceId: msg.deviceId ? String(msg.deviceId) : undefined,
              });

              if (!verify.valid) {
                setFailureCategory(verify.failureCategory);
                setErrorMessage(verify.reasonBM);
                setAuthorizationStatus(verify.status);
                updateDiagnostics({
                  authorizationStatus: verify.status,
                  failureCategory: verify.failureCategory,
                });
                return;
              }

              setPeerDeviceName(String(msg.deviceName || 'Telefon Pintar'));
              setAuthorizationStatus('PENDING_TV_APPROVAL');
              setState('PAIRING');
              updateDiagnostics({
                hasSenderPeer: true,
                authorizationStatus: 'PENDING_TV_APPROVAL',
              });
            } else if (
              msg.type === 'trusted-reconnect-request' &&
              params.role === 'display'
            ) {
              // SEC-LAN-002 Req #2: Enrolled Trusted Device requests challenge-response
              const reqDeviceId = String(msg.deviceId || '');
              const ch =
                sessionGuardRef.current.issueReconnectChallenge(reqDeviceId);
              if (!ch.issued || !ch.challengeNonce) {
                setFailureCategory(ch.failureCategory);
                setErrorMessage(ch.reasonBM);
                sendSignal({
                  type: 'trusted-reconnect-rejected',
                  roomId: targetRoomId,
                  failureCategory: ch.failureCategory,
                  message: ch.reasonBM,
                });
                return;
              }

              sendSignal({
                type: 'trusted-challenge',
                roomId: targetRoomId,
                tvId: initialTvIdentity.current.tvId,
                deviceId: reqDeviceId,
                challengeNonce: ch.challengeNonce,
              });
            } else if (
              msg.type === 'trusted-challenge' &&
              params.role === 'sender' &&
              trustedReconnectCred
            ) {
              // Sender computes HMAC-SHA256 proof over (tvId, roomId, deviceId, challengeNonce, timestampMs)
              const challengeNonce = String(msg.challengeNonce || '');
              const challengeTvId = String(
                msg.tvId || trustedReconnectCred.tvId
              );
              const ts = Date.now();
              const proofHex = computeTrustedChallengeProof({
                secretKeyHex: trustedReconnectCred.secretKeyHex,
                tvId: challengeTvId,
                roomId: targetRoomId,
                deviceId: trustedReconnectCred.deviceId,
                challengeNonce,
                timestampMs: ts,
              });

              sendSignal({
                type: 'trusted-challenge-response',
                roomId: targetRoomId,
                deviceId: trustedReconnectCred.deviceId,
                challengeNonce,
                timestampMs: ts,
                proofHex,
              });
            } else if (
              msg.type === 'trusted-challenge-response' &&
              params.role === 'display'
            ) {
              // Display verifies cryptographic challenge response and auto-authorizes if valid (SEC-LAN-002 Req #2)
              const verify =
                sessionGuardRef.current.verifyTrustedReconnectResponse({
                  roomId: targetRoomId,
                  deviceId: String(msg.deviceId || ''),
                  challengeNonce: String(msg.challengeNonce || ''),
                  timestampMs: Number(msg.timestampMs || 0),
                  proofHex: String(msg.proofHex || ''),
                });

              if (!verify.authorized || !verify.sessionToken) {
                setFailureCategory(verify.failureCategory);
                setErrorMessage(verify.reasonBM);
                sendSignal({
                  type: 'trusted-reconnect-rejected',
                  roomId: targetRoomId,
                  failureCategory: verify.failureCategory,
                  message: verify.reasonBM,
                });
                return;
              }

              syncTrustedDevicesToStorage();
              setPeerDeviceName(
                verify.deviceName || 'Telefon Pentadbir Dipercayai'
              );
              setSessionExpiresAtMs(verify.expiresAtMs);
              setMaxSessionExpiresAtMs(verify.maxSessionExpiresAtMs);
              setAuthorizationStatus('AUTHORIZED');
              setFailureCategory('NONE');
              setErrorMessage(null);
              updateDiagnostics({
                hasSenderPeer: true,
                authorizationStatus: 'AUTHORIZED',
                failureCategory: 'NONE',
              });

              sendSignal({
                type: 'trusted-reconnect-approved',
                roomId: targetRoomId,
                sessionToken: verify.sessionToken,
                expiresAtMs: verify.expiresAtMs,
                maxSessionExpiresAtMs: verify.maxSessionExpiresAtMs,
                deviceName: verify.deviceName,
              });
            } else if (
              (msg.type === 'pairing-approved' ||
                msg.type === 'trusted-reconnect-approved') &&
              params.role === 'sender'
            ) {
              senderSessionTokenRef.current = String(msg.sessionToken || '');
              if (typeof msg.expiresAtMs === 'number') {
                setSessionExpiresAtMs(msg.expiresAtMs);
              }
              if (typeof msg.maxSessionExpiresAtMs === 'number') {
                setMaxSessionExpiresAtMs(msg.maxSessionExpiresAtMs);
              }
              // If TV enrolled this phone as a 14-day Trusted Device, store the issued credential locally
              if (
                msg.trustedCredential &&
                typeof msg.trustedCredential === 'object'
              ) {
                const tc = msg.trustedCredential as TrustedDeviceRecord;
                const credToSave: EnrolledPhoneCredential = {
                  deviceId: tc.deviceId,
                  deviceName: tc.deviceName,
                  tvId: tc.tvId,
                  roomId: targetRoomId,
                  secretKeyHex: tc.secretKeyHex,
                  enrolledAtMs: tc.enrolledAtMs,
                  expiresAtMs: tc.expiresAtMs,
                };
                savePhoneEnrolledCredential(credToSave);
                setEnrolledCreds(loadPhoneEnrolledCredentials());
              }

              commandSeqRef.current = 0;
              setAuthorizationStatus('AUTHORIZED');
              setFailureCategory('NONE');
              setErrorMessage(null);
              updateDiagnostics({
                authorizationStatus: 'AUTHORIZED',
                failureCategory: 'NONE',
              });

              await sendOfferFromSender(targetRoomId);
            } else if (
              msg.type === 'trusted-reconnect-rejected' &&
              params.role === 'sender'
            ) {
              senderSessionTokenRef.current = null;
              const cat =
                (msg.failureCategory as StreamingFailureCategory) ||
                'TRUSTED_CREDENTIAL_INVALID';
              if (
                cat === 'TRUSTED_DEVICE_REVOKED' ||
                cat === 'TRUSTED_CREDENTIAL_EXPIRED'
              ) {
                removePhoneEnrolledCredentialForRoom(targetRoomId);
                setEnrolledCreds(loadPhoneEnrolledCredentials());
              }
              setAuthorizationStatus('REJECTED');
              setFailureCategory(cat);
              setErrorMessage(
                String(
                  msg.message ||
                    'Sambungan semula Peranti Dipercayai ditolak oleh TV.'
                )
              );
              setState('FAILED');
              updateDiagnostics({
                authorizationStatus: 'REJECTED',
                failureCategory: cat,
              });
            } else if (
              msg.type === 'pairing-rejected' &&
              params.role === 'sender'
            ) {
              senderSessionTokenRef.current = null;
              setAuthorizationStatus('REJECTED');
              setFailureCategory('PAIRING_REJECTED_BY_TV');
              setErrorMessage(
                'Permintaan gandingan telah ditolak pada skrin TV (Pairing Rejected).'
              );
              setState('FAILED');
              updateDiagnostics({
                authorizationStatus: 'REJECTED',
                failureCategory: 'PAIRING_REJECTED_BY_TV',
              });
            } else if (
              msg.type === 'session-revoked' ||
              msg.type === 'trusted-device-revoked'
            ) {
              senderSessionTokenRef.current = null;
              if (msg.type === 'trusted-device-revoked') {
                removePhoneEnrolledCredentialForRoom(targetRoomId);
                setEnrolledCreds(loadPhoneEnrolledCredentials());
              }
              cleanupPeerConnection();
              stopLocalMedia();
              setAuthorizationStatus('REVOKED');
              setFailureCategory(
                msg.type === 'trusted-device-revoked'
                  ? 'TRUSTED_DEVICE_REVOKED'
                  : 'SESSION_REVOKED'
              );
              setErrorMessage(
                msg.type === 'trusted-device-revoked'
                  ? 'Pendaftaran Peranti Dipercayai dan sesi kawalan telah dibatalkan oleh TV.'
                  : 'Sesi kawalan jauh dan siaran telah dibatalkan oleh TV (Session Revoked).'
              );
              setState('DISCONNECTED');
              updateDiagnostics({
                authorizationStatus: 'REVOKED',
                failureCategory:
                  msg.type === 'trusted-device-revoked'
                    ? 'TRUSTED_DEVICE_REVOKED'
                    : 'SESSION_REVOKED',
              });
            } else if (
              msg.type === 'webrtc-offer' &&
              params.role === 'display'
            ) {
              const guardState = sessionGuardRef.current.getState();
              if (guardState.status !== 'AUTHORIZED') {
                setFailureCategory('UNAUTHORIZED_COMMAND');
                setErrorMessage(
                  'Tawaran WebRTC ditolak kerana telefon belum diluluskan pada skrin TV.'
                );
                return;
              }

              setState('NEGOTIATING');
              updateDiagnostics({
                sdpOfferSentOrReceived: true,
                hasSenderPeer: true,
              });

              let pc = pcRef.current;
              if (!pc || pc.signalingState === 'closed' || pc.signalingState !== 'stable') {
                pc = createPeerConnection(targetRoomId);
              }
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                await flushQueuedCandidates(pc);

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                updateDiagnostics({ sdpAnswerSentOrReceived: true });

                sendSignal({
                  type: 'webrtc-answer',
                  roomId: targetRoomId,
                  sdp: pc.localDescription,
                });
              } catch {
                cleanupPeerConnection();
                const freshPc = createPeerConnection(targetRoomId);
                await freshPc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
                await flushQueuedCandidates(freshPc);
                const answer = await freshPc.createAnswer();
                await freshPc.setLocalDescription(answer);
                updateDiagnostics({ sdpAnswerSentOrReceived: true });
                sendSignal({
                  type: 'webrtc-answer',
                  roomId: targetRoomId,
                  sdp: freshPc.localDescription,
                });
              }
            } else if (
              msg.type === 'webrtc-answer' &&
              params.role === 'sender'
            ) {
              if (pcRef.current && msg.sdp) {
                updateDiagnostics({
                  sdpAnswerSentOrReceived: true,
                  hasDisplayPeer: true,
                });
                await pcRef.current.setRemoteDescription(
                  new RTCSessionDescription(msg.sdp)
                );
                await flushQueuedCandidates(pcRef.current);
              }
            } else if (msg.type === 'webrtc-ice-candidate') {
              if (!msg.candidate || !msg.candidate.candidate) return;
              const candStr = String(msg.candidate.candidate);

              if (!isPermittedHostOnlyCandidate(candStr)) {
                setDiagnostics((prev) => ({
                  ...prev,
                  rejectedNonHostCandidates: prev.rejectedNonHostCandidates + 1,
                }));
                return;
              }

              const cType = parseIceCandidateType(candStr);
              setDiagnostics((prev) => ({
                ...prev,
                remoteCandidateTypes: Array.from(
                  new Set([...prev.remoteCandidateTypes, cType])
                ),
              }));

              if (pcRef.current && pcRef.current.remoteDescription) {
                try {
                  await pcRef.current.addIceCandidate(
                    new RTCIceCandidate(msg.candidate)
                  );
                } catch {
                  // Ignore late candidate
                }
              } else {
                candidateQueueRef.current.enqueue(msg.candidate);
              }
            } else if (msg.type === 'peer-left') {
              cleanupPeerConnection();
              setPeerDeviceName(null);
              setState('DISCONNECTED');
              updateDiagnostics({
                hasSenderPeer: params.role === 'sender',
                hasDisplayPeer: params.role === 'display',
                remoteTrackCount: 0,
              });
            } else if (msg.type === 'error') {
              const code = String(msg.code || '');
              let cat: StreamingFailureCategory = 'SIGNALING_UNAVAILABLE';
              if (code === 'SESSION_EXPIRED') {
                cat = 'SESSION_EXPIRED';
                setAuthorizationStatus('EXPIRED');
              } else if (code === 'SESSION_REVOKED') {
                cat = 'SESSION_REVOKED';
                setAuthorizationStatus('REVOKED');
              } else if (code === 'PAIRING_TOKEN_INVALID') {
                cat = 'PAIRING_TOKEN_INVALID';
              } else if (code === 'PEER_NOT_FOUND') {
                cat = 'PEER_NOT_FOUND';
                // Gate 14 Root-Cause Fix: Bounded retry for sender if TV was in middle of reconnect/registration
                if (
                  params.role === 'sender' &&
                  peerNotFoundRetryCountRef.current < 3
                ) {
                  peerNotFoundRetryCountRef.current += 1;
                  setTimeout(() => {
                    if (isMountedRef.current && params.enabled !== false) {
                      connectSignalling(
                        cleanRoomId,
                        targetPairingToken,
                        deviceLabel,
                        trustedReconnectCred
                      );
                    }
                  }, 1200);
                  settle();
                  return;
                }
              } else if (code === 'PROHIBITED_SIGNALLING_COMMAND') {
                cat = 'PROHIBITED_SIGNALLING_COMMAND';
              } else if (
                code === 'NON_LAN_CANDIDATE_REJECTED' ||
                code === 'NON_LAN_SOCKET_REJECTED' ||
                code === 'DIFFERENT_SUBNET_REJECTED'
              ) {
                cat = 'NON_LAN_CANDIDATE_REJECTED';
              }

              setFailureCategory(cat);
              setErrorMessage(
                msg.message || 'Ralat keselamatan sesi gandingan SEC-LAN-001.'
              );
              setState('FAILED');
              updateDiagnostics({ failureCategory: cat });
              settle();
            }
          } catch {
            // Ignore malformed signalling payload
          }
        };

        ws.onclose = () => {
          clearTimeout(openTimeout);
          if (clientPingTimerRef.current) {
            clearInterval(clientPingTimerRef.current);
            clientPingTimerRef.current = null;
          }
          updateDiagnostics({ signalingConnected: false });

          // Gate 14 Root-Cause Fix: Automatically reconnect Display WebSocket on drop
          if (
            params.role === 'display' &&
            params.enabled !== false &&
            isMountedRef.current
          ) {
            if (!signallingReconnectTimerRef.current) {
              signallingReconnectTimerRef.current = setTimeout(() => {
                signallingReconnectTimerRef.current = null;
                if (isMountedRef.current && params.enabled !== false) {
                  connectSignalling(roomIdRef.current, pairingTokenRef.current);
                }
              }, 2000);
            }
          }
          settle();
        };

        ws.onerror = () => {
          updateDiagnostics({ signalingConnected: false });
        };
      });
    },
    [
      cleanupPeerConnection,
      createPeerConnection,
      flushQueuedCandidates,
      params.role,
      sendOfferFromSender,
      sendSignal,
      setPairingToken,
      stopLocalMedia,
      syncTrustedDevicesToStorage,
      updateDiagnostics,
    ]
  );

  const requestPhonePairing = useCallback(
    async (
      targetRoomId: string = roomIdRef.current,
      targetToken: string = pairingTokenRef.current,
      deviceLabel: string = 'Telefon Pintar (Alat Kawalan LAN)'
    ) => {
      const cleanedRoom = normalizeRoomCode(targetRoomId);
      const cleanedToken = targetToken.trim();
      if (!cleanedRoom || !cleanedToken) {
        setFailureCategory('PAIRING_TOKEN_INVALID');
        setErrorMessage(
          'Sila masukkan Kod Bilik 6-digit dan Token Keselamatan daripada skrin TV.'
        );
        return;
      }

      peerNotFoundRetryCountRef.current = 0;
      setErrorMessage(null);
      setFailureCategory('NONE');
      setCommandStatus('IDLE');
      setRoomId(cleanedRoom);
      setPairingToken(cleanedToken);

      await connectSignalling(cleanedRoom, cleanedToken, deviceLabel);
    },
    [connectSignalling, setPairingToken, setRoomId]
  );

  /**
   * SEC-LAN-002 Requirement #2:
   * Connects an enrolled Trusted Administrator Phone to the TV using cryptographic challenge-response
   * without requiring repeated on-TV button presses.
   */
  const reconnectAsTrustedPhone = useCallback(
    async (cred: EnrolledPhoneCredential) => {
      peerNotFoundRetryCountRef.current = 0;
      if (Date.now() > cred.expiresAtMs) {
        removePhoneEnrolledCredentialForRoom(cred.roomId);
        setEnrolledCreds(loadPhoneEnrolledCredentials());
        setFailureCategory('TRUSTED_CREDENTIAL_EXPIRED');
        setErrorMessage(
          'Tauliah Peranti Dipercayai (14 hari) telah tamat tempoh. Sila imbas Kod QR pada TV untuk pendaftaran baharu.'
        );
        return;
      }

      setErrorMessage(null);
      setFailureCategory('NONE');
      setCommandStatus('IDLE');
      const cleanRoom = normalizeRoomCode(cred.roomId);
      setRoomId(cleanRoom);

      await connectSignalling(cleanRoom, '', cred.deviceName, cred);
    },
    [connectSignalling, setRoomId]
  );

  /**
   * Display Operator Action: Explicitly approve the pending phone pairing request on the TV (SEC-LAN-002 Req #1).
   * Supports either 1-time session approval (`enrollAsTrusted: false`) or 14-day Trusted Device enrollment (`enrollAsTrusted: true`).
   */
  const approvePendingPairingOnTv = useCallback(
    (options?: { enrollAsTrusted?: boolean }) => {
      const res = sessionGuardRef.current.approvePendingPhoneOnTv(
        Date.now(),
        options
      );
      if (!res.approved || !res.sessionToken) {
        setErrorMessage(res.reasonBM);
        return;
      }

      syncTrustedDevicesToStorage();
      setSessionExpiresAtMs(res.expiresAtMs);
      setMaxSessionExpiresAtMs(res.maxSessionExpiresAtMs);
      setAuthorizationStatus('AUTHORIZED');
      setFailureCategory('NONE');
      setErrorMessage(null);
      updateDiagnostics({
        authorizationStatus: 'AUTHORIZED',
        failureCategory: 'NONE',
      });

      sendSignal({
        type: 'pairing-approved',
        roomId: roomIdRef.current,
        sessionToken: res.sessionToken,
        expiresAtMs: res.expiresAtMs,
        maxSessionExpiresAtMs: res.maxSessionExpiresAtMs,
        trustedCredential: res.trustedCredential,
      });

      // Automatically transition to stream receiver view to prepare for live stream
      if (params.onRemoteCommandExecuted) {
        params.onRemoteCommandExecuted('SWITCH_VIEW_STREAM');
      }
    },
    [params, sendSignal, syncTrustedDevicesToStorage, updateDiagnostics]
  );

  const rejectPendingPairingOnTv = useCallback(() => {
    sessionGuardRef.current.rejectPendingPhoneOnTv();
    setAuthorizationStatus('REJECTED');
    setPeerDeviceName(null);
    setState('WAITING_FOR_PEER');
    updateDiagnostics({ authorizationStatus: 'REJECTED' });

    sendSignal({
      type: 'pairing-rejected',
      roomId: roomIdRef.current,
    });
  }, [sendSignal, updateDiagnostics]);

  const revokePairingSessionOnTv = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    sessionGuardRef.current.revokeSession();
    sendSignal({
      type: 'session-revoked',
      roomId: roomIdRef.current,
    });
    cleanupPeerConnection();
    stopLocalMedia();
    remoteStreamRef.current = null;
    setRemoteStream(null);
    tvMediaPlayingRef.current = false;
    setTvMediaPlaying(false);
    setPeerDeviceName(null);
    setSessionExpiresAtMs(0);
    setMaxSessionExpiresAtMs(0);
    setAuthorizationStatus('REVOKED');
    setState('RETURNING_TO_PRAYER_DISPLAY');
    activeTvViewRef.current = 'primary';
    updateDiagnostics({ authorizationStatus: 'REVOKED' });
    if (params.onStreamEnded) {
      params.onStreamEnded();
    } else if (params.onRemoteCommandExecuted) {
      params.onRemoteCommandExecuted('SWITCH_VIEW_PRIMARY');
    }
  }, [cleanupPeerConnection, params, sendSignal, stopLocalMedia, updateDiagnostics]);

  /**
   * SEC-LAN-002 Requirement #6:
   * Immediately revokes a single enrolled Trusted Device on the TV.
   */
  const revokeTrustedDeviceOnTv = useCallback(
    (deviceId: string) => {
      const revoked = sessionGuardRef.current.revokeTrustedDevice(deviceId);
      if (revoked) {
        syncTrustedDevicesToStorage();
        const guardState = sessionGuardRef.current.getState();
        if (guardState.status === 'REVOKED') {
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          sendSignal({
            type: 'trusted-device-revoked',
            roomId: roomIdRef.current,
            deviceId,
          });
          cleanupPeerConnection();
          stopLocalMedia();
          remoteStreamRef.current = null;
          setRemoteStream(null);
          tvMediaPlayingRef.current = false;
          setTvMediaPlaying(false);
          setPeerDeviceName(null);
          setAuthorizationStatus('REVOKED');
          setState('RETURNING_TO_PRAYER_DISPLAY');
          activeTvViewRef.current = 'primary';
          if (params.onStreamEnded) {
            params.onStreamEnded();
          } else if (params.onRemoteCommandExecuted) {
            params.onRemoteCommandExecuted('SWITCH_VIEW_PRIMARY');
          }
        }
      }
    },
    [
      cleanupPeerConnection,
      params,
      sendSignal,
      stopLocalMedia,
      syncTrustedDevicesToStorage,
    ]
  );

  /**
   * SEC-LAN-002 Requirement #6:
   * Immediately revokes ALL enrolled Trusted Devices on the TV and terminates any active session.
   */
  const revokeAllTrustedDevicesOnTv = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    sessionGuardRef.current.revokeAllTrustedDevices();
    syncTrustedDevicesToStorage();
    sendSignal({
      type: 'trusted-device-revoked',
      roomId: roomIdRef.current,
    });
    cleanupPeerConnection();
    stopLocalMedia();
    remoteStreamRef.current = null;
    setRemoteStream(null);
    tvMediaPlayingRef.current = false;
    setTvMediaPlaying(false);
    setPeerDeviceName(null);
    setSessionExpiresAtMs(0);
    setMaxSessionExpiresAtMs(0);
    setAuthorizationStatus('REVOKED');
    setState('RETURNING_TO_PRAYER_DISPLAY');
    activeTvViewRef.current = 'primary';
    updateDiagnostics({ authorizationStatus: 'REVOKED' });
    if (params.onStreamEnded) {
      params.onStreamEnded();
    } else if (params.onRemoteCommandExecuted) {
      params.onRemoteCommandExecuted('SWITCH_VIEW_PRIMARY');
    }
  }, [
    cleanupPeerConnection,
    params,
    sendSignal,
    stopLocalMedia,
    syncTrustedDevicesToStorage,
    updateDiagnostics,
  ]);

  const startCameraBroadcast = useCallback(
    async (
      targetRoomId: string = roomIdRef.current,
      cameraMode: 'environment' | 'user' = facingMode,
      targetToken: string = pairingTokenRef.current,
      resPreset: VideoResolutionPreset = targetResolution,
      fpsPreset: VideoFrameRatePreset = targetFps
    ) => {
      if (isConnectingRef.current) return;
      isConnectingRef.current = true;

      setErrorMessage(null);
      setFailureCategory('NONE');
      setState('REQUESTING_CAMERA');

      try {
        const targetDim =
          RESOLUTION_PRESETS[resPreset] || RESOLUTION_PRESETS['720p'];

        let stream = localStreamRef.current;
        const hasActiveVideoTrack =
          stream &&
          stream
            .getVideoTracks()
            .some((t) => t.readyState === 'live' && t.enabled);

        if (!hasActiveVideoTrack || cameraMode !== facingMode) {
          stopLocalMedia();
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: {
                  facingMode: { ideal: cameraMode },
                  width: { ideal: targetDim.width },
                  height: { ideal: targetDim.height },
                  frameRate: { ideal: fpsPreset },
                },
                audio: true,
              });
            } catch {
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: true,
                  audio: false,
                });
              } catch {
                // If camera hardware access fails (e.g. permission or device locked),
                // fall back to animated test pattern stream so the TV receiver still displays video
                stream = createTestPatternStream(
                  targetDim.width,
                  targetDim.height,
                  'Siaran Langsung Telefon'
                );
              }
            }
          } else {
            // navigator.mediaDevices unavailable (e.g. non-localhost HTTP on mobile browser)
            stream = createTestPatternStream(
              targetDim.width,
              targetDim.height,
              'Siaran Langsung Telefon (LAN)'
            );
          }
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setFacingMode(cameraMode);
        setTargetResolution(resPreset);
        setTargetFps(fpsPreset);

        const videoTrack = stream
          ?.getVideoTracks()
          .find((t) => t.readyState === 'live');
        if (videoTrack) {
          const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
          const actualW = settings.width || targetDim.width;
          const actualH = settings.height || targetDim.height;
          const actualFps = Math.round(settings.frameRate || fpsPreset);
          const actualAspect =
            actualH > 0 ? Number((actualW / actualH).toFixed(2)) : 1.78;
          const isActualSupported = actualW >= targetDim.width * 0.8;
          setVideoQualityStats({
            width: actualW,
            height: actualH,
            frameRate: actualFps,
            aspectRatio: actualAspect,
            facingMode: settings.facingMode || cameraMode,
            targetResolution: resPreset,
            targetFps: fpsPreset,
            isActualSupported,
            actualQualityLabelBM: `${actualW}x${actualH} @ ${actualFps}fps`,
          });
        }

        updateDiagnostics({
          localTrackCount: stream ? stream.getTracks().length : 0,
        });

        if (params.role === 'display') {
          setState('STREAMING');
          isConnectingRef.current = false;
          return;
        }

        const cleanedRoom = targetRoomId.replace(/\s+/g, '').trim();
        const cleanedToken = targetToken.trim();
        setRoomId(cleanedRoom);
        setPairingToken(cleanedToken);

        queuedCommandRef.current = 'START_STREAM';
        const isAuthorizedNow =
          authorizationStatus === 'AUTHORIZED' ||
          authorizationStatusRef.current === 'AUTHORIZED' ||
          Boolean(senderSessionTokenRef.current);

        if (
          isAuthorizedNow &&
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          if (
            dataChannelRef.current &&
            dataChannelRef.current.readyState === 'open'
          ) {
            sendRemoteControlCommand('START_STREAM', {
              fitMode,
              theatreMode,
              overlayDensity,
            });
          }
          await sendOfferFromSender(cleanedRoom);
        } else {
          await connectSignalling(
            cleanedRoom,
            cleanedToken,
            'Telefon Pintar (Siaran LAN)'
          );
        }
      } catch (err) {
        const mediaClass = classifyMediaError(err);
        setFailureCategory(mediaClass.category);
        setErrorMessage(mediaClass.messageBM);
        setState(() =>
          authorizationStatus === 'AUTHORIZED' ? 'CONNECTED' : 'FAILED'
        );
        updateDiagnostics({ failureCategory: mediaClass.category });
      } finally {
        isConnectingRef.current = false;
      }
    },
    [
      authorizationStatus,
      connectSignalling,
      facingMode,
      fitMode,
      overlayDensity,
      params.role,
      sendOfferFromSender,
      sendRemoteControlCommand,
      setPairingToken,
      setRoomId,
      stopLocalMedia,
      targetFps,
      targetResolution,
      theatreMode,
      updateDiagnostics,
    ]
  );

  const stopCameraBroadcastOnly = useCallback(() => {
    stopLocalMedia();
    setTvMediaPlaying(false);
    setConfirmedTvStreaming(false);
    setRotationDegreesState(0);
    setOrientationModeState('auto');
    if (
      dataChannelRef.current &&
      dataChannelRef.current.readyState === 'open'
    ) {
      sendRemoteControlCommand('STOP_STREAM');
      setState('CONNECTED');
    } else {
      setState('DISCONNECTED');
    }
  }, [sendRemoteControlCommand, stopLocalMedia]);

  const switchCameraFacingMode = useCallback(async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    const targetDim =
      RESOLUTION_PRESETS[targetResolution] || RESOLUTION_PRESETS['720p'];
    const oldStream = localStreamRef.current;
    const oldTracks = oldStream ? oldStream.getTracks() : [];

    try {
      let newStream: MediaStream;
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: nextFacing },
              width: { ideal: targetDim.width },
              height: { ideal: targetDim.height },
              frameRate: { ideal: targetFps },
            },
            audio: true,
          });
        } catch {
          newStream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: nextFacing },
              width: { ideal: targetDim.width },
              height: { ideal: targetDim.height },
              frameRate: { ideal: targetFps },
            },
            audio: false,
          });
        }
      } else {
        newStream = createTestPatternStream(
          targetDim.width,
          targetDim.height,
          `Kamera ${nextFacing === 'user' ? 'Depan' : 'Belakang'}`
        );
      }

      for (const track of oldTracks) {
        try {
          track.stop();
        } catch {
          // Ignore track stop error
        }
      }

      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setFacingMode(nextFacing);

      // Seamlessly replace sender tracks on active RTCPeerConnection without renegotiation
      const pc = pcRef.current;
      if (pc && pc.signalingState === 'stable') {
        const senders = pc.getSenders();
        for (const track of newStream.getTracks()) {
          const sender = senders.find((s) => s.track?.kind === track.kind);
          if (sender && typeof sender.replaceTrack === 'function') {
            await sender.replaceTrack(track).catch(() => {});
          }
        }
      }

      const videoTrack = newStream
        .getVideoTracks()
        .find((t) => t.readyState === 'live');
      if (videoTrack) {
        const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
        const actualW = settings.width || targetDim.width;
        const actualH = settings.height || targetDim.height;
        const actualFps = Math.round(settings.frameRate || targetFps);
        setVideoQualityStats({
          width: actualW,
          height: actualH,
          frameRate: actualFps,
          aspectRatio:
            actualH > 0 ? Number((actualW / actualH).toFixed(2)) : 1.78,
          facingMode: nextFacing,
          targetResolution,
          targetFps,
          isActualSupported: actualW >= targetDim.width * 0.8,
          actualQualityLabelBM: `${actualW}x${actualH} @ ${actualFps}fps (${
            nextFacing === 'user' ? 'Depan' : 'Belakang'
          })`,
        });
      }
    } catch (err) {
      const mediaClass = classifyMediaError(err);
      setErrorMessage(`Gagal menukar kamera: ${mediaClass.messageBM}`);
    }
  }, [facingMode, targetFps, targetResolution]);

  const disconnectStream = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    candidateQueueRef.current.clear();
    cleanupPeerConnection();
    stopLocalMedia();
    remoteStreamRef.current = null;
    setRemoteStream(null);
    tvMediaPlayingRef.current = false;
    setTvMediaPlaying(false);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    wsRef.current = null;
    senderSessionTokenRef.current = null;
    setPeerDeviceName(null);
    setFailureCategory('NONE');
    setErrorMessage(null);
    setCommandStatus('IDLE');
    setState('RETURNING_TO_PRAYER_DISPLAY');
    activeTvViewRef.current = 'primary';
    if (params.onStreamEnded) {
      params.onStreamEnded();
    } else if (params.onRemoteCommandExecuted) {
      params.onRemoteCommandExecuted('SWITCH_VIEW_PRIMARY');
    }
  }, [cleanupPeerConnection, params, stopLocalMedia]);

  /**
   * Rotates the ephemeral pairing token on the TV (keeping the persistent TV Room ID intact so enrolled phones can always find the TV).
   */
  const regenerateRoom = useCallback(() => {
    const rot = sessionGuardRef.current.rotateIdlePairingToken(Date.now());
    const newToken = rot.rotated
      ? rot.pairingToken
      : generateCryptographicToken(12);
    setPairingToken(newToken);
    setPairingExpiresAtMs(Date.now() + APP_CONFIG.webrtc.pairingTokenTtlMs);
    setErrorMessage(null);
    setFailureCategory('NONE');
    if (authorizationStatus !== 'AUTHORIZED') {
      setAuthorizationStatus('AWAITING_PHONE');
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      sendSignal({
        type: 'rotate-pairing-token',
        roomId: roomIdRef.current,
        pairingToken: newToken,
      });
    } else {
      connectSignalling(roomIdRef.current, newToken);
    }
  }, [authorizationStatus, connectSignalling, sendSignal, setPairingToken]);

  // SEC-LAN-002 Requirement #7: Automatic Idle Pairing Token Rotation every 90 seconds on Display
  useEffect(() => {
    if (params.role !== 'display') return;
    const rotateTimer = setInterval(() => {
      const guardState = sessionGuardRef.current.getState();
      if (
        guardState.status === 'AWAITING_PHONE' ||
        guardState.status === 'EXPIRED'
      ) {
        const res = sessionGuardRef.current.rotateIdlePairingToken(Date.now());
        if (res.rotated) {
          setPairingToken(res.pairingToken);
          setPairingExpiresAtMs(res.pairingExpiresAtMs);
          setAuthorizationStatus('AWAITING_PHONE');
          sendSignal({
            type: 'rotate-pairing-token',
            roomId: roomIdRef.current,
            pairingToken: res.pairingToken,
          });
        }
      }
    }, APP_CONFIG.webrtc.pairingTokenRotateIntervalMs);

    return () => clearInterval(rotateTimer);
  }, [params.role, sendSignal, setPairingToken]);

  // SEC-LAN-002 Requirement #4 & #5: Session expiry watcher & automatic active session renewal (bounded by 4h max continuous session)
  useEffect(() => {
    const expiryInterval = setInterval(() => {
      const now = Date.now();
      if (params.role === 'display') {
        const guardState = sessionGuardRef.current.getState(now);
        if (
          guardState.status === 'EXPIRED' &&
          authorizationStatus !== 'EXPIRED'
        ) {
          setAuthorizationStatus('EXPIRED');
          updateDiagnostics({ authorizationStatus: 'EXPIRED' });
        }
      } else if (
        params.role === 'sender' &&
        authorizationStatus === 'AUTHORIZED'
      ) {
        // Check 4-hour maximum continuous session limit first
        if (maxSessionExpiresAtMs > 0 && now > maxSessionExpiresAtMs) {
          setAuthorizationStatus('EXPIRED');
          setFailureCategory('MAX_SESSION_DURATION_EXCEEDED');
          setErrorMessage(
            'Had tempoh sesi berterusan maksimum (4 jam) telah tamat. Sila sambung semula untuk pengesahan baharu.'
          );
          cleanupPeerConnection();
          stopLocalMedia();
          setState('DISCONNECTED');
          return;
        }

        // If within 5 minutes of the 30-minute session token expiry and DataChannel is open, auto-renew
        if (
          sessionExpiresAtMs > 0 &&
          sessionExpiresAtMs - now < 5 * 60 * 1000 &&
          sessionExpiresAtMs > now &&
          dataChannelRef.current?.readyState === 'open' &&
          pendingCommandAction === null
        ) {
          sendRemoteControlCommand('RENEW_SESSION');
        } else if (sessionExpiresAtMs > 0 && now > sessionExpiresAtMs) {
          setAuthorizationStatus('EXPIRED');
          setFailureCategory('SESSION_EXPIRED');
          setErrorMessage(
            'Sesi kawalan jauh telah tamat tempoh (30 minit). Sila sambung semula.'
          );
          cleanupPeerConnection();
          stopLocalMedia();
          setState('DISCONNECTED');
        }
      }
    }, 2000);

    return () => clearInterval(expiryInterval);
  }, [
    authorizationStatus,
    cleanupPeerConnection,
    maxSessionExpiresAtMs,
    params.role,
    pendingCommandAction,
    sendRemoteControlCommand,
    sessionExpiresAtMs,
    stopLocalMedia,
    updateDiagnostics,
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    if (params.enabled === false) {
      return;
    }

    if (params.role === 'display') {
      connectSignalling(roomIdRef.current, pairingTokenRef.current);
    } else if (params.initialRoomId && params.initialPairingToken) {
      // SEC-LAN-002 Zero-Touch Reconnection: Check if this phone was previously enrolled for this TV room
      const cleanInitialRoom = normalizeRoomCode(params.initialRoomId);
      const savedCreds = loadPhoneEnrolledCredentials().filter(
        (c) => Date.now() < c.expiresAtMs
      );
      const matchingCred = savedCreds.find(
        (c) => normalizeRoomCode(c.roomId) === cleanInitialRoom
      );
      if (matchingCred) {
        setRoomId(matchingCred.roomId);
        connectSignalling(
          matchingCred.roomId,
          '',
          matchingCred.deviceName,
          matchingCred
        );
      } else {
        connectSignalling(cleanInitialRoom, params.initialPairingToken);
      }
    } else if (params.role === 'sender') {
      // If sender opens without URL token, check if there is a valid non-expired enrolled credential for the target room
      const cleanInitialRoom = params.initialRoomId
        ? normalizeRoomCode(params.initialRoomId)
        : undefined;
      const savedCreds = loadPhoneEnrolledCredentials().filter(
        (c) => Date.now() < c.expiresAtMs
      );
      const matchingCred = cleanInitialRoom
        ? savedCreds.find((c) => normalizeRoomCode(c.roomId) === cleanInitialRoom)
        : savedCreds[0];
      if (matchingCred) {
        setRoomId(matchingCred.roomId);
        connectSignalling(
          matchingCred.roomId,
          '',
          matchingCred.deviceName,
          matchingCred
        );
      } else {
        setState('WAITING_FOR_PEER');
      }
    }

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (signallingReconnectTimerRef.current) {
        clearTimeout(signallingReconnectTimerRef.current);
        signallingReconnectTimerRef.current = null;
      }
      if (clientPingTimerRef.current) {
        clearInterval(clientPingTimerRef.current);
        clientPingTimerRef.current = null;
      }
      cleanupPeerConnection();
      stopLocalMedia();
      if (wsRef.current) {
        try {
          wsRef.current.onclose = null;
          wsRef.current.close();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  return {
    tvId,
    roomId,
    setRoomId,
    pairingToken,
    setPairingToken,
    pairingExpiresAtMs,
    sessionExpiresAtMs,
    maxSessionExpiresAtMs,
    trustedDevices,
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
    notifyTvVideoPlaying,
    remoteStream,
    localStream,
    facingMode,
    requestPhonePairing,
    reconnectAsTrustedPhone,
    startCameraBroadcast,
    stopCameraBroadcastOnly,
    disconnectStream,
    regenerateRoom,
    connectSignalling,
    approvePendingPairingOnTv,
    rejectPendingPairingOnTv,
    revokePairingSessionOnTv,
    revokeTrustedDeviceOnTv,
    revokeAllTrustedDevicesOnTv,
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
  };
}
