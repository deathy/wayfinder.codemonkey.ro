import { useEffect, useRef } from 'preact/hooks';
import { createMapEngine, DEFAULT_CENTER, DEFAULT_ZOOM, type MapEngine } from '../map';
import type { GpsFix, LatLng, Place } from '../lib/types';

interface Props {
  location: GpsFix | null;
  target: Place | null;
  /** Great-circle points from you to the target; empty when there's no target. */
  path: LatLng[];
  /** Compass bearing to put at the top of the screen. 0 is north-up. */
  bearing: number;
  /** Whether the map tab is visible (drives size recalculation). */
  active: boolean;
  /** Bumped by the parent to request a fit-both-ends / recentre. */
  fitRequest: number;
}

const FIT = { padding: 48, maxZoom: 15 };

// This component knows nothing about OpenLayers — it drives the `MapEngine`
// interface with plain lat/lng and degrees. Swapping engines doesn't touch it.
export function MapView({ location, target, path, bearing, active, fitRequest }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  // Read inside the fit effect without making it re-run on every GPS tick.
  const locationRef = useRef(location);
  locationRef.current = location;
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || engineRef.current) return;

    const engine = createMapEngine({
      container,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM
    });
    engineRef.current = engine;

    // Re-measure whenever the container's box changes — layout settling,
    // safe-area insets, the drawer opening, rotation.
    const ro = new ResizeObserver(() => engine.invalidateSize());
    ro.observe(container);
    requestAnimationFrame(() => engine.invalidateSize());

    return () => {
      ro.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // The map has zero size while its tab is hidden; fix it up on the way back.
  useEffect(() => {
    if (active) requestAnimationFrame(() => engineRef.current?.invalidateSize());
  }, [active]);

  useEffect(() => engineRef.current?.setLocation(location), [location]);
  useEffect(() => engineRef.current?.setTarget(target), [target]);
  useEffect(() => engineRef.current?.setPath(path), [path]);
  useEffect(() => engineRef.current?.setBearing(bearing), [bearing]);

  // Only react to the request counter — re-fitting on every GPS tick would
  // fight the user for control of the map.
  useEffect(() => {
    if (fitRequest === 0) return;
    engineRef.current?.fitPath(pathRef.current, locationRef.current, FIT);
  }, [fitRequest]);

  return <div ref={containerRef} class="map" />;
}
