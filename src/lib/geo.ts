import type { GpsFix } from './types';

// Thin wrapper over the Geolocation API. Wayfinder is useless without a live
// position, so we keep a continuous watch rather than polling.

function toFix(pos: GeolocationPosition): GpsFix {
  const c = pos.coords;
  return {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: c.accuracy,
    // `heading`/`speed` are null when stationary or unsupported.
    courseDeg: c.heading ?? undefined,
    speedMps: c.speed ?? undefined
  };
}

export type GeoError = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

function classify(err: GeolocationPositionError): GeoError {
  if (err.code === err.PERMISSION_DENIED) return 'denied';
  if (err.code === err.TIMEOUT) return 'timeout';
  return 'unavailable';
}

/**
 * Track the device position until the returned function is called. Errors are
 * reported once and the watch stays alive — a timeout early on is routine and
 * usually resolves itself as the GPS warms up.
 */
export function watchPosition(
  onFix: (fix: GpsFix) => void,
  onError: (error: GeoError) => void
): () => void {
  if (!('geolocation' in navigator)) {
    onError('unsupported');
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onFix(toFix(pos)),
    (err) => onError(classify(err)),
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
  );
  return () => navigator.geolocation.clearWatch(id);
}

export const GEO_ERROR_TEXT: Record<GeoError, string> = {
  unsupported: 'This browser has no geolocation.',
  denied: 'Location permission denied — Wayfinder needs it to know where you are.',
  unavailable: 'Location unavailable right now.',
  timeout: 'Still looking for a GPS fix…'
};
