// Core data model. The shape of a stored place is also the basis of the export
// shape, so keep this stable and version any breaking changes via EXPORT_VERSION.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GpsFix extends LatLng {
  /** Accuracy radius in metres, as reported by the Geolocation API. */
  accuracy: number;
  /** Travel direction in degrees clockwise from true north, when moving. */
  courseDeg?: number;
  /** Ground speed in m/s, when the device reports it. */
  speedMps?: number;
}

/** A place you can point at. */
export interface Place extends LatLng {
  /** Stable unique id. Built-ins use a `builtin:` prefix. */
  id: string;
  /** User-facing name. */
  label: string;
  /** Built-in sample places ship with the app and can't be edited or deleted. */
  builtin?: boolean;
  /** Epoch milliseconds when the place was saved. 0 for built-ins. */
  createdAt: number;
  /** Epoch milliseconds of the last edit. 0 for built-ins. */
  updatedAt: number;
}

/** Which north a heading is measured from. */
export type NorthReference = 'magnetic' | 'true';

export interface Heading {
  /** Degrees clockwise from `reference` north, 0..360, of where the phone points. */
  degrees: number;
  reference: NorthReference;
  /**
   * How we got it. `absolute`/`webkit` are magnetometer readings; `gps` is the
   * travel direction, only meaningful while actually moving.
   */
  source: 'absolute' | 'webkit' | 'gps';
  /** Platform-reported accuracy in degrees, when available (iOS only). */
  accuracyDeg?: number;
}

export const EXPORT_VERSION = 1;
