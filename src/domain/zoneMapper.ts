import { PrayerZone } from '../types/domain';
import { JAKIM_ZONES } from '../data/jakimZones';

/**
 * Location & Coordinate-to-JAKIM-Zone Mapping Engine
 * Policy Compliance: Section 19, Section 35 (Distinguish Device Location, Prayer Zone, Weather Location)
 * Traceability: LOC-001, LOC-002
 */

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates great-circle distance in kilometres between two coordinates using the Haversine formula.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Checks whether coordinates are plausibly within or near Malaysian territory
 * (Latitude: ~0.8°N to 7.5°N, Longitude: ~99.5°E to 119.5°E).
 */
export function isWithinMalaysianBounds(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= 0.5 && lat <= 8.0 && lng >= 99.0 && lng <= 120.0;
}

/**
 * Maps geographic coordinates (latitude, longitude) to the nearest official JAKIM Prayer Zone.
 * Also applies metropolitan bounding box refinement for Kuala Lumpur / Putrajaya (WLY01) vs Selangor (SGR01).
 */
export function mapCoordinatesToJakimZone(
  lat: number,
  lng: number
): {
  zone: PrayerZone;
  distanceKm: number;
  withinMalaysia: boolean;
} {
  const withinMalaysia = isWithinMalaysianBounds(lat, lng);

  // Special explicit bounding box check for Federal Territory Kuala Lumpur & Putrajaya (WLY01)
  // KL: ~3.04 to 3.24 N, 101.61 to 101.76 E; Putrajaya: ~2.88 to 2.97 N, 101.66 to 101.73 E
  const isInsideKL =
    lat >= 3.04 && lat <= 3.24 && lng >= 101.61 && lng <= 101.76;
  const isInsidePutrajaya =
    lat >= 2.88 && lat <= 2.97 && lng >= 101.66 && lng <= 101.73;

  if (isInsideKL || isInsidePutrajaya) {
    const wly01 = JAKIM_ZONES.find((z) => z.code === 'WLY01')!;
    return {
      zone: wly01,
      distanceKm: calculateDistanceKm(lat, lng, wly01.lat, wly01.lng),
      withinMalaysia: true,
    };
  }

  let closestZone = JAKIM_ZONES[0];
  let minDistanceKm = Infinity;

  for (const candidate of JAKIM_ZONES) {
    const distance = calculateDistanceKm(lat, lng, candidate.lat, candidate.lng);
    if (distance < minDistanceKm) {
      minDistanceKm = distance;
      closestZone = candidate;
    }
  }

  return {
    zone: closestZone,
    distanceKm: Math.round(minDistanceKm * 10) / 10,
    withinMalaysia,
  };
}
