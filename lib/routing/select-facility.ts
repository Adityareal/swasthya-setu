import type { Facility, FacilityType, LatLng, RiskLevel } from '@/lib/types';
import { haversineKm, parseLatLng } from './haversine';

/**
 * Routing_Engine — pure. Takes an `origin` and knows nothing about roles;
 * origin *resolution* is the caller's job, which is why adding a third role
 * did not touch this function or its tests.
 *
 * Risk → eligible facility types, in preference order:
 *
 *   low     → phc                      (nearest PHC; if none, nearest CHC)
 *   medium  → chc                      (nearest CHC; if none, nearest district hospital)
 *   high    → chc, district_hospital   (nearest among BOTH)
 *
 * `high` deliberately does not force the district hospital. Sending a possible
 * cardiac case past a closer CHC to reach a district hospital costs time that
 * matters. Both are treated as capable of receiving an emergency, and distance
 * decides.
 */
export const RISK_ELIGIBILITY: Record<RiskLevel, readonly FacilityType[][]> = {
  /* Each inner array is one tier: exhaust tier 0 before falling back to tier 1. */
  low: [['phc'], ['chc']],
  medium: [['chc'], ['district_hospital']],
  high: [['chc', 'district_hospital']],
};

/** Tie-break 2: eligible-type priority when distances are equal. */
const TYPE_PRIORITY: Record<FacilityType, number> = {
  chc: 0,
  district_hospital: 1,
  phc: 2,
};

export interface FacilitySelection {
  facility: Facility;
  distanceKm: number;
  eligibleType: FacilityType;
}

interface Scored {
  facility: Facility;
  distanceKm: number;
}

function scoreTier(
  origin: LatLng,
  facilities: Facility[],
  types: readonly FacilityType[],
): Scored[] {
  const out: Scored[] = [];
  for (const f of facilities) {
    if (!types.includes(f.type)) continue;
    const coords = parseLatLng(f.location);
    if (!coords) continue;
    out.push({ facility: f, distanceKm: haversineKm(origin, coords) });
  }
  return out;
}

/**
 * Tie-breaks are fully specified so tests are stable:
 * distance ascending → eligible-type priority → `name` ascending → `id` ascending.
 *
 * Returns `null` when no eligible facility exists in any tier — the caller then
 * surfaces an error plate rather than writing a partial appointment.
 */
export function selectFacility(
  risk: RiskLevel,
  origin: LatLng,
  facilities: Facility[],
): FacilitySelection | null {
  if (!facilities || facilities.length === 0) return null;

  for (const tier of RISK_ELIGIBILITY[risk]) {
    const scored = scoreTier(origin, facilities, tier);
    if (scored.length === 0) continue;

    scored.sort((a, b) => {
      const byDistance = a.distanceKm - b.distanceKm;
      if (Math.abs(byDistance) > 1e-9) return byDistance;

      const byType =
        TYPE_PRIORITY[a.facility.type] - TYPE_PRIORITY[b.facility.type];
      if (byType !== 0) return byType;

      const byName = a.facility.name.localeCompare(b.facility.name);
      if (byName !== 0) return byName;

      return a.facility.id.localeCompare(b.facility.id);
    });

    const best = scored[0];
    return {
      facility: best.facility,
      distanceKm: best.distanceKm,
      eligibleType: best.facility.type,
    };
  }

  return null;
}
