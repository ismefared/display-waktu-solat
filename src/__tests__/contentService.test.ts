import { describe, expect, it } from 'vitest';
import { resolveDailyZikirForDate } from '../data/dailyZikir';
import { resolveIslamicEventForHijriDate } from '../data/islamicEvents';
import { resolveMalaysianHistoryForDate } from '../data/malaysianHistory';

/**
 * Unit Tests for Verified Islamic Events, Malaysian History & Daily Zikir
 * Traceability: ISL-001, MY-001, ZIK-001
 * Covers Master Prompt Section 29 Tests #12, #13, #14
 */

describe('Verified Content Services — ISL-001, MY-001, ZIK-001', () => {
  it('identifies exact Hijri events such as 1 Ramadan and 10 Zulhijjah accurately (ISL-001)', () => {
    const ramadan = resolveIslamicEventForHijriDate(1448, 9, 1);
    expect(ramadan.todayEvent).not.toBeNull();
    expect(ramadan.todayEvent?.isExactToday).toBe(true);
    expect(ramadan.todayEvent?.titleBM).toContain('Awal Ramadan');

    const aidiladha = resolveIslamicEventForHijriDate(1448, 12, 10);
    expect(aidiladha.todayEvent).not.toBeNull();
    expect(aidiladha.todayEvent?.titleBM).toContain('Hari Raya Aidiladha');
  });

  it('returns explicit "no special event today" state when Hijri date has no event (ISL-001)', () => {
    // 26 Rabiulakhir 1448H has no special annual event
    const normalDay = resolveIslamicEventForHijriDate(1448, 4, 26);
    expect(normalDay.todayEvent).toBeNull();
    expect(normalDay.statusMessageBM).toContain('Tiada peristiwa khas Islam');
    expect(normalDay.upcomingEvent).toBeDefined();
  });

  it('identifies Ayyamul Bidh (13, 14, 15 of Hijri month) except 13 Zulhijjah', () => {
    const ayyamulBidh = resolveIslamicEventForHijriDate(1448, 4, 14);
    expect(ayyamulBidh.todayEvent).not.toBeNull();
    expect(ayyamulBidh.todayEvent?.titleBM).toContain('Hari Putih');

    // 13 Zulhijjah is Hari Tasyrik Ketiga, not Ayyamul Bidh fasting
    const tasyrik = resolveIslamicEventForHijriDate(1448, 12, 13);
    expect(tasyrik.todayEvent?.titleBM).toContain('Hari Tasyrik Ketiga');
  });

  it('resolves verified Malaysian historical events for exact dates (e.g. 31 Aug, 16 Sep, 8 Oct) (MY-001)', () => {
    const merdeka = resolveMalaysianHistoryForDate(8, 31);
    expect(merdeka.isExactDateMatch).toBe(true);
    expect(merdeka.year).toBe(1957);
    expect(merdeka.titleBM).toContain('Kemerdekaan');

    const hariMalaysia = resolveMalaysianHistoryForDate(9, 16);
    expect(hariMalaysia.isExactDateMatch).toBe(true);
    expect(hariMalaysia.year).toBe(1963);

    const oct8 = resolveMalaysianHistoryForDate(10, 8);
    expect(oct8.isExactDateMatch).toBe(true);
    expect(oct8.sourceReference).toContain('Arkib Negara Malaysia');
  });

  it('provides a verified month fallback when no exact date match exists (MY-001)', () => {
    const fallback = resolveMalaysianHistoryForDate(10, 22);
    expect(fallback.isExactDateMatch).toBe(false);
    expect(fallback.sourceReference).toBeTruthy();
  });

  it('selects deterministic Daily Zikir for the same date and rotates across days (ZIK-001)', () => {
    const firstCall = resolveDailyZikirForDate(2026, 10, 8);
    const secondCall = resolveDailyZikirForDate(2026, 10, 8);
    const nextDayCall = resolveDailyZikirForDate(2026, 10, 9);

    // Must not change on refresh on the same day
    expect(firstCall.id).toBe(secondCall.id);
    expect(firstCall.arabicText).toBeTruthy();
    expect(firstCall.translationBM).toBeTruthy();
    expect(firstCall.sourceReference).toBeTruthy();

    // Rotates on the next calendar day
    expect(nextDayCall.id).not.toBe(firstCall.id);
  });
});
