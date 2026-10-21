import { describe, expect, it } from 'vitest';
import { PrayerService } from '../services/prayerService';
import { classifyWeatherCondition } from '../services/weatherService';
import { resolvePrayerState } from '../domain/prayerEngine';

/**
 * Unit Tests for Offline Resilience, Emergency Fallback, and Weather Classification
 * Traceability: WX-001, NFR-001, NFR-002
 * Covers Master Prompt Section 29 Tests #15, #16, #17, #18
 */

describe('Offline Resilience & Weather Classification — WX-001, NFR-001', () => {
  it('classifies MetMalaysia Bahasa Melayu weather summaries accurately (WX-001)', () => {
    expect(classifyWeatherCondition('Ribut petir di beberapa tempat')).toBe(
      'THUNDERSTORM'
    );
    expect(classifyWeatherCondition('Hujan di satu dua tempat')).toBe('RAIN');
    expect(classifyWeatherCondition('Mendung dan berawan')).toBe('CLOUDY');
    expect(classifyWeatherCondition('Tiada Hujan')).toBe('CLEAR');
  });

  it('builds a valid emergency offline prayer schedule that keeps PrayerEngine & Countdown working (Test #16 & #17)', () => {
    const emergency = PrayerService.buildOfflineEmergencySchedule('SGR01');
    expect(emergency.zone).toBe('SGR01');
    expect(emergency.isStale).toBe(true);
    expect(emergency.isOfflineFallback).toBe(true);
    expect(emergency.days.length).toBeGreaterThanOrEqual(2);

    const resolved = resolvePrayerState(emergency.days, Date.now());
    expect(resolved).not.toBeNull();
    expect(resolved!.nextPrayer.labelBM).toBeTruthy();
    expect(resolved!.countdown.formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
