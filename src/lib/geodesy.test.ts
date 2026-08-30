import { describe, expect, it } from 'vitest';
import {
  compassPoint,
  deltaDeg,
  distance,
  formatBearing,
  formatDistance,
  greatCirclePath,
  initialBearing,
  normalizeDeg
} from './geodesy';

// Reference points, all public landmarks (see places.ts for why).
const TIMISOARA = { lat: 45.7538, lng: 21.2257 };
const LONDON = { lat: 51.5074, lng: -0.1278 };
const KAABA = { lat: 21.4225, lng: 39.8262 };
const GIZA = { lat: 29.9792, lng: 31.1342 };

describe('distance', () => {
  it('is zero for the same point', () => {
    expect(distance(TIMISOARA, TIMISOARA)).toBe(0);
  });

  it('matches independently computed great-circle distances', () => {
    // Cross-checked against the spherical law of cosines and a 3D chord-length
    // derivation — two formulas that fail differently from haversine.
    expect(distance(TIMISOARA, LONDON)).toBeCloseTo(1_686_900, -4);
    expect(distance(TIMISOARA, KAABA)).toBeCloseTo(3_189_900, -4);
    expect(distance(LONDON, KAABA)).toBeCloseTo(4_793_800, -4);
  });

  it('is symmetric', () => {
    expect(distance(LONDON, KAABA)).toBeCloseTo(distance(KAABA, LONDON), 3);
  });
});

describe('initialBearing', () => {
  it('points due north along a meridian', () => {
    expect(initialBearing({ lat: 0, lng: 10 }, { lat: 10, lng: 10 })).toBeCloseTo(0, 6);
    expect(initialBearing({ lat: 10, lng: 10 }, { lat: 0, lng: 10 })).toBeCloseTo(180, 6);
  });

  it('points due east along the equator', () => {
    expect(initialBearing({ lat: 0, lng: 0 }, { lat: 0, lng: 10 })).toBeCloseTo(90, 6);
  });

  it('gives the qibla from Timișoara', () => {
    // ~141.8° from TRUE north, cross-checked against the classic qibla formula.
    // The dial reports magnetic-referenced headings, so what you see on a phone
    // will differ by the local declination until that correction lands.
    expect(initialBearing(TIMISOARA, KAABA)).toBeCloseTo(141.79, 1);
  });

  it('is not simply the reverse of the return bearing', () => {
    // The defining property of a great circle on a sphere: the bearing changes
    // as you travel, which is why the drawn route curves.
    const out = initialBearing(TIMISOARA, GIZA);
    const back = initialBearing(GIZA, TIMISOARA);
    expect(Math.abs(deltaDeg(out, normalizeDeg(back + 180)))).toBeGreaterThan(0.5);
  });
});

describe('greatCirclePath', () => {
  it('starts and ends at the endpoints', () => {
    const path = greatCirclePath(TIMISOARA, KAABA, 32);
    expect(path).toHaveLength(33);
    expect(path[0]!.lat).toBeCloseTo(TIMISOARA.lat, 6);
    expect(path[0]!.lng).toBeCloseTo(TIMISOARA.lng, 6);
    const end = path[path.length - 1]!;
    expect(end.lat).toBeCloseTo(KAABA.lat, 6);
    expect(end.lng).toBeCloseTo(KAABA.lng, 6);
  });

  it('bows away from the straight lat/lng interpolation on long routes', () => {
    // Reykjavík to Tokyo passes near the pole; the midpoint must sit well north
    // of the naive average latitude or we are drawing the wrong line.
    const a = { lat: 64.13, lng: -21.9 };
    const b = { lat: 35.68, lng: 139.77 };
    const mid = greatCirclePath(a, b, 64)[32]!;
    expect(mid.lat).toBeGreaterThan((a.lat + b.lat) / 2 + 10);
  });

  it('keeps longitudes continuous across the antimeridian', () => {
    const path = greatCirclePath({ lat: 0, lng: 170 }, { lat: 0, lng: -170 }, 16);
    for (let i = 1; i < path.length; i++) {
      expect(Math.abs(path[i]!.lng - path[i - 1]!.lng)).toBeLessThan(180);
    }
    // Unwrapped, so it runs past +180 rather than snapping back across the map.
    expect(path[path.length - 1]!.lng).toBeCloseTo(190, 3);
  });

  it('degrades gracefully for coincident points', () => {
    expect(greatCirclePath(TIMISOARA, TIMISOARA)).toHaveLength(2);
  });
});

describe('angles', () => {
  it('normalises into 0..360', () => {
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(450)).toBe(90);
  });

  it('takes the short way round', () => {
    expect(deltaDeg(350, 10)).toBe(20);
    expect(deltaDeg(10, 350)).toBe(-20);
  });

  it('labels compass points, rounding at the boundaries', () => {
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(359)).toBe('N');
    expect(compassPoint(136)).toBe('SE');
    expect(compassPoint(280)).toBe('W');
  });
});

describe('formatting', () => {
  it('switches units at sensible thresholds', () => {
    expect(formatDistance(420)).toBe('420 m');
    expect(formatDistance(1340)).toBe('1.3 km');
    expect(formatDistance(3_180_000)).toBe('3,180 km');
  });

  it('formats imperial', () => {
    expect(formatDistance(100, 'imperial')).toBe('328 ft');
    expect(formatDistance(5000, 'imperial')).toBe('3.1 mi');
  });

  it('formats a bearing with its compass point', () => {
    expect(formatBearing(136.4)).toBe('136° SE');
  });
});
