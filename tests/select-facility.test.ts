import { describe, expect, it } from 'vitest';
import { selectFacility } from '@/lib/routing/select-facility';
import { haversineKm, parseLatLng } from '@/lib/routing/haversine';
import {
  buildSeed,
  resolveVillageCoords,
  VILLAGE_COORDS,
} from '@/lib/data/seed';
import type { Facility } from '@/lib/types';

/**
 * Validates: Requirements 12.1, 21.4
 */
const db = buildSeed();
const facilities: Facility[] = db.facilities;

const SEVAGRAM = VILLAGE_COORDS.Sevagram;
/** Rukmini's village, north-east of Wardha town. */
const BORDHARAN = VILLAGE_COORDS.Bordharan;

describe('selectFacility', () => {
  it('routes low risk to a PHC', () => {
    const result = selectFacility('low', SEVAGRAM, facilities);
    expect(result).not.toBeNull();
    expect(result!.facility.type).toBe('phc');
    expect(result!.facility.name).toBe('PHC Sevagram');
  });

  it('routes medium risk to a CHC', () => {
    const result = selectFacility('medium', SEVAGRAM, facilities);
    expect(result).not.toBeNull();
    expect(result!.facility.type).toBe('chc');
    expect(result!.facility.name).toBe('CHC Wardha');
  });

  it('routes high risk to CHC Wardha from Bordharan', () => {
    /* `high` is eligible for BOTH `chc` and `district_hospital`, so the answer
       is decided by the distance computation rather than declared by the seed.
       From Bordharan the CHC is the nearest capable facility. */
    const result = selectFacility('high', BORDHARAN, facilities);
    expect(result).not.toBeNull();
    expect(result!.facility.name).toBe('CHC Wardha');
    expect(result!.facility.type).toBe('chc');
    expect(result!.distanceKm).toBeGreaterThan(0);
  });

  it('routes high risk to the nearer capable facility, not a fixed one', () => {
    /* The same call from Sevagram picks the district hospital, because it is
       genuinely closer. Sending a possible cardiac case past a nearer capable
       facility costs time that matters, so distance decides — this assertion is
       the rule working, not a seed quirk. */
    const result = selectFacility('high', SEVAGRAM, facilities);
    expect(result).not.toBeNull();
    expect(['chc', 'district_hospital']).toContain(result!.facility.type);
    expect(result!.facility.name).toBe('District Hospital Wardha');
  });

  it('returns null for an empty facility list', () => {
    expect(selectFacility('high', SEVAGRAM, [])).toBeNull();
    expect(selectFacility('low', SEVAGRAM, [])).toBeNull();
    expect(selectFacility('medium', SEVAGRAM, [])).toBeNull();
  });

  it('falls back a tier when no facility of the preferred type exists', () => {
    const noPhc = facilities.filter((f) => f.type !== 'phc');
    const result = selectFacility('low', SEVAGRAM, noPhc);
    expect(result).not.toBeNull();
    expect(result!.facility.type).toBe('chc');
  });

  it('never returns an ineligible facility', () => {
    const onlyPhc = facilities.filter((f) => f.type === 'phc');
    /* `medium` is eligible for chc then district_hospital; a PHC-only list has
       nothing eligible in either tier. */
    expect(selectFacility('medium', SEVAGRAM, onlyPhc)).toBeNull();
  });
});

describe('haversine over the seeded coordinates', () => {
  it('computes a non-zero distance between PHC Sevagram and CHC Wardha', () => {
    const phc = parseLatLng('20.7453,78.6022')!;
    const chc = parseLatLng('20.7560,78.6570')!;
    const km = haversineKm(phc, chc);
    /* Identical coordinates would read 0.0 km and the haversine path would
       never actually be exercised. */
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(10);
  });

  it('rejects a malformed location string', () => {
    expect(parseLatLng('')).toBeNull();
    expect(parseLatLng('20.7453')).toBeNull();
    expect(parseLatLng('north,east')).toBeNull();
    expect(parseLatLng('200,400')).toBeNull();
  });

  it('falls back to the district centre for an unknown village', () => {
    expect(resolveVillageCoords('Nowhere')).toEqual(resolveVillageCoords(null));
  });
});
