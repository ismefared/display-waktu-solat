/**
 * Resilient Browser Storage Service with TTL and Stale Threshold Evaluation
 * Traceability: Section 11 (Data Freshness), Section 12 (Offline/Failure Principle)
 */

export interface CachedRecord<T> {
  data: T;
  savedAtEpochMs: number;
  fetchedAtIso: string;
}

export class StorageService {
  static setItem<T>(key: string, data: T, fetchedAtIso: string = new Date().toISOString()): void {
    try {
      const record: CachedRecord<T> = {
        data,
        savedAtEpochMs: Date.now(),
        fetchedAtIso,
      };
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(record));
      }
    } catch {
      // Ignore storage quota or private-browsing exceptions
    }
  }

  static getItem<T>(
    key: string,
    staleThresholdMs: number,
    maxRetentionMs: number
  ): {
    data: T;
    fetchedAtIso: string;
    ageMs: number;
    isStale: boolean;
  } | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as CachedRecord<T>;
      if (!parsed || typeof parsed.savedAtEpochMs !== 'number' || !parsed.data) {
        return null;
      }

      const ageMs = Math.max(0, Date.now() - parsed.savedAtEpochMs);
      if (ageMs > maxRetentionMs) {
        window.localStorage.removeItem(key);
        return null;
      }

      return {
        data: parsed.data,
        fetchedAtIso: parsed.fetchedAtIso || new Date(parsed.savedAtEpochMs).toISOString(),
        ageMs,
        isStale: ageMs > staleThresholdMs,
      };
    } catch {
      return null;
    }
  }

  static setRawString(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // Ignore
    }
  }

  static getRawString(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch {
      return null;
    }
  }
}
