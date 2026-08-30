// Great-circle maths on a spherical Earth. A sphere is good to ~0.5% on
// distance and a fraction of a degree on bearing — far inside the error of a
// phone magnetometer, and it keeps this file small and auditable.

import type { LatLng } from './types';

const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Wrap any angle into 0..360. */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Signed difference b - a, wrapped into -180..180. Use for "turn this much". */
export function deltaDeg(a: number, b: number): number {
  return ((b - a + 540) % 360) - 180;
}

/** Great-circle distance in metres between two points (haversine). */
export function distance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Initial bearing (forward azimuth) from `a` to `b`, in degrees clockwise from
 * true north. This is the direction to set off in *right now* — on a sphere it
 * changes as you travel, which is exactly why the drawn route curves.
 */
export function initialBearing(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}

/**
 * Points along the great circle from `a` to `b` — the actual shortest path over
 * the ground, which on a Mercator map is a curve, not a straight line.
 *
 * Longitudes are returned unwrapped (they may run past ±180) so the polyline
 * stays continuous across the antimeridian instead of snapping back across the
 * whole map. Leaflet handles out-of-range longitudes fine.
 */
export function greatCirclePath(a: LatLng, b: LatLng, segments = 128): LatLng[] {
  const lat1 = toRad(a.lat);
  const lng1 = toRad(a.lng);
  const lat2 = toRad(b.lat);
  const lng2 = toRad(b.lng);

  const d = distance(a, b) / EARTH_RADIUS_M; // angular distance
  // Coincident (or near-coincident) points have no meaningful path.
  if (!Number.isFinite(d) || d < 1e-9) return [a, b];

  const sinD = Math.sin(d);
  const points: LatLng[] = [];
  let prevLng = a.lng;
  let offset = 0;

  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / sinD;
    const B = Math.sin(f * d) / sinD;
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.hypot(x, y)));
    const lng = toDeg(Math.atan2(y, x));

    // Unwrap: keep each step within half a turn of the last one.
    if (i > 0) {
      const step = lng + offset - prevLng;
      if (step > 180) offset -= 360;
      else if (step < -180) offset += 360;
    }
    const unwrapped = lng + offset;
    prevLng = unwrapped;
    points.push({ lat, lng: unwrapped });
  }
  return points;
}

/** 16-point compass label for a bearing, e.g. "NNE". */
export function compassPoint(deg: number): string {
  const points = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
  ];
  return points[Math.round(normalizeDeg(deg) / 22.5) % 16]!;
}

export type Units = 'metric' | 'imperial';

const FEET_PER_M = 3.280839895;
const MILES_PER_M = 0.000621371192;

/** Human-friendly distance, e.g. "420 m", "1.3 km", "8,412 km". */
export function formatDistance(metres: number, units: Units = 'metric'): string {
  if (units === 'imperial') {
    const feet = metres * FEET_PER_M;
    if (feet < 1000) return `${Math.round(feet)} ft`;
    const miles = metres * MILES_PER_M;
    if (miles < 10) return `${miles.toFixed(1)} mi`;
    return `${Math.round(miles).toLocaleString()} mi`;
  }
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

/** Bearing as "127° SE". */
export function formatBearing(deg: number): string {
  return `${Math.round(normalizeDeg(deg))}° ${compassPoint(deg)}`;
}

/** Decimal degrees as "45.7538, 21.2257" — the form you can paste anywhere. */
export function formatLatLng(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
}
