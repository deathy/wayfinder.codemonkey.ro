import type { GpsFix, LatLng, Place } from '../lib/types';

// The map engine boundary.
//
// Everything above this line speaks plain lat/lng and degrees; nothing outside
// `src/map/` imports OpenLayers. Swapping engines (OpenLayers today, MapLibre if
// upright labels ever justify the bundle) means writing one new file that
// satisfies `MapEngine` and changing which factory `createMapEngine` calls —
// not touching MapView, the app, or any component.
//
// Keeping DOM elements as the marker currency is deliberate: OpenLayers
// `Overlay` and MapLibre `Marker` both position a DOM node, so the pins, their
// CSS and their animations port across unchanged.

export interface MapEngineOptions {
  container: HTMLElement;
  center: LatLng;
  zoom: number;
}

export interface FitOptions {
  /** Padding in CSS pixels kept clear on every side. */
  padding: number;
  maxZoom: number;
}

export interface MapEngine {
  /** Your current position, with its accuracy halo. Null hides both. */
  setLocation(fix: GpsFix | null): void;

  /** The place being pointed at. Null hides the pin. */
  setTarget(target: Place | null): void;

  /**
   * The great-circle line. Longitudes may run past ±180 (see
   * `greatCirclePath`), so engines must not naively clamp them.
   */
  setPath(points: LatLng[]): void;

  /**
   * Which compass bearing sits at the top of the screen, in degrees clockwise
   * from north. 0 is north-up. Engines convert to their own rotation
   * convention — OpenLayers wants counter-clockwise radians, MapLibre wants
   * clockwise degrees, and neither is the caller's problem.
   */
  setBearing(deg: number): void;

  /** Frame the whole path, or fall back to centring on `fallback`. */
  fitPath(points: LatLng[], fallback: LatLng | null, options: FitOptions): void;

  /** Re-measure after the container's box changes. */
  invalidateSize(): void;

  destroy(): void;
}

export type MapEngineFactory = (options: MapEngineOptions) => MapEngine;
