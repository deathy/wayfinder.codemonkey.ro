// Engine-neutral map appearance: colours, zoom defaults, and the marker DOM.
// No engine imports here, so both the OpenLayers and any future MapLibre engine
// draw exactly the same pins.

import type { LatLng } from '../lib/types';

/** Generic fallback view: central Timișoara. Used only until we have a real
 *  location — never anything location-revealing. */
export const DEFAULT_CENTER: LatLng = { lat: 45.7538, lng: 21.2257 };
export const DEFAULT_ZOOM = 12;
export const LOCATED_ZOOM = 14;
export const MAX_ZOOM = 19;

// The bare host, per OSM's current tile usage policy — the a/b/c subdomains
// are legacy and cost extra DNS lookups.
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const PATH_COLOR = '#38bdf8';
export const PATH_WIDTH = 3;
export const PATH_HALO_COLOR = 'rgba(15, 23, 42, 0.5)';
export const PATH_HALO_WIDTH = 7;

export const ACCURACY_STROKE = 'rgba(59, 130, 246, 0.4)';
export const ACCURACY_FILL = 'rgba(59, 130, 246, 0.08)';
/** Below this the fix is tight enough that a halo is just noise. */
export const ACCURACY_MIN_M = 25;

// Standard teardrop map-pin, anchored at its point.
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38" width="26" height="38">
  <path d="M13 1C6.4 1 1 6.4 1 13c0 8.6 10.6 22.4 11.1 23a1.2 1.2 0 0 0 1.9 0C14.4 35.4 25 21.6 25 13 25 6.4 19.6 1 13 1z" fill="currentColor" stroke="#fff" stroke-width="1.5"/>
  <circle cx="13" cy="13" r="4.5" fill="#fff"/>
</svg>`;

/** The target pin. Positioned by its tip, so it points at the exact spot. */
export function createTargetElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'marker-pin marker-target';
  el.innerHTML = PIN_SVG;
  return el;
}

/** The pulsing "you are here" dot, centred on the fix. */
export function createHereElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'here-pin';
  el.innerHTML = '<div class="here-dot"></div>';
  return el;
}
