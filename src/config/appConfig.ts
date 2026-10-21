/**
 * Central Application Configuration
 * Traceability: Section 17 (Configuration), NFR-001, NFR-002, SEC-LAN-001
 */

export const APP_CONFIG = {
  appName: 'Display Waktu Solat Malaysia',
  timezone: 'Asia/Kuala_Lumpur',
  defaultZoneCode: 'WLY01',

  // API Endpoints (Internal Proxy Routes)
  api: {
    prayerTimes: '/api/prayer-times',
    weather: '/api/weather',
    health: '/api/health',
    webrtcConfig: '/api/webrtc-config',
    signallingPath: '/ws/signalling',
    requestTimeoutMs: 9000,
  },

  // Refresh & Cache Intervals (Milliseconds)
  intervals: {
    clockTickMs: 1000,
    prayerRefreshMs: 60 * 60 * 1000, // Refresh JAKIM data every 1 hour
    prayerStaleThresholdMs: 12 * 60 * 60 * 1000, // Mark stale after 12 hours without fresh sync
    prayerCacheRetentionMs: 7 * 24 * 60 * 60 * 1000, // Keep offline cache for 7 days
    weatherRefreshMs: 30 * 60 * 1000, // Refresh MetMalaysia every 30 minutes
    weatherStaleThresholdMs: 3 * 60 * 60 * 1000, // Mark weather stale after 3 hours
    weatherCacheRetentionMs: 12 * 60 * 60 * 1000,
    watchdogCheckMs: 60 * 1000, // 60s health/rollover watchdog
  },

  // Storage Keys
  storageKeys: {
    activeZoneCode: 'dws_active_zone_code_v1',
    locationMode: 'dws_location_mode_v1',
    lastDetectedCoords: 'dws_detected_coords_v1',
    prayerSchedulePrefix: 'dws_prayer_schedule_v1_',
    weatherPrefix: 'dws_weather_v1_',
    tvIdentityId: 'dws_tv_identity_id_v1',
    tvTrustedDevices: 'dws_tv_trusted_devices_v1',
    phoneEnrolledCredentials: 'dws_phone_enrolled_creds_v1',
    announcements: 'dws_announcements_v1',
    tickerConfig: 'dws_ticker_config_v1',
    fitMode: 'dws_fit_mode_v1',
    theatreMode: 'dws_theatre_mode_v1',
    overlayDensity: 'dws_overlay_density_v1',
  },

  // SEC-LAN-001 & SEC-LAN-002 Mandatory Local-Only WebRTC, Pairing & Trusted-Device Policy
  // Constraint #3: ZERO public STUN or TURN servers permitted.
  // Constraint #4: All remote-control commands must use the authenticated direct RTCDataChannel.
  // SEC-LAN-002: 14-day trusted device TTL, 30m session TTL, 4h max continuous session, 90s idle token rotation.
  webrtc: {
    iceServers: [] as RTCIceServer[], // Strictly empty (Host-Only ICE, Zero STUN/TURN)
    dataChannelLabel: 'dws-lan-control-v1',
    pairingTokenTtlMs: 2 * 60 * 1000, // 2 minutes short-lived pairing token TTL
    pairingTokenRotateIntervalMs: 90 * 1000, // Rotate idle pairing token every 90s before 2m expiry
    authorizedSessionTtlMs: 30 * 60 * 1000, // 30 minutes active LAN control session TTL
    maxContinuousSessionMs: 4 * 60 * 60 * 1000, // 4 hours maximum continuous session duration before mandatory reauthentication
    trustedDeviceTtlMs: 14 * 24 * 60 * 60 * 1000, // 14 days trusted administrator device credential TTL
    commandReplayWindowMs: 30 * 1000, // 30s timestamp freshness window
    reconnectDelayMs: 3000,
    maxReconnectAttempts: 5,
  },
} as const;

