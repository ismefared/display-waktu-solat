import {
  DailyPrayerSchedule,
  MandatoryPrayerKey,
  PrayerItemDisplay,
  ResolvedPrayerState,
} from '../types/domain';
import { HIJRI_MONTH_NAMES_BM } from '../data/islamicEvents';
import { GREGORIAN_MONTH_NAMES_BM } from '../data/malaysianHistory';

/**
 * Prayer Time & Calendar Domain Engine
 * Policy Compliance: Section 18 (Countdown), Section 34 (Time & Date Rules)
 * All calculations explicitly operate in Malaysia Standard Time (Asia/Kuala_Lumpur, UTC+8).
 * Traceability: PR-001, PR-002, PR-003, CAL-001, CAL-002
 */

export const MANDATORY_PRAYERS: Array<{
  key: MandatoryPrayerKey;
  labelBM: string;
  labelArabic: string;
}> = [
  { key: 'fajr', labelBM: 'Subuh', labelArabic: 'الفجر' },
  { key: 'syuruk', labelBM: 'Syuruk', labelArabic: 'الشروق' },
  { key: 'dhuhr', labelBM: 'Zohor', labelArabic: 'الظهر' },
  { key: 'asr', labelBM: 'Asar', labelArabic: 'العصر' },
  { key: 'maghrib', labelBM: 'Maghrib', labelArabic: 'المغرب' },
  { key: 'isha', labelBM: 'Isyak', labelArabic: 'العشاء' },
];

const DAY_NAMES_BM: Record<string, string> = {
  Sunday: 'Ahad',
  Monday: 'Isnin',
  Tuesday: 'Selasa',
  Wednesday: 'Rabu',
  Thursday: 'Khamis',
  Friday: 'Jumaat',
  Saturday: 'Sabtu',
};

const JAKIM_MONTH_MAP: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mac: '03',
  Mar: '03',
  Apr: '04',
  Mei: '05',
  May: '05',
  Jun: '06',
  Jul: '07',
  Ogo: '08',
  Aug: '08',
  Sep: '09',
  Okt: '10',
  Oct: '10',
  Nov: '11',
  Dis: '12',
  Dec: '12',
};

export interface MalaysiaDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number; // 0..23
  minute: number; // 0..59
  second: number; // 0..59
  weekdayEN: string;
  weekdayBM: string;
  isoDate: string; // 'YYYY-MM-DD'
  time24WithSeconds: string; // 'HH:MM:SS'
  time24Short: string; // 'HH:MM'
}

/**
 * Extracts exact Malaysia Standard Time (Asia/Kuala_Lumpur, UTC+8) components
 * from any epoch millisecond timestamp, completely independent of browser local timezone.
 */
export function getMalaysiaDateParts(epochMs: number = Date.now()): MalaysiaDateParts {
  // Malaysia is permanently UTC+8 with no Daylight Saving Time since 1 Jan 1982
  const mytEpoch = epochMs + 8 * 3600 * 1000;
  const d = new Date(mytEpoch);

  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  const second = d.getUTCSeconds();

  const weekdayNames = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  const weekdayEN = weekdayNames[d.getUTCDay()];
  const weekdayBM = DAY_NAMES_BM[weekdayEN] || weekdayEN;

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoDate = `${year}-${pad(month)}-${pad(day)}`;
  const time24WithSeconds = `${pad(hour)}:${pad(minute)}:${pad(second)}`;
  const time24Short = `${pad(hour)}:${pad(minute)}`;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    weekdayEN,
    weekdayBM,
    isoDate,
    time24WithSeconds,
    time24Short,
  };
}

/**
 * Converts a JAKIM date string (e.g. '08-Okt-2026' or '2026-10-08') into 'YYYY-MM-DD'.
 */
export function normalizeJakimDateToIso(jakimDateStr: string): string {
  const trimmed = jakimDateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parts = trimmed.split('-');
  if (parts.length === 3) {
    const [dayPart, monPart, yearPart] = parts;
    const monthNum = JAKIM_MONTH_MAP[monPart] || '01';
    return `${yearPart}-${monthNum}-${dayPart.padStart(2, '0')}`;
  }
  return trimmed;
}

/**
 * Converts an ISO date ('YYYY-MM-DD') and time string ('HH:MM:SS' or 'HH:MM')
 * in Malaysia Time (UTC+8) into an exact UTC epoch timestamp in milliseconds.
 */
export function malaysiaDateTimeToEpochMs(isoDate: string, timeStr: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  const timeParts = timeStr.trim().split(':').map(Number);
  const hh = timeParts[0] || 0;
  const mm = timeParts[1] || 0;
  const ss = timeParts[2] || 0;

  // Subtract 8 hours to get UTC epoch from MYT components
  return Date.UTC(y, m - 1, d, hh, mm, ss) - 8 * 3600 * 1000;
}

/**
 * Formats a time string '05:52:00' into '05:52' for 10m display legibility.
 */
export function formatTime24Short(timeStr: string): string {
  if (!timeStr) return '--:--';
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return timeStr;
}

/**
 * Formats Gregorian date in Bahasa Melayu: e.g., 'Khamis, 8 Oktober 2026'
 */
export function formatGregorianDateBM(parts: MalaysiaDateParts): string {
  const monthName = GREGORIAN_MONTH_NAMES_BM[parts.month] || '';
  return `${parts.weekdayBM}, ${parts.day} ${monthName} ${parts.year}`;
}

/**
 * Parses JAKIM Hijri string ('1448-04-26') and formats in Bahasa Melayu:
 * e.g., '26 Rabiulakhir 1448H'
 */
export function parseAndFormatHijriDateBM(hijriStr: string): {
  year: number;
  month: number;
  day: number;
  monthNameBM: string;
  formattedBM: string;
} {
  if (!hijriStr || !/^\d{4}-\d{2}-\d{2}$/.test(hijriStr.trim())) {
    return {
      year: 1448,
      month: 1,
      day: 1,
      monthNameBM: 'Muharram',
      formattedBM: 'Maklumat Hijri Tidak Tersedia',
    };
  }
  const [yStr, mStr, dStr] = hijriStr.trim().split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  const monthNameBM = HIJRI_MONTH_NAMES_BM[month] || 'Hijrah';
  return {
    year,
    month,
    day,
    monthNameBM,
    formattedBM: `${day} ${monthNameBM} ${year}H`,
  };
}

/**
 * Formats a duration in seconds into 'HH:MM:SS' with zero-padded tabular digits.
 */
export function formatCountdownSeconds(totalSeconds: number): {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
} {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    totalSeconds: clamped,
    hours,
    minutes,
    seconds,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

/**
 * Resolves the complete prayer state for a given epoch timestamp (`nowEpochMs`):
 * - Selects today's schedule and tomorrow's schedule from the validated array.
 * - Handles daytime progression, post-Isyak (next prayer = tomorrow's Subuh),
 *   and midnight (00:00 to Subuh) seamlessly.
 */
export function resolvePrayerState(
  days: DailyPrayerSchedule[],
  nowEpochMs: number = Date.now()
): ResolvedPrayerState | null {
  if (!days || days.length === 0) {
    return null;
  }

  const nowParts = getMalaysiaDateParts(nowEpochMs);
  const todayIso = nowParts.isoDate;

  // Compute tomorrow's ISO date in MYT
  const tomorrowParts = getMalaysiaDateParts(nowEpochMs + 24 * 3600 * 1000);
  const tomorrowIso = tomorrowParts.isoDate;

  // Find today's schedule (or closest available schedule if offline cache is slightly offset)
  const todayIndex = days.findIndex((d) => d.isoDate === todayIso);
  const todaySchedule = todayIndex >= 0 ? days[todayIndex] : days[0];

  // Find tomorrow's schedule
  const tomorrowSchedule =
    days.find((d) => d.isoDate === tomorrowIso) ||
    (todayIndex >= 0 && todayIndex + 1 < days.length
      ? days[todayIndex + 1]
      : {
          ...todaySchedule,
          isoDate: tomorrowIso,
        });

  // Build epoch timestamps for today's 6 mandatory prayers using todayIso
  const effectiveTodayIso = todaySchedule.isoDate || todayIso;
  const effectiveTomorrowIso =
    tomorrowSchedule.isoDate && tomorrowSchedule.isoDate > effectiveTodayIso
      ? tomorrowSchedule.isoDate
      : tomorrowIso;

  const rawItems = MANDATORY_PRAYERS.map((meta) => {
    const timeFull = todaySchedule[meta.key];
    const epochMs = malaysiaDateTimeToEpochMs(effectiveTodayIso, timeFull);
    return {
      key: meta.key,
      labelBM: meta.labelBM,
      labelArabic: meta.labelArabic,
      time24: formatTime24Short(timeFull),
      timeFull,
      epochMs,
    };
  });

  // Determine next prayer and current prayer
  let nextIndex = rawItems.findIndex((item) => item.epochMs > nowEpochMs);
  let isTomorrow = false;
  let currentPrayer: ResolvedPrayerState['currentPrayer'] = null;
  let nextPrayer: ResolvedPrayerState['nextPrayer'];

  if (nextIndex === -1) {
    // Current time is after today's Isyak (between Isyak and 23:59:59)
    // Current active prayer is Isyak; Next prayer is tomorrow's Subuh (Fajr)
    isTomorrow = true;
    const ishaItem = rawItems[rawItems.length - 1];
    currentPrayer = {
      key: ishaItem.key,
      labelBM: ishaItem.labelBM,
      time24: ishaItem.time24,
    };

    const tomorrowFajrEpoch = malaysiaDateTimeToEpochMs(
      effectiveTomorrowIso,
      tomorrowSchedule.fajr
    );
    nextPrayer = {
      key: 'fajr',
      labelBM: 'Subuh',
      time24: formatTime24Short(tomorrowSchedule.fajr),
      targetEpochMs: tomorrowFajrEpoch,
      isTomorrow: true,
    };
  } else if (nextIndex === 0) {
    // Current time is after Midnight (00:00) and before today's Subuh
    // Next prayer is today's Subuh; current prayer period is still Isyak (from previous night)
    const ishaItem = rawItems[rawItems.length - 1];
    currentPrayer = {
      key: ishaItem.key,
      labelBM: ishaItem.labelBM,
      time24: ishaItem.time24,
    };

    const fajrItem = rawItems[0];
    nextPrayer = {
      key: fajrItem.key,
      labelBM: fajrItem.labelBM,
      time24: fajrItem.time24,
      targetEpochMs: fajrItem.epochMs,
      isTomorrow: false,
    };
  } else {
    // Daytime progression
    const currentItem = rawItems[nextIndex - 1];
    const nextItem = rawItems[nextIndex];
    currentPrayer = {
      key: currentItem.key,
      labelBM: currentItem.labelBM,
      time24: currentItem.time24,
    };
    nextPrayer = {
      key: nextItem.key,
      labelBM: nextItem.labelBM,
      time24: nextItem.time24,
      targetEpochMs: nextItem.epochMs,
      isTomorrow: false,
    };
  }

  const remainingSeconds = Math.max(
    0,
    Math.ceil((nextPrayer.targetEpochMs - nowEpochMs) / 1000)
  );
  const countdown = formatCountdownSeconds(remainingSeconds);

  const prayerItems: PrayerItemDisplay[] = rawItems.map((item, idx) => {
    const isNext = isTomorrow ? idx === 0 : idx === nextIndex;
    const isCurrent =
      !isNext &&
      ((nextIndex === -1 && idx === rawItems.length - 1) ||
        (nextIndex > 0 && idx === nextIndex - 1));
    return {
      ...item,
      isCurrent,
      isNext,
    };
  });

  return {
    currentPrayer,
    nextPrayer,
    countdown,
    todaySchedule,
    tomorrowSchedule,
    prayerItems,
  };
}
