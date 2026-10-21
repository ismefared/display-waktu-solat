import { APP_CONFIG } from '../config/appConfig';
import { StorageService } from './storageService';
import { AnnouncementItem, TickerConfig } from '../types/domain';

export const DEFAULT_TICKER_CONFIG: TickerConfig = {
  speed: 'NORMAL',
  staticFallbackText:
    'Sila lurus dan rapatkan saf serta senyapkan telefon bimbit anda di dalam dewan solat.',
  enabled: true,
};

export const DEFAULT_ANNOUNCEMENTS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    title: 'Adab Solat',
    message: 'Sila lurus dan rapatkan saf sebelum memulakan solat berjemaah.',
    priority: 'NORMAL',
    enabled: true,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  },
  {
    id: 'ann-2',
    title: 'Kuliah Maghrib',
    message: 'Kuliah Maghrib Khas bersama penceramah jemputan pada setiap malam Jumaat.',
    priority: 'IMPORTANT',
    enabled: true,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  },
  {
    id: 'ann-3',
    title: 'Peringatan',
    message: 'Mohon matikan atau senyapkan nada dering telefon bimbit anda di dalam masjid.',
    priority: 'NORMAL',
    enabled: true,
    createdAtMs: 1700000000000,
    updatedAtMs: 1700000000000,
  },
];

export class AnnouncementService {
  /**
   * Load all stored announcements or return default seeded announcements
   */
  static loadAnnouncements(): AnnouncementItem[] {
    try {
      const raw = StorageService.getRawString(APP_CONFIG.storageKeys.announcements);
      if (!raw) {
        this.saveAnnouncements(DEFAULT_ANNOUNCEMENTS);
        return DEFAULT_ANNOUNCEMENTS;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
      return DEFAULT_ANNOUNCEMENTS;
    } catch {
      return DEFAULT_ANNOUNCEMENTS;
    }
  }

  /**
   * Persist announcements list to approved storage architecture
   */
  static saveAnnouncements(items: AnnouncementItem[]): void {
    try {
      StorageService.setRawString(
        APP_CONFIG.storageKeys.announcements,
        JSON.stringify(items)
      );
    } catch {
      // Storage exceptions ignored gracefully
    }
  }

  /**
   * Load ticker configuration
   */
  static loadTickerConfig(): TickerConfig {
    try {
      const raw = StorageService.getRawString(APP_CONFIG.storageKeys.tickerConfig);
      if (!raw) return DEFAULT_TICKER_CONFIG;
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_TICKER_CONFIG,
        ...parsed,
      };
    } catch {
      return DEFAULT_TICKER_CONFIG;
    }
  }

  /**
   * Persist ticker configuration
   */
  static saveTickerConfig(config: TickerConfig): void {
    try {
      StorageService.setRawString(
        APP_CONFIG.storageKeys.tickerConfig,
        JSON.stringify(config)
      );
    } catch {
      // Storage exceptions ignored gracefully
    }
  }

  /**
   * Filter active announcements based on enabled flag, start date/time, and expiry date/time
   */
  static filterActiveAnnouncements(
    items: AnnouncementItem[],
    nowEpochMs: number = Date.now()
  ): AnnouncementItem[] {
    return items
      .filter((item) => {
        if (!item.enabled) return false;
        if (item.startAtIso) {
          const startMs = Date.parse(item.startAtIso);
          if (!isNaN(startMs) && nowEpochMs < startMs) return false;
        }
        if (item.expiresAtIso) {
          const expMs = Date.parse(item.expiresAtIso);
          if (!isNaN(expMs) && nowEpochMs > expMs) return false;
        }
        return Boolean(item.message && item.message.trim().length > 0);
      })
      .sort((a, b) => {
        // Priority order: URGENT > IMPORTANT > NORMAL
        const priorityWeight = { URGENT: 3, IMPORTANT: 2, NORMAL: 1 };
        const pDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
        if (pDiff !== 0) return pDiff;
        return b.updatedAtMs - a.updatedAtMs;
      });
  }

  /**
   * Validate and sanitize announcement input
   */
  static validateInput(input: Partial<AnnouncementItem>): {
    valid: boolean;
    errorBM?: string;
    sanitized?: Partial<AnnouncementItem>;
  } {
    const message = (input.message || '').trim();
    if (!message) {
      return { valid: false, errorBM: 'Mesej pengumuman tidak boleh kosong.' };
    }
    if (message.length > 180) {
      return {
        valid: false,
        errorBM: 'Mesej pengumuman dihadkan kepada maksimum 180 aksara.',
      };
    }

    const title = (input.title || '').trim().slice(0, 40);
    const priority =
      input.priority === 'URGENT' || input.priority === 'IMPORTANT'
        ? input.priority
        : 'NORMAL';

    return {
      valid: true,
      sanitized: {
        title: title || undefined,
        message,
        priority,
        enabled: input.enabled !== false,
        startAtIso: input.startAtIso || undefined,
        expiresAtIso: input.expiresAtIso || undefined,
      },
    };
  }
}
