import type { LatLng } from '@/lib/types';

/** Mean Earth radius, kilometres. */
const R_KM = 6371;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Parse a `"lat,lng"` decimal-degrees string. Returns `null` on anything that
 * is not two finite numbers, so a malformed seed row surfaces as an
 * ineligible facility rather than as `NaN` propagating through the sort.
 */
export function parseLatLng(location: string): LatLng | null {
  const parts = (location ?? '').split(',');
  if (parts.length !== 2) return null;

  const lat = Number(parts[0].trim());
  const lng = Number(parts[1].trim());
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

/** Great-circle distance in kilometres. Eight lines, pure, no PostGIS. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
