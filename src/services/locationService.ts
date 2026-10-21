import { APP_CONFIG } from '../config/appConfig';
import { getZoneByCode } from '../data/jakimZones';
import { mapCoordinatesToJakimZone } from '../domain/zoneMapper';
import { LocationState, PrayerZone } from '../types/domain';
import { StorageService } from './storageService';

/**
 * Location Detection & Manual Zone Fallback Service
 * Policy Compliance: Section 5 (LOC-001, LOC-002), Section 19, Section 35
 * Never silently overrides a user's manual selection.
 */

export class LocationService {
  static getInitialLocationState(): LocationState {
    const savedZoneCode =
      StorageService.getRawString(APP_CONFIG.storageKeys.activeZoneCode) ||
      APP_CONFIG.defaultZoneCode;
    const savedMode =
      (StorageService.getRawString(APP_CONFIG.storageKeys.locationMode) as
        | 'AUTO'
        | 'MANUAL') || 'MANUAL';

    const activeZone = getZoneByCode(savedZoneCode);

    return {
      mode: savedMode,
      status: savedMode === 'MANUAL' ? 'MANUAL' : 'IDLE',
      statusMessageBM:
        savedMode === 'MANUAL'
          ? `Zon Pilihan Manual: ${activeZone.code} — ${activeZone.name}`
          : `Zon Lalai: ${activeZone.code} — ${activeZone.name}`,
      activeZone,
      detectedZone: null,
      coordinates: null,
      lastUpdated: null,
    };
  }

  static saveManualZoneSelection(zoneCode: string): LocationState {
    const zone = getZoneByCode(zoneCode);
    StorageService.setRawString(APP_CONFIG.storageKeys.activeZoneCode, zone.code);
    StorageService.setRawString(APP_CONFIG.storageKeys.locationMode, 'MANUAL');

    return {
      mode: 'MANUAL',
      status: 'MANUAL',
      statusMessageBM: `Zon Pilihan Manual: ${zone.code} (${zone.state})`,
      activeZone: zone,
      detectedZone: null,
      coordinates: null,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Requests browser geolocation once and maps coordinates to an official JAKIM zone.
   * Distinguishes: DETECTED, PERMISSION_DENIED, UNAVAILABLE, TIMEOUT, CHANGED, ERROR.
   */
  static requestDeviceLocation(
    currentActiveZone: PrayerZone,
    applyImmediately: boolean = true
  ): Promise<LocationState> {
    return new Promise((resolve) => {
      if (
        typeof window === 'undefined' ||
        !('geolocation' in navigator) ||
        !navigator.geolocation
      ) {
        resolve({
          mode: 'MANUAL',
          status: 'UNAVAILABLE',
          statusMessageBM:
            'Perkhidmatan lokasi tidak disokong oleh pelayar ini. Menggunakan zon pilihan manual.',
          activeZone: currentActiveZone,
          detectedZone: null,
          coordinates: null,
          lastUpdated: new Date().toISOString(),
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracyMeters = Math.round(position.coords.accuracy || 0);

          const mapped = mapCoordinatesToJakimZone(lat, lng);
          const detectedZone = mapped.zone;
          const hasChanged = detectedZone.code !== currentActiveZone.code;

          const nextActiveZone = applyImmediately ? detectedZone : currentActiveZone;

          if (applyImmediately) {
            StorageService.setRawString(
              APP_CONFIG.storageKeys.activeZoneCode,
              nextActiveZone.code
            );
            StorageService.setRawString(APP_CONFIG.storageKeys.locationMode, 'AUTO');
          }

          resolve({
            mode: applyImmediately ? 'AUTO' : 'MANUAL',
            status: hasChanged ? 'CHANGED' : 'DETECTED',
            statusMessageBM: mapped.withinMalaysia
              ? hasChanged
                ? `Lokasi baharu dikesan: Ditukar ke ${detectedZone.code} (${detectedZone.name})`
                : `Lokasi dikesan secara automatik: ${detectedZone.code} (${detectedZone.name})`
              : `Koordinat di luar Malaysia dikesan — dipetakan ke zon terdekat ${detectedZone.code}`,
            activeZone: nextActiveZone,
            detectedZone,
            coordinates: { lat, lng, accuracyMeters },
            lastUpdated: new Date().toISOString(),
          });
        },
        (error) => {
          let status: LocationState['status'] = 'ERROR';
          let statusMessageBM =
            'Ralat perkhidmatan lokasi. Sila pilih zon waktu solat secara manual.';

          if (error.code === 1) {
            // PERMISSION_DENIED
            status = 'PERMISSION_DENIED';
            statusMessageBM =
              'Kebenaran lokasi ditolak. Menggunakan zon pilihan manual.';
          } else if (error.code === 2) {
            // POSITION_UNAVAILABLE
            status = 'UNAVAILABLE';
            statusMessageBM =
              'Maklumat lokasi peranti tidak tersedia. Menggunakan zon pilihan manual.';
          } else if (error.code === 3) {
            // TIMEOUT
            status = 'TIMEOUT';
            statusMessageBM =
              'Permintaan lokasi tamat masa (Timeout). Menggunakan zon pilihan manual.';
          }

          resolve({
            mode: 'MANUAL',
            status,
            statusMessageBM,
            activeZone: currentActiveZone,
            detectedZone: null,
            coordinates: null,
            lastUpdated: new Date().toISOString(),
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 15 * 60 * 1000, // Cache GPS fix for 15 minutes
        }
      );
    });
  }
}
