import L from 'leaflet';

// Generic fallback view: central Timișoara. Used only until we have a real
// location — never anything location-revealing.
export const DEFAULT_CENTER: L.LatLngTuple = [45.7538, 21.2257];
export const DEFAULT_ZOOM = 12;

/** Standard keyless OpenStreetMap raster tiles. */
export function tileLayer(): L.TileLayer {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
}

// Standard teardrop map-pin. The body uses `currentColor` so a CSS class can
// theme it.
const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38" width="26" height="38">
  <path d="M13 1C6.4 1 1 6.4 1 13c0 8.6 10.6 22.4 11.1 23a1.2 1.2 0 0 0 1.9 0C14.4 35.4 25 21.6 25 13 25 6.4 19.6 1 13 1z" fill="currentColor" stroke="#fff" stroke-width="1.5"/>
  <circle cx="13" cy="13" r="4.5" fill="#fff"/>
</svg>`;

/** Pin for the place currently being pointed at. */
export function targetIcon(): L.DivIcon {
  return L.divIcon({
    className: 'marker-pin marker-target',
    html: PIN_SVG,
    iconSize: [26, 38],
    iconAnchor: [13, 38]
  });
}

/** Pulsing dot for the user's current location. */
export function locationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'here-pin',
    html: '<div class="here-dot"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

/** Styling for the great-circle line from you to the target. */
export const PATH_STYLE: L.PolylineOptions = {
  color: '#38bdf8',
  weight: 3,
  opacity: 0.9,
  interactive: false
};

/** A wider, dimmer line under the path so it stays visible over busy tiles. */
export const PATH_HALO_STYLE: L.PolylineOptions = {
  color: '#0f172a',
  weight: 7,
  opacity: 0.5,
  interactive: false
};
