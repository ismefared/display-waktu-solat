/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_CONFIG } from './config/appConfig';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileSenderView } from './components/MobileSenderView';
import { PrimaryDisplayView } from './components/PrimaryDisplayView';
import { StreamReceiverView } from './components/StreamReceiverView';
import { TopBar } from './components/TopBar';
import { TvPairingOverlay } from './components/TvPairingOverlay';
import { ZoneSelectorModal } from './components/ZoneSelectorModal';
import {
  parseAndFormatHijriDateBM,
  resolvePrayerState,
} from './domain/prayerEngine';
import { normalizeRoomCode } from './domain/webrtcUtils';
import { useMalaysiaTime } from './hooks/useMalaysiaTime';
import { useWebRTCStream } from './hooks/useWebRTCStream';
import { ContentService } from './services/contentService';
import { LocationService } from './services/locationService';
import { PrayerService } from './services/prayerService';
import { StorageService } from './services/storageService';
import { WeatherService } from './services/weatherService';
import {
  DataFreshnessState,
  LanRemoteCommandAction,
  LocationState,
  PrayerApiPayload,
  WeatherData,
} from './types/domain';

export default function App() {
  // Determine initial view mode from URL parameters (?mode=sender&room=XXXXXX&token=YYYYYY)
  const initialUrlParams = useMemo(() => {
    if (typeof window === 'undefined') {
      return { view: 'primary' as const, room: undefined, token: undefined };
    }
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const rawRoom = params.get('room');
    const room = rawRoom ? normalizeRoomCode(rawRoom) : undefined;
    const token = params.get('token') || undefined;
    if (mode === 'sender') {
      return { view: 'sender' as const, room, token };
    }
    if (mode === 'stream') {
      return { view: 'stream' as const, room, token };
    }
    return { view: 'primary' as const, room, token };
  }, []);

  const [activeView, setActiveView] = useState<'primary' | 'stream' | 'sender'>(
    initialUrlParams.view
  );
  const [senderRoomId, setSenderRoomId] = useState<string | undefined>(
    initialUrlParams.room
  );
  const [senderPairingToken, setSenderPairingToken] = useState<
    string | undefined
  >(initialUrlParams.token);

  // Malaysia Standard Time wall-clock engine (UTC+8)
  const { nowEpochMs, dateParts } = useMalaysiaTime();

  // Persistent TV Display WebRTC & SEC-LAN-001 Remote Control Session
  // Runs across both 'primary' (Paparan Waktu Solat) and 'stream' (Paparan Siaran Langsung)
  // so a phone can pair and switch TV views without requiring manual TV mouse/keyboard navigation.
  const handleRemoteCommandExecuted = useCallback(
    (action: LanRemoteCommandAction) => {
      if (action === 'SWITCH_VIEW_PRIMARY' || action === 'STOP_STREAM') {
        setActiveView('primary');
      } else if (
        action === 'SWITCH_VIEW_STREAM' ||
        action === 'START_STREAM'
      ) {
        setActiveView('stream');
      }
    },
    []
  );

  const displayWebrtc = useWebRTCStream({
    role: 'display',
    enabled: activeView !== 'sender',
    activeTvView: activeView === 'stream' ? 'stream' : 'primary',
    onRemoteCommandExecuted: handleRemoteCommandExecuted,
    onStreamEnded: () => setActiveView('primary'),
  });

  // Automatically switch TV to Stream View if an authorized phone begins transmitting live video tracks
  useEffect(() => {
    if (
      activeView === 'primary' &&
      displayWebrtc.authorizationStatus === 'AUTHORIZED' &&
      (displayWebrtc.remoteStream || displayWebrtc.state === 'STREAMING')
    ) {
      setActiveView('stream');
    }
  }, [
    activeView,
    displayWebrtc.authorizationStatus,
    displayWebrtc.remoteStream,
    displayWebrtc.state,
  ]);

  // Gate 13: Automatically return to main prayer display when stream ends, is stopped, or revoked
  useEffect(() => {
    if (
      activeView === 'stream' &&
      (displayWebrtc.state === 'RETURNING_TO_PRAYER_DISPLAY' ||
        displayWebrtc.authorizationStatus === 'REVOKED')
    ) {
      setActiveView('primary');
    }
  }, [activeView, displayWebrtc.state, displayWebrtc.authorizationStatus]);

  // Location & Active JAKIM Prayer Zone State (LOC-001, LOC-002)
  const [locationState, setLocationState] = useState<LocationState>(() =>
    LocationService.getInitialLocationState()
  );
  const [isZoneModalOpen, setIsZoneModalOpen] = useState<boolean>(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);

  // Prayer Schedule State (PR-001)
  const [prayerPayload, setPrayerPayload] = useState<PrayerApiPayload | null>(
    null
  );
  const [prayerFreshness, setPrayerFreshness] = useState<'LIVE' | 'STALE'>(
    'LIVE'
  );
  const [prayerErrorNotice, setPrayerErrorNotice] = useState<string | null>(
    null
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Weather State (WX-001 - Independent from Prayer State)
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherState, setWeatherState] =
    useState<DataFreshnessState>('LOADING');
  const [weatherStatusBM, setWeatherStatusBM] = useState<string>(
    'Memuatkan data cuaca rasmi MetMalaysia...'
  );

  // Fullscreen Kiosk State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Track current ISO date for automatic midnight rollover refresh
  const lastIsoDateRef = useRef<string>(dateParts.isoDate);

  // Fetch both Prayer Schedule and Weather independently for a given zone
  const loadDataForZone = useCallback(async (zoneCode: string) => {
    setIsRefreshing(true);

    // Priority 1: Prayer Times (JAKIM)
    PrayerService.fetchPrayerSchedule(zoneCode)
      .then((res) => {
        setPrayerPayload(res.payload);
        setPrayerFreshness(res.freshness);
        setPrayerErrorNotice(res.errorNotice);
      })
      .finally(() => {
        setIsRefreshing(false);
      });

    // Priority 5: Weather (MetMalaysia - completely isolated)
    setWeatherState((prev) => (prev === 'LIVE' ? 'LIVE' : 'LOADING'));
    WeatherService.fetchWeatherForZone(zoneCode).then((wx) => {
      setWeatherData(wx.data);
      setWeatherState(wx.state);
      setWeatherStatusBM(wx.statusMessageBM);
    });
  }, []);

  // Initial startup: load zone data & attempt automatic location detection if no manual lock exists
  useEffect(() => {
    const hasSavedManualZone = Boolean(
      StorageService.getRawString(APP_CONFIG.storageKeys.activeZoneCode)
    );

    loadDataForZone(locationState.activeZone.code);

    // If first boot without a saved manual zone, attempt automatic geolocation once (LOC-001)
    if (!hasSavedManualZone) {
      setIsDetectingLocation(true);
      LocationService.requestDeviceLocation(locationState.activeZone, true)
        .then((nextLoc) => {
          setLocationState(nextLoc);
          if (nextLoc.activeZone.code !== locationState.activeZone.code) {
            loadDataForZone(nextLoc.activeZone.code);
          }
        })
        .finally(() => {
          setIsDetectingLocation(false);
        });
    }
  }, []);

  // Periodic background refresh for 24/7 operation (Prayer every 60m, Weather every 30m)
  useEffect(() => {
    const activeCode = locationState.activeZone.code;

    const prayerTimer = setInterval(() => {
      PrayerService.fetchPrayerSchedule(activeCode).then((res) => {
        setPrayerPayload(res.payload);
        setPrayerFreshness(res.freshness);
        setPrayerErrorNotice(res.errorNotice);
      });
    }, APP_CONFIG.intervals.prayerRefreshMs);

    const weatherTimer = setInterval(() => {
      WeatherService.fetchWeatherForZone(activeCode).then((wx) => {
        setWeatherData(wx.data);
        setWeatherState(wx.state);
        setWeatherStatusBM(wx.statusMessageBM);
      });
    }, APP_CONFIG.intervals.weatherRefreshMs);

    return () => {
      clearInterval(prayerTimer);
      clearInterval(weatherTimer);
    };
  }, [locationState.activeZone.code]);

  // Midnight date rollover detector (Section 34 & Gate 9)
  useEffect(() => {
    if (dateParts.isoDate !== lastIsoDateRef.current) {
      lastIsoDateRef.current = dateParts.isoDate;
      loadDataForZone(locationState.activeZone.code);
    }
  }, [dateParts.isoDate, loadDataForZone, locationState.activeZone.code]);

  // Resolve real-time prayer state and countdown every second from validated schedule
  const resolvedPrayer = useMemo(() => {
    if (!prayerPayload || !prayerPayload.days.length) return null;
    return resolvePrayerState(prayerPayload.days, nowEpochMs);
  }, [prayerPayload, nowEpochMs]);

  // Resolve verified Islamic Event, Malaysian History, and Deterministic Daily Zikir
  const contextualContent = useMemo(() => {
    const hijriParsed = parseAndFormatHijriDateBM(
      resolvedPrayer?.todaySchedule.hijri || '1448-04-26'
    );
    return ContentService.getContextualContentForDay({
      gregorianYear: dateParts.year,
      gregorianMonth: dateParts.month,
      gregorianDay: dateParts.day,
      hijriYear: hijriParsed.year,
      hijriMonth: hijriParsed.month,
      hijriDay: hijriParsed.day,
    });
  }, [
    dateParts.year,
    dateParts.month,
    dateParts.day,
    resolvedPrayer?.todaySchedule.hijri,
  ]);

  const handleSelectManualZone = useCallback(
    (zoneCode: string) => {
      const nextLoc = LocationService.saveManualZoneSelection(zoneCode);
      setLocationState(nextLoc);
      loadDataForZone(nextLoc.activeZone.code);
    },
    [loadDataForZone]
  );

  const handleTriggerAutoDetect = useCallback(() => {
    setIsDetectingLocation(true);
    LocationService.requestDeviceLocation(locationState.activeZone, true)
      .then((nextLoc) => {
        setLocationState(nextLoc);
        loadDataForZone(nextLoc.activeZone.code);
      })
      .finally(() => {
        setIsDetectingLocation(false);
      });
  }, [loadDataForZone, locationState.activeZone]);

  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;
    if (!document.fullscreenElement) {
      document.documentElement
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  return (
    <ErrorBoundary>
      <div className="app-viewport-shell bg-[#060D0C] text-slate-50 justify-between selection:bg-amber-400 selection:text-slate-950">
        {/* 3-Zone Top Bar (Hidden in Active Immersive Theatre Mode to maximize video area) */}
        {!(
          activeView === 'stream' &&
          displayWebrtc.theatreMode !== false &&
          (displayWebrtc.state === 'STREAMING' ||
            Boolean(displayWebrtc.remoteStream) ||
            displayWebrtc.tvMediaPlaying)
        ) && (
          <TopBar
            activeView={activeView}
            onSelectView={(nextView) => {
              if (nextView === 'sender') {
                setSenderRoomId(displayWebrtc.roomId);
                setSenderPairingToken(displayWebrtc.pairingToken);
              }
              setActiveView(nextView);
            }}
            locationState={locationState}
            onOpenZoneModal={() => setIsZoneModalOpen(true)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={handleToggleFullscreen}
          />
        )}

        {/* View Router */}
        {activeView === 'primary' && (
          <PrimaryDisplayView
            dateParts={dateParts}
            prayerPayload={prayerPayload}
            prayerFreshness={prayerFreshness}
            prayerErrorNotice={prayerErrorNotice}
            resolvedPrayer={resolvedPrayer}
            locationState={locationState}
            onOpenZoneModal={() => setIsZoneModalOpen(true)}
            onRefreshData={() => loadDataForZone(locationState.activeZone.code)}
            isRefreshing={isRefreshing}
            weatherData={weatherData}
            weatherState={weatherState}
            weatherStatusBM={weatherStatusBM}
            islamicEvent={contextualContent.islamicEvent}
            malaysianHistory={contextualContent.malaysianHistory}
            dailyZikir={contextualContent.dailyZikir}
          />
        )}

        {activeView === 'stream' && (
          <StreamReceiverView
            dateParts={dateParts}
            resolvedPrayer={resolvedPrayer}
            locationState={locationState}
            webrtc={displayWebrtc}
            onReturnToPrimary={() => setActiveView('primary')}
            onSwitchToSenderMode={(room, token) => {
              setSenderRoomId(room);
              setSenderPairingToken(token);
              setActiveView('sender');
            }}
          />
        )}

        {activeView === 'sender' && (
          <MobileSenderView
            initialRoomId={senderRoomId || displayWebrtc.roomId}
            initialPairingToken={
              senderPairingToken || displayWebrtc.pairingToken
            }
            onReturnToDisplay={() => setActiveView('primary')}
          />
        )}

        {/* Non-Intrusive TV Pairing Dock & Mandatory TV Approval Modal (Active on TV Views) */}
        {activeView !== 'sender' && (
          <TvPairingOverlay
            roomId={displayWebrtc.roomId}
            pairingToken={displayWebrtc.pairingToken}
            pairingExpiresAtMs={displayWebrtc.pairingExpiresAtMs}
            sessionExpiresAtMs={displayWebrtc.sessionExpiresAtMs}
            maxSessionExpiresAtMs={displayWebrtc.maxSessionExpiresAtMs}
            trustedDevices={displayWebrtc.trustedDevices}
            authorizationStatus={displayWebrtc.authorizationStatus}
            streamState={displayWebrtc.state}
            diagnostics={displayWebrtc.diagnostics}
            peerDeviceName={displayWebrtc.peerDeviceName}
            nowEpochMs={nowEpochMs}
            onApprovePairing={displayWebrtc.approvePendingPairingOnTv}
            onRejectPairing={displayWebrtc.rejectPendingPairingOnTv}
            onRevokeSession={displayWebrtc.revokePairingSessionOnTv}
            onRevokeTrustedDevice={displayWebrtc.revokeTrustedDeviceOnTv}
            onRevokeAllTrustedDevices={displayWebrtc.revokeAllTrustedDevicesOnTv}
            onRegenerateRoom={displayWebrtc.regenerateRoom}
            hideDock={
              activeView === 'stream' &&
              (displayWebrtc.state === 'STREAMING' ||
                Boolean(displayWebrtc.remoteStream) ||
                displayWebrtc.tvMediaPlaying)
            }
          />
        )}

        {/* Zone Selection & Geolocation Modal */}
        <ZoneSelectorModal
          isOpen={isZoneModalOpen}
          onClose={() => setIsZoneModalOpen(false)}
          locationState={locationState}
          onSelectManualZone={handleSelectManualZone}
          onTriggerAutoDetect={handleTriggerAutoDetect}
          isDetecting={isDetectingLocation}
        />
      </div>
    </ErrorBoundary>
  );
}
