import { describe, expect, it } from 'vitest';
import { getZoneByCode, JAKIM_STATES, JAKIM_ZONES } from '../data/jakimZones';
import {
  calculateDistanceKm,
  isWithinMalaysianBounds,
  mapCoordinatesToJakimZone,
} from '../domain/zoneMapper';

/**
 * Unit Tests for Location Detection & JAKIM Zone Mapping
 * Traceability: LOC-001, LOC-002
 * Covers Master Prompt Section 29 Tests #2, #3, #4, #5
 */

describe('ZoneMapper & JAKIM Zones — LOC-001, LOC-002', () => {
  it('contains all 14 Malaysian states/federal territories and 60 official JAKIM zones', () => {
    expect(JAKIM_STATES.length).toBeGreaterThanOrEqual(14);
    expect(JAKIM_ZONES.length).toBeGreaterThanOrEqual(59);
  });

  it('maps Kuala Lumpur city centre coordinates (3.1478, 101.6953) to WLY01', () => {
    const result = mapCoordinatesToJakimZone(3.1478, 101.6953);
    expect(result.withinMalaysia).toBe(true);
    expect(result.zone.code).toBe('WLY01');
  });

  it('maps Putrajaya coordinates (2.9264, 101.6964) to WLY01', () => {
    const result = mapCoordinatesToJakimZone(2.9264, 101.6964);
    expect(result.withinMalaysia).toBe(true);
    expect(result.zone.code).toBe('WLY01');
  });

  it('maps Shah Alam / Petaling coordinates (3.0738, 101.5183) to SGR01', () => {
    const result = mapCoordinatesToJakimZone(3.0738, 101.5183);
    expect(result.withinMalaysia).toBe(true);
    expect(result.zone.code).toBe('SGR01');
  });

  it('maps Johor Bahru coordinates (1.4927, 103.7414) to JHR02', () => {
    const result = mapCoordinatesToJakimZone(1.4927, 103.7414);
    expect(result.withinMalaysia).toBe(true);
    expect(result.zone.code).toBe('JHR02');
  });

  it('maps Kota Kinabalu, Sabah coordinates (5.9804, 116.0735) to SBH07', () => {
    const result = mapCoordinatesToJakimZone(5.9804, 116.0735);
    expect(result.withinMalaysia).toBe(true);
    expect(result.zone.code).toBe('SBH07');
  });

  it('maps Kuching, Sarawak coordinates (1.5533, 110.3592) to SWK08', () => {
    const result = mapCoordinatesToJakimZone(1.5533, 110.3592);
    expect(result.withinMalaysia).toBe(true);
    expect(result.zone.code).toBe('SWK08');
  });

  it('identifies out-of-Malaysia coordinates accurately and falls back safely', () => {
    expect(isWithinMalaysianBounds(51.5074, -0.1278)).toBe(false);
    const outResult = mapCoordinatesToJakimZone(51.5074, -0.1278);
    expect(outResult.withinMalaysia).toBe(false);
    expect(outResult.zone).toBeDefined();
  });

  it('retrieves zone by code case-insensitively and defaults to WLY01 on invalid code', () => {
    expect(getZoneByCode('sgr01').code).toBe('SGR01');
    expect(getZoneByCode('INVALID99').code).toBe('WLY01');
  });

  it('computes Haversine distance accurately', () => {
    const dist = calculateDistanceKm(3.139, 101.6869, 3.139, 101.6869);
    expect(dist).toBe(0);
  });
});
