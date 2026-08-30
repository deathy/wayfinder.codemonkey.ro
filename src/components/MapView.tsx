import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef } from 'preact/hooks';
import type { GpsFix, LatLng, Place } from '../lib/types';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  PATH_HALO_STYLE,
  PATH_STYLE,
  locationIcon,
  targetIcon,
  tileLayer
} from '../lib/map';

interface Props {
  location: GpsFix | null;
  target: Place | null;
  /** Great-circle points from you to the target; empty when there's no target. */
  path: LatLng[];
  /** Whether the map tab is visible (drives Leaflet size recalculation). */
  active: boolean;
  /** Bumped by the parent to request a fit-both-ends / recentre. */
  fitRequest: number;
}

// The map is north-up on purpose: rotating tiles would rotate their labels with
// them, and a needle that points the right way is easier to trust than a map
// that is constantly moving under your thumb.
export function MapView({ location, target, path, active, fitRequest }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const hereMarkerRef = useRef<L.Marker | null>(null);
  const accuracyRef = useRef<L.Circle | null>(null);
  const targetMarkerRef = useRef<L.Marker | null>(null);
  const pathRef = useRef<L.LayerGroup | null>(null);
  const didInitialCenter = useRef(false);

  // One-time map setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      DEFAULT_CENTER,
      DEFAULT_ZOOM
    );
    tileLayer().addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
    pathRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Recalculate whenever the container's box changes (layout, safe-area
    // insets, the drawer opening). Without this Leaflet keeps a stale size and
    // paints tiles for only part of the viewport.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // The map has zero size while its tab is hidden; fix it up on the way back.
  useEffect(() => {
    if (active && mapRef.current) {
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
    }
  }, [active]);

  // "You are here" marker plus its accuracy halo.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !location) return;
    const at: L.LatLngTuple = [location.lat, location.lng];

    if (!hereMarkerRef.current) {
      hereMarkerRef.current = L.marker(at, {
        icon: locationIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000
      }).addTo(map);
    } else {
      hereMarkerRef.current.setLatLng(at);
    }

    // Only worth drawing when the fix is vague enough to be worth knowing about.
    if (location.accuracy > 25) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(at, {
          radius: location.accuracy,
          color: '#3b82f6',
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.08,
          interactive: false
        }).addTo(map);
      } else {
        accuracyRef.current.setLatLng(at).setRadius(location.accuracy);
      }
    } else if (accuracyRef.current) {
      accuracyRef.current.remove();
      accuracyRef.current = null;
    }

    if (!didInitialCenter.current) {
      didInitialCenter.current = true;
      map.setView(at, 14);
    }
  }, [location]);

  // Target pin.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!target) {
      targetMarkerRef.current?.remove();
      targetMarkerRef.current = null;
      return;
    }
    const at: L.LatLngTuple = [target.lat, target.lng];
    if (!targetMarkerRef.current) {
      targetMarkerRef.current = L.marker(at, { icon: targetIcon(), interactive: false }).addTo(map);
    } else {
      targetMarkerRef.current.setLatLng(at);
    }
  }, [target]);

  // The great-circle line, redrawn as you move.
  useEffect(() => {
    const layer = pathRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (path.length < 2) return;
    const latlngs = path.map((p) => [p.lat, p.lng] as L.LatLngTuple);
    layer.addLayer(L.polyline(latlngs, PATH_HALO_STYLE));
    layer.addLayer(L.polyline(latlngs, PATH_STYLE));
  }, [path]);

  // Parent asked to frame things: show the whole path if there is one, else
  // just snap back to the current position.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitRequest === 0) return;
    if (path.length >= 2) {
      map.fitBounds(
        L.latLngBounds(path.map((p) => [p.lat, p.lng] as L.LatLngTuple)),
        { padding: [48, 48], maxZoom: 15 }
      );
    } else if (location) {
      map.setView([location.lat, location.lng], 14);
    }
    // Only react to the request counter — re-fitting on every GPS tick would
    // fight the user for control of the map.
  }, [fitRequest]);

  return <div ref={containerRef} class="map" />;
}
