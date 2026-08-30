import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import Overlay from 'ol/Overlay.js';
import Feature from 'ol/Feature.js';
import TileLayer from 'ol/layer/Tile.js';
import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import OSM from 'ol/source/OSM.js';
import LineString from 'ol/geom/LineString.js';
import { circular } from 'ol/geom/Polygon.js';
import { fromLonLat } from 'ol/proj.js';
import { boundingExtent } from 'ol/extent.js';
import Style from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Fill from 'ol/style/Fill.js';
import { defaults as defaultControls } from 'ol/control/defaults.js';
import { defaults as defaultInteractions } from 'ol/interaction/defaults.js';

import type { GpsFix, LatLng, Place } from '../lib/types';
import type { FitOptions, MapEngine, MapEngineOptions } from './types';
import {
  ACCURACY_FILL,
  ACCURACY_MIN_M,
  ACCURACY_STROKE,
  LOCATED_ZOOM,
  MAX_ZOOM,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  PATH_COLOR,
  PATH_HALO_COLOR,
  PATH_HALO_WIDTH,
  PATH_WIDTH,
  createHereElement,
  createTargetElement
} from './style';

// OpenLayers engine. Chosen over a Leaflet rotation plugin because rotation is a
// first-class `View` property here rather than a patch over library internals:
// hit-testing stays correct when rotated, and it keeps us on plain keyless OSM
// raster tiles with no third-party tile service.
//
// The known trade-off: raster tiles have their labels baked in, so they rotate
// with the map and read sideways when you face south. Only vector tiles fix
// that — which is what a MapLibre engine would buy, at ~+62 KB gzipped.

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Our lat/lng into OpenLayers' EPSG:3857 map units. */
function toMapCoord(p: LatLng): [number, number] {
  return fromLonLat([p.lng, p.lat]) as [number, number];
}

const pathStyle = [
  // Drawn first, so the halo sits under the line and keeps it legible on busy tiles.
  new Style({ stroke: new Stroke({ color: PATH_HALO_COLOR, width: PATH_HALO_WIDTH }) }),
  new Style({ stroke: new Stroke({ color: PATH_COLOR, width: PATH_WIDTH }) })
];

const accuracyStyle = new Style({
  stroke: new Stroke({ color: ACCURACY_STROKE, width: 1 }),
  fill: new Fill({ color: ACCURACY_FILL })
});

export function createOpenLayersEngine(options: MapEngineOptions): MapEngine {
  const pathFeature = new Feature<LineString>();
  pathFeature.setStyle(pathStyle);

  const accuracyFeature = new Feature();
  accuracyFeature.setStyle(accuracyStyle);

  const vectorSource = new VectorSource({ features: [pathFeature, accuracyFeature] });

  const hereElement = createHereElement();
  const targetElement = createTargetElement();

  // Overlays, not styled features, so the pins keep their existing CSS and
  // animations — and stay upright when the map rotates, which is what you want
  // from a pin. MapLibre's Marker takes a DOM element the same way.
  const hereOverlay = new Overlay({
    element: hereElement,
    positioning: 'center-center',
    stopEvent: false
  });
  const targetOverlay = new Overlay({
    element: targetElement,
    // The teardrop points at its own tip, so anchor there rather than centre.
    positioning: 'bottom-center',
    stopEvent: false
  });

  const view = new View({
    center: toMapCoord(options.center),
    zoom: options.zoom,
    maxZoom: MAX_ZOOM,
    constrainRotation: false
  });

  const map = new Map({
    target: options.container,
    view,
    layers: [
      new TileLayer({
        source: new OSM({ url: OSM_TILE_URL, attributions: OSM_ATTRIBUTION })
      }),
      new VectorLayer({ source: vectorSource })
    ],
    // We own rotation (it follows the compass), so the built-in rotate control
    // and the user-rotate gestures would only fight it.
    controls: defaultControls({ rotate: false }),
    interactions: defaultInteractions({ altShiftDragRotate: false, pinchRotate: false })
  });

  // Overlays start unpositioned; adding them now keeps the add/remove churn out
  // of the update path.
  map.addOverlay(hereOverlay);
  map.addOverlay(targetOverlay);

  let centredOnFix = false;

  return {
    setLocation(fix: GpsFix | null) {
      if (!fix) {
        hereOverlay.setPosition(undefined);
        accuracyFeature.setGeometry(undefined);
        return;
      }
      const at = toMapCoord(fix);
      hereOverlay.setPosition(at);

      // A true circle on the sphere, then projected — a plain projected circle
      // would be wrong by the Mercator scale factor at this latitude.
      if (fix.accuracy > ACCURACY_MIN_M) {
        accuracyFeature.setGeometry(
          circular([fix.lng, fix.lat], fix.accuracy, 64).transform('EPSG:4326', 'EPSG:3857')
        );
      } else {
        accuracyFeature.setGeometry(undefined);
      }

      if (!centredOnFix) {
        centredOnFix = true;
        view.setCenter(at);
        view.setZoom(LOCATED_ZOOM);
      }
    },

    setTarget(target: Place | null) {
      targetOverlay.setPosition(target ? toMapCoord(target) : undefined);
    },

    setPath(points: LatLng[]) {
      if (points.length < 2) {
        pathFeature.setGeometry(undefined);
        return;
      }
      // Longitudes past ±180 project to x beyond the world extent, which is
      // exactly what keeps an antimeridian-crossing line continuous.
      pathFeature.setGeometry(new LineString(points.map(toMapCoord)));
    },

    setBearing(deg: number) {
      // OpenLayers rotates the view, so putting a compass bearing at the top of
      // the screen means rotating the view the other way.
      view.setRotation(-toRad(deg));
    },

    fitPath(points: LatLng[], fallback: LatLng | null, fit: FitOptions) {
      if (points.length >= 2) {
        view.fit(boundingExtent(points.map(toMapCoord)), {
          padding: [fit.padding, fit.padding, fit.padding, fit.padding],
          maxZoom: fit.maxZoom,
          duration: 250
        });
      } else if (fallback) {
        view.animate({ center: toMapCoord(fallback), zoom: LOCATED_ZOOM, duration: 250 });
      }
    },

    invalidateSize() {
      map.updateSize();
    },

    destroy() {
      map.setTarget(undefined);
      map.dispose();
    }
  };
}
