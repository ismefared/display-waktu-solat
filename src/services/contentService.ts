import { resolveDailyZikirForDate } from '../data/dailyZikir';
import { resolveIslamicEventForHijriDate } from '../data/islamicEvents';
import { resolveMalaysianHistoryForDate } from '../data/malaysianHistory';
import {
  DailyZikirItem,
  IslamicEventItem,
  MalaysianHistoryItem,
} from '../types/domain';

/**
 * Verified Contextual Content Service
 * Aggregates deterministic Daily Zikir (ZIK-001), Islamic Event (ISL-001),
 * and Malaysian Historical Event (MY-001) without any generative fabrication.
 */

export class ContentService {
  static getContextualContentForDay(params: {
    gregorianYear: number;
    gregorianMonth: number;
    gregorianDay: number;
    hijriYear: number;
    hijriMonth: number;
    hijriDay: number;
  }): {
    islamicEvent: {
      todayEvent: IslamicEventItem | null;
      upcomingEvent: IslamicEventItem;
      statusMessageBM: string;
    };
    malaysianHistory: MalaysianHistoryItem;
    dailyZikir: DailyZikirItem;
  } {
    const islamicEvent = resolveIslamicEventForHijriDate(
      params.hijriYear,
      params.hijriMonth,
      params.hijriDay
    );

    const malaysianHistory = resolveMalaysianHistoryForDate(
      params.gregorianMonth,
      params.gregorianDay
    );

    const dailyZikir = resolveDailyZikirForDate(
      params.gregorianYear,
      params.gregorianMonth,
      params.gregorianDay
    );

    return {
      islamicEvent,
      malaysianHistory,
      dailyZikir,
    };
  }
}
