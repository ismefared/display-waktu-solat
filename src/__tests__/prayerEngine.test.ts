import { describe, expect, it } from 'vitest';
import {
  formatCountdownSeconds,
  formatGregorianDateBM,
  getMalaysiaDateParts,
  malaysiaDateTimeToEpochMs,
  normalizeJakimDateToIso,
  parseAndFormatHijriDateBM,
  resolvePrayerState,
} from '../domain/prayerEngine';
import { DailyPrayerSchedule } from '../types/domain';

/**
 * Unit & Boundary Tests for Prayer Engine, Next Prayer, Countdown & Dates
 * Traceability: PR-001, PR-002, PR-003, CAL-001, CAL-002
 * Covers Master Prompt Section 29 Tests #1, #6, #7, #8, #9, #10, #11
 */

const SAMPLE_DAYS: DailyPrayerSchedule[] = [
  {
    hijri: '1448-04-26',
    date: '08-Okt-2026',
    isoDate: '2026-10-08',
    day: 'Thursday',
    imsak: '05:42:00',
    fajr: '05:52:00',
    syuruk: '06:58:00',
    dhuha: '07:23:00',
    dhuhr: '13:04:00',
    asr: '16:17:00',
    maghrib: '19:04:00',
    isha: '20:14:00',
  },
  {
    hijri: '1448-04-27',
    date: '09-Okt-2026',
    isoDate: '2026-10-09',
    day: 'Friday',
    imsak: '05:41:00',
    fajr: '05:51:00',
    syuruk: '06:58:00',
    dhuha: '07:23:00',
    dhuhr: '13:03:00',
    asr: '16:17:00',
    maghrib: '19:04:00',
    isha: '20:13:00',
  },
];

describe('PrayerEngine — PR-001, PR-002, PR-003, CAL-001, CAL-002', () => {
  it('normalizes JAKIM date strings (e.g. 08-Okt-2026) to YYYY-MM-DD', () => {
    expect(normalizeJakimDateToIso('08-Okt-2026')).toBe('2026-10-08');
    expect(normalizeJakimDateToIso('01-Mac-2026')).toBe('2026-03-01');
    expect(normalizeJakimDateToIso('15-Mei-2026')).toBe('2026-05-15');
    expect(normalizeJakimDateToIso('2026-12-31')).toBe('2026-12-31');
  });

  it('formats Gregorian date accurately in Bahasa Melayu for Asia/Kuala_Lumpur (CAL-001)', () => {
    const epoch = malaysiaDateTimeToEpochMs('2026-10-08', '14:30:00');
    const parts = getMalaysiaDateParts(epoch);
    expect(parts.isoDate).toBe('2026-10-08');
    expect(parts.weekdayBM).toBe('Khamis');
    expect(formatGregorianDateBM(parts)).toBe('Khamis, 8 Oktober 2026');
  });

  it('parses and formats JAKIM Hijri date accurately (CAL-002)', () => {
    const hijri = parseAndFormatHijriDateBM('1448-04-26');
    expect(hijri.year).toBe(1448);
    expect(hijri.month).toBe(4);
    expect(hijri.day).toBe(26);
    expect(hijri.monthNameBM).toBe('Rabiulakhir');
    expect(hijri.formattedBM).toBe('26 Rabiulakhir 1448H');
  });

  it('resolves daytime progression accurately (between Zohor and Asar) (PR-002 & PR-003)', () => {
    // 14:17:00 MYT -> 2 hours before Asar (16:17:00)
    const nowEpoch = malaysiaDateTimeToEpochMs('2026-10-08', '14:17:00');
    const state = resolvePrayerState(SAMPLE_DAYS, nowEpoch);

    expect(state).not.toBeNull();
    expect(state!.currentPrayer?.key).toBe('dhuhr');
    expect(state!.currentPrayer?.labelBM).toBe('Zohor');
    expect(state!.nextPrayer.key).toBe('asr');
    expect(state!.nextPrayer.labelBM).toBe('Asar');
    expect(state!.nextPrayer.isTomorrow).toBe(false);
    expect(state!.countdown.formatted).toBe('02:00:00');
    expect(state!.prayerItems).toHaveLength(6);
  });

  it('handles Sunrise / Syuruk boundary accurately (between Subuh and Syuruk vs after Syuruk)', () => {
    const beforeSyuruk = malaysiaDateTimeToEpochMs('2026-10-08', '06:30:00');
    const stateBefore = resolvePrayerState(SAMPLE_DAYS, beforeSyuruk)!;
    expect(stateBefore.currentPrayer?.labelBM).toBe('Subuh');
    expect(stateBefore.nextPrayer.labelBM).toBe('Syuruk');

    const afterSyuruk = malaysiaDateTimeToEpochMs('2026-10-08', '07:15:00');
    const stateAfter = resolvePrayerState(SAMPLE_DAYS, afterSyuruk)!;
    expect(stateAfter.currentPrayer?.labelBM).toBe('Syuruk');
    expect(stateAfter.nextPrayer.labelBM).toBe('Zohor');
  });

  it('handles Post-Isyak before Midnight rollover (next prayer = tomorrow Subuh) (PR-002)', () => {
    // 22:00:00 MYT on 2026-10-08 (Isyak was 20:14:00, Tomorrow Subuh is 05:51:00 on 2026-10-09)
    const postIsyak = malaysiaDateTimeToEpochMs('2026-10-08', '22:00:00');
    const state = resolvePrayerState(SAMPLE_DAYS, postIsyak)!;

    expect(state.currentPrayer?.key).toBe('isha');
    expect(state.currentPrayer?.labelBM).toBe('Isyak');
    expect(state.nextPrayer.key).toBe('fajr');
    expect(state.nextPrayer.labelBM).toBe('Subuh');
    expect(state.nextPrayer.isTomorrow).toBe(true);
    expect(state.nextPrayer.time24).toBe('05:51');
    // From 22:00 to 05:51 is 7 hours 51 minutes (07:51:00)
    expect(state.countdown.formatted).toBe('07:51:00');
  });

  it('handles Midnight transition (00:15:00 MYT before Subuh) (Test #8 & #9)', () => {
    // 00:15:00 MYT on 2026-10-09 (Today's Subuh is 05:51:00)
    const afterMidnight = malaysiaDateTimeToEpochMs('2026-10-09', '00:15:00');
    const state = resolvePrayerState(SAMPLE_DAYS, afterMidnight)!;

    expect(state.todaySchedule.isoDate).toBe('2026-10-09');
    expect(state.nextPrayer.key).toBe('fajr');
    expect(state.nextPrayer.labelBM).toBe('Subuh');
    expect(state.nextPrayer.isTomorrow).toBe(false);
    // From 00:15:00 to 05:51:00 is 05:36:00
    expect(state.countdown.formatted).toBe('05:36:00');
  });

  it('formats countdown seconds reliably without negative values', () => {
    expect(formatCountdownSeconds(1062).formatted).toBe('00:17:42');
    expect(formatCountdownSeconds(0).formatted).toBe('00:00:00');
    expect(formatCountdownSeconds(-50).formatted).toBe('00:00:00');
  });
});
