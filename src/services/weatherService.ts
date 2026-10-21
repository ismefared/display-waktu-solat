import { APP_CONFIG } from '../config/appConfig';
import { getZoneByCode } from '../data/jakimZones';
import { DataFreshnessState, WeatherData } from '../types/domain';
import { StorageService } from './storageService';

/**
 * Authoritative Malaysian Weather Service (MetMalaysia via api.data.gov.my)
 * Policy Compliance: Section 10, Section 20, Section 38 (Isolated from Prayer Display)
 * Traceability: WX-001, NFR-001
 */

export function classifyWeatherCondition(
  summaryText: string
): WeatherData['conditionCode'] {
  const lower = (summaryText || '').toLowerCase();
  if (lower.includes('tiada hujan') || lower.includes('cerah')) {
    return 'CLEAR';
  }
  if (lower.includes('ribut') || lower.includes('petir')) {
    return 'THUNDERSTORM';
  }
  if (lower.includes('hujan') || lower.includes('lembap')) {
    return 'RAIN';
  }
  if (lower.includes('mendung') || lower.includes('berawan')) {
    return 'CLOUDY';
  }
  return 'CLEAR';
}

export class WeatherService {
  static async fetchWeatherForZone(zoneCode: string): Promise<{
    data: WeatherData | null;
    state: DataFreshnessState;
    statusMessageBM: string;
  }> {
    const zone = getZoneByCode(zoneCode);
    const cacheKey = `${APP_CONFIG.storageKeys.weatherPrefix}${zone.code}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        APP_CONFIG.api.requestTimeoutMs
      );

      const response = await fetch(
        `${APP_CONFIG.api.weather}?zone=${encodeURIComponent(zone.code)}&query=${encodeURIComponent(zone.weatherQuery)}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Weather API HTTP ${response.status}`);
      }

      const raw = (await response.json()) as Omit<
        WeatherData,
        'conditionCode' | 'currentEstimateTemp'
      >;

      if (!raw || !raw.locationName) {
        throw new Error('Respons data cuaca tidak lengkap');
      }

      const minTemp = Number.isFinite(raw.minTemp) ? raw.minTemp : 24;
      const maxTemp = Number.isFinite(raw.maxTemp) ? raw.maxTemp : 32;
      const currentEstimateTemp = Math.round((minTemp + maxTemp) / 2);

      const weatherData: WeatherData = {
        ...raw,
        minTemp,
        maxTemp,
        currentEstimateTemp,
        conditionCode: classifyWeatherCondition(raw.summaryForecast),
      };

      StorageService.setItem(cacheKey, weatherData, weatherData.fetchedAt);

      return {
        data: weatherData,
        state: weatherData.isStale ? 'STALE' : 'LIVE',
        statusMessageBM: weatherData.isStale
          ? 'Data cuaca daripada cache pelayan (MetMalaysia)'
          : 'Data cuaca rasmi MetMalaysia terkini',
      };
    } catch {
      // Check cached weather in localStorage
      const cached = StorageService.getItem<WeatherData>(
        cacheKey,
        APP_CONFIG.intervals.weatherStaleThresholdMs,
        APP_CONFIG.intervals.weatherCacheRetentionMs
      );

      if (cached && cached.data) {
        return {
          data: {
            ...cached.data,
            isStale: true,
          },
          state: 'STALE',
          statusMessageBM: 'Data cuaca terakhir disimpan (Lapuk / Luar Talian)',
        };
      }

      return {
        data: null,
        state: 'UNAVAILABLE',
        statusMessageBM: 'Maklumat cuaca MetMalaysia tidak tersedia buat sementara waktu.',
      };
    }
  }
}
