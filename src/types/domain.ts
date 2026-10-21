/**
 * Domain Models & Type Contracts
 * Traceability: Gate 3 (API Contracts), Gate 6 (Technical Design)
 */

export type MandatoryPrayerKey = 'fajr' | 'syuruk' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export type ExtendedPrayerKey = 'imsak' | MandatoryPrayerKey | 'dhuha';

export interface PrayerZone {
  code: string; // e.g., 'WLY01'
  state: string; // e.g., 'Wilayah Persekutuan'
  name: string; // e.g., 'Kuala Lumpur, Putrajaya'
  lat: number; // Centroid latitude for coordinate mapping
  lng: number; // Centroid longitude for coordinate mapping
  weatherQuery: string; // MetMalaysia location_name search query
}

export interface DailyPrayerSchedule {
  hijri: string; // '1448-04-26'
  date: string; // '08-Okt-2026'
  isoDate: string; // '2026-10-08'
  day: string; // 'Thursday'
  imsak: string; // '05:42:00'
  fajr: string; // '05:52:00'
  syuruk: string; // '06:58:00'
  dhuha: string; // '07:23:00'
  dhuhr: string; // '13:04:00'
  asr: string; // '16:17:00'
  maghrib: string; // '19:04:00'
  isha: string; // '20:14:00'
}

export interface PrayerApiPayload {
  zone: string;
  zoneName: string;
  stateName: string;
  source: string;
  fetchedAt: string; // ISO timestamp
  isStale: boolean;
  isOfflineFallback?: boolean;
  days: DailyPrayerSchedule[];
}

export interface PrayerItemDisplay {
  key: MandatoryPrayerKey;
  labelBM: string;
  labelArabic: string;
  time24: string; // 'HH:MM'
  timeFull: string; // 'HH:MM:SS'
  epochMs: number;
  isCurrent: boolean;
  isNext: boolean;
}

export interface ResolvedPrayerState {
  currentPrayer: {
    key: MandatoryPrayerKey;
    labelBM: string;
    time24: string;
  } | null;
  nextPrayer: {
    key: MandatoryPrayerKey;
    labelBM: string;
    time24: string;
    targetEpochMs: number;
    isTomorrow: boolean;
  };
  countdown: {
    totalSeconds: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string; // 'HH:MM:SS'
  };
  todaySchedule: DailyPrayerSchedule;
  tomorrowSchedule: DailyPrayerSchedule;
  prayerItems: PrayerItemDisplay[];
}

export type LocationStatus =
  | 'IDLE'
  | 'DETECTING'
  | 'DETECTED'
  | 'PERMISSION_DENIED'
  | 'UNAVAILABLE'
  | 'TIMEOUT'
  | 'CHANGED'
  | 'ERROR'
  | 'MANUAL';

export interface LocationState {
  mode: 'AUTO' | 'MANUAL';
  status: LocationStatus;
  statusMessageBM: string;
  activeZone: PrayerZone;
  detectedZone: PrayerZone | null;
  coordinates: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
  } | null;
  lastUpdated: string | null;
}

export type DataFreshnessState = 'LOADING' | 'LIVE' | 'STALE' | 'UNAVAILABLE' | 'ERROR';

export interface WeatherData {
  locationId: string;
  locationName: string;
  date: string;
  morningForecast: string;
  afternoonForecast: string;
  nightForecast: string;
  summaryForecast: string;
  summaryWhen: string;
  minTemp: number;
  maxTemp: number;
  currentEstimateTemp: number;
  conditionCode: 'CLEAR' | 'CLOUDY' | 'RAIN' | 'THUNDERSTORM';
  source: string;
  fetchedAt: string;
  isStale: boolean;
}

export interface IslamicEventItem {
  id: string;
  hijriMonth: number; // 1..12
  hijriDay: number; // 1..30
  hijriDateDisplay: string;
  titleBM: string;
  descriptionBM: string;
  category: 'WAJIB_SUNAT_MUAKKAD' | 'KEBESARAN_ISLAM' | 'AMALAN_BULANAN';
  sourceReference: string;
  isExactToday: boolean;
}

export interface MalaysianHistoryItem {
  id: string;
  month: number; // 1..12
  day: number; // 1..31
  year: number;
  dateDisplayBM: string;
  titleBM: string;
  descriptionBM: string;
  sourceReference: string;
  isExactDateMatch: boolean;
}

export interface DailyZikirItem {
  id: string;
  dayIndex: number; // 0..6 or 1..10
  titleBM: string;
  arabicText: string;
  transliterationBM: string;
  translationBM: string;
  recommendedCount: string;
  sourceReference: string;
}

export type StreamingLifecycleState =
  | 'INITIALIZING'
  | 'REQUESTING_CAMERA'
  | 'WAITING_FOR_PEER'
  | 'SIGNALING'
  | 'NEGOTIATING'
  | 'GATHERING_ICE'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'WAITING_FOR_STREAM'
  | 'STREAMING'
  | 'RECONNECTING'
  | 'STOPPING'
  | 'RETURNING_TO_PRAYER_DISPLAY'
  | 'PRAYER_DISPLAY'
  | 'DISCONNECTED'
  | 'FAILED'
  | 'CLOSED'
  | 'WAITING'
  | 'PAIRING';

export type StreamingFailureCategory =
  | 'NONE'
  | 'CAMERA_PERMISSION_DENIED'
  | 'CAMERA_UNAVAILABLE'
  | 'SIGNALING_UNAVAILABLE'
  | 'PEER_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'MAX_SESSION_DURATION_EXCEEDED'
  | 'PAIRING_TOKEN_INVALID'
  | 'PAIRING_REJECTED_BY_TV'
  | 'SESSION_REVOKED'
  | 'TRUSTED_CREDENTIAL_INVALID'
  | 'TRUSTED_CREDENTIAL_EXPIRED'
  | 'TRUSTED_DEVICE_REVOKED'
  | 'UNAUTHORIZED_COMMAND'
  | 'REPLAY_DETECTED'
  | 'PROHIBITED_SIGNALLING_COMMAND'
  | 'NON_LAN_CANDIDATE_REJECTED'
  | 'LAN_UNREACHABLE_OR_ISOLATED'
  | 'SDP_NEGOTIATION_FAILED'
  | 'ICE_NEGOTIATION_FAILED'
  | 'NO_VIABLE_ICE_CANDIDATE'
  | 'TURN_RELAY_UNAVAILABLE'
  | 'MEDIA_TRACK_NOT_RECEIVED'
  | 'VIDEO_PLAYBACK_FAILED'
  | 'CONNECTION_TIMED_OUT'
  | 'CONNECTION_INTERRUPTED';

export type PairingAuthorizationStatus =
  | 'AWAITING_PHONE'
  | 'PENDING_TV_APPROVAL'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED';

export interface TrustedDeviceRecord {
  deviceId: string;
  deviceName: string;
  tvId: string;
  secretKeyHex: string;
  enrolledAtMs: number;
  expiresAtMs: number; // 14-day TTL from enrollment
  lastConnectedAtMs: number;
  revoked: boolean;
}

export interface EnrolledPhoneCredential {
  deviceId: string;
  deviceName: string;
  tvId: string;
  roomId: string;
  secretKeyHex: string;
  enrolledAtMs: number;
  expiresAtMs: number; // 14-day TTL
}

export type VideoResolutionPreset = '480p' | '720p' | '1080p';
export type VideoFrameRatePreset = 15 | 24 | 30;
export type VideoFitMode = 'contain' | 'cover' | 'blurred';
export type OverlayDensity = 'standard' | 'compact' | 'minimal';
export type VideoOrientationMode = 'auto' | 'portrait' | 'landscape';
export type VideoRotationDegrees = 0 | 90 | 180 | 270;

export interface VideoTrackStats {
  width: number;
  height: number;
  frameRate: number;
  aspectRatio: number;
  facingMode?: string;
  targetResolution: VideoResolutionPreset;
  targetFps: VideoFrameRatePreset;
  isActualSupported: boolean;
  actualQualityLabelBM: string;
}

export interface AnnouncementItem {
  id: string;
  title?: string;
  message: string;
  priority: 'NORMAL' | 'IMPORTANT' | 'URGENT';
  enabled: boolean;
  startAtIso?: string;
  expiresAtIso?: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface TickerConfig {
  speed: 'SLOW' | 'NORMAL' | 'FAST'; // 45s, 30s, 18s duration
  staticFallbackText: string;
  enabled: boolean;
}

export type LanRemoteCommandAction =
  | 'SWITCH_VIEW_STREAM'
  | 'SWITCH_VIEW_PRIMARY'
  | 'START_STREAM'
  | 'STOP_STREAM'
  | 'PING_STATE'
  | 'RENEW_SESSION'
  | 'SET_FIT_MODE'
  | 'SYNC_ANNOUNCEMENTS'
  | 'SET_OVERLAY_DENSITY'
  | 'SET_THEATRE_MODE'
  | 'SET_ORIENTATION'
  | 'SET_ROTATION';

export type CommandDeliveryStatus =
  | 'IDLE'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'REJECTED'
  | 'TIMED_OUT';

export interface LanControlCommandMessage {
  type: 'lan-control-command';
  roomId: string;
  sessionToken: string;
  action: LanRemoteCommandAction;
  seq: number;
  timestampMs: number;
  senderDeviceName?: string;
  payload?: Record<string, unknown>;
}

export interface LanControlAckMessage {
  type: 'lan-control-ack';
  roomId: string;
  seq: number;
  action: LanRemoteCommandAction;
  accepted: boolean;
  reason?: string;
  resultingView: 'primary' | 'stream';
  streamingActive: boolean;
  mediaPlayingOnTv?: boolean;
  sessionExpiresAtMs?: number;
  maxSessionExpiresAtMs?: number;
  timestampMs: number;
  fitMode?: VideoFitMode;
  theatreMode?: boolean;
  overlayDensity?: OverlayDensity;
  orientationMode?: VideoOrientationMode;
  rotationDegrees?: VideoRotationDegrees;
  announcements?: AnnouncementItem[];
  tickerConfig?: TickerConfig;
}

export interface TvStateSyncMessage {
  type: 'tv-state-sync';
  roomId: string;
  activeView: 'primary' | 'stream';
  streamingActive: boolean;
  mediaPlayingOnTv: boolean;
  sessionExpiresAtMs: number;
  maxSessionExpiresAtMs?: number;
  isTrustedSession?: boolean;
  timestampMs: number;
  fitMode?: VideoFitMode;
  theatreMode?: boolean;
  overlayDensity?: OverlayDensity;
  orientationMode?: VideoOrientationMode;
  rotationDegrees?: VideoRotationDegrees;
  announcements?: AnnouncementItem[];
  tickerConfig?: TickerConfig;
}

export interface StreamingDiagnostics {
  signalingConnected: boolean;
  roomId: string;
  role: 'display' | 'sender';
  hasDisplayPeer: boolean;
  hasSenderPeer: boolean;
  sdpOfferSentOrReceived: boolean;
  sdpAnswerSentOrReceived: boolean;
  iceGatheringState: string;
  iceConnectionState: string;
  peerConnectionState: string;
  dataChannelState: string;
  authorizationStatus: PairingAuthorizationStatus;
  localCandidateTypes: string[];
  remoteCandidateTypes: string[];
  rejectedNonHostCandidates: number;
  queuedCandidatesFlushed: number;
  localTrackCount: number;
  remoteTrackCount: number;
  lastCommandSeq: number;
  failureCategory: StreamingFailureCategory;
  lastStageTimestamp: string;
}



