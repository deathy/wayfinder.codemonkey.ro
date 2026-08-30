import { useEffect, useMemo, useState } from 'preact/hooks';
import { Compass } from './components/Compass';
import { MapView } from './components/MapView';
import { PlaceDrawer, type PlaceEntry } from './components/PlaceDrawer';
import { PlacesView } from './components/PlacesView';
import type { PlaceInput } from './components/PlaceForm';
import { SettingsView } from './components/SettingsView';
import { clearPlaces, deletePlace, getSavedPlaces, putPlace } from './lib/db';
import { GEO_ERROR_TEXT, watchPosition, type GeoError } from './lib/geo';
import { distance, greatCirclePath, initialBearing, type Units } from './lib/geodesy';
import {
  MIN_COURSE_SPEED_MPS,
  compassSupport,
  requestCompassPermission,
  watchHeading
} from './lib/heading';
import { BUILTIN_PLACES } from './lib/places';
import { useMapBearing } from './lib/useMapBearing';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './lib/settings';
import type { GpsFix, Heading, Place } from './lib/types';

type View = 'map' | 'places' | 'settings';

export function App() {
  const [view, setView] = useState<View>('map');
  const [saved, setSaved] = useState<Place[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [location, setLocation] = useState<GpsFix | null>(null);
  const [geoError, setGeoError] = useState<GeoError | null>(null);
  const [sensorHeading, setSensorHeading] = useState<Heading | null>(null);
  const [compassAsked, setCompassAsked] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Bumped to ask the map to frame the whole route; a counter rather than a
  // boolean so repeated taps each trigger a fresh fit.
  const [fitRequest, setFitRequest] = useState(0);

  useEffect(() => {
    setSettings(loadSettings());
    getSavedPlaces().then(setSaved);
  }, []);

  useEffect(
    () =>
      watchPosition(
        (fix) => {
          setLocation(fix);
          setGeoError(null);
        },
        (err) => setGeoError(err)
      ),
    []
  );

  // iOS won't emit orientation events until it has been asked from a gesture, so
  // there's no point subscribing before the user has granted it.
  const needsCompassPermission = compassSupport() === 'needs-permission' && !compassAsked;

  useEffect(() => {
    if (needsCompassPermission) return;
    return watchHeading(setSensorHeading);
  }, [needsCompassPermission]);

  function updateSettings(patch: Partial<Settings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }

  async function onRequestCompass() {
    const granted = await requestCompassPermission();
    setCompassAsked(true);
    if (!granted) setSensorHeading(null);
  }

  // Falling back to the GPS course keeps the dial useful on a device with no
  // magnetometer — as long as you're actually moving.
  const heading: Heading | null = useMemo(() => {
    if (sensorHeading) return sensorHeading;
    if (location?.courseDeg !== undefined && (location.speedMps ?? 0) >= MIN_COURSE_SPEED_MPS) {
      return { degrees: location.courseDeg, reference: 'true', source: 'gps' };
    }
    return null;
  }, [sensorHeading, location]);

  const places = useMemo(
    () => [...saved, ...BUILTIN_PLACES.filter((p) => !settings.hiddenBuiltins.includes(p.id))],
    [saved, settings.hiddenBuiltins]
  );

  const target = places.find((p) => p.id === settings.targetId) ?? null;

  const entries = useMemo<PlaceEntry[]>(() => {
    const list = places.map((place) => ({
      place,
      distanceM: location ? distance(location, place) : null,
      bearing: location ? initialBearing(location, place) : null
    }));
    // Nearest first once we know where we are; otherwise keep the natural order
    // (your places above the samples).
    if (location) list.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));
    return list;
  }, [places, location]);

  const path = useMemo(
    () => (location && target ? greatCirclePath(location, target) : []),
    [location, target]
  );

  // Heavily damped, so magnetometer jitter doesn't make the viewport seasick.
  const mapBearing = useMapBearing(heading?.degrees ?? null, settings.headingUp);

  const targetDistance = location && target ? distance(location, target) : null;
  const targetBearing = location && target ? initialBearing(location, target) : null;

  async function onSavePlace(input: PlaceInput) {
    const now = Date.now();
    const existing = input.id ? saved.find((p) => p.id === input.id) : undefined;
    await putPlace({
      id: input.id ?? crypto.randomUUID(),
      label: input.label,
      lat: input.lat,
      lng: input.lng,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    setSaved(await getSavedPlaces());
  }

  async function onDeletePlace(id: string) {
    await deletePlace(id);
    setSaved(await getSavedPlaces());
    if (settings.targetId === id) updateSettings({ targetId: null });
  }

  async function onClearPlaces() {
    await clearPlaces();
    setSaved([]);
    if (settings.targetId && !settings.targetId.startsWith('builtin:')) {
      updateSettings({ targetId: null });
    }
  }

  function onToggleBuiltin(id: string) {
    const hidden = settings.hiddenBuiltins.includes(id);
    updateSettings({
      hiddenBuiltins: hidden
        ? settings.hiddenBuiltins.filter((x) => x !== id)
        : [...settings.hiddenBuiltins, id],
      // Hiding the place you're pointing at leaves nothing to point at.
      targetId: !hidden && settings.targetId === id ? null : settings.targetId
    });
  }

  function selectTarget(id: string) {
    updateSettings({ targetId: id });
    setDrawerOpen(false);
    setFitRequest((n) => n + 1);
  }

  const units: Units = settings.units;

  return (
    <div class="app">
      <main class="content">
        {/* The map stays mounted across tabs so it keeps its view and tiles. */}
        <div class="map-wrap" hidden={view !== 'map'}>
          <MapView
            location={location}
            target={target}
            path={path}
            bearing={mapBearing}
            active={view === 'map'}
            fitRequest={fitRequest}
          />

          <div class="hud">
            <Compass
              bearing={targetBearing}
              headingDeg={heading?.degrees ?? null}
              distanceM={targetDistance}
              units={units}
            />
          </div>

          <div class="map-buttons">
            {/* Doubles as a rotation indicator: the arrow shows where north has
                gone, and tapping it puts the map back north-up. */}
            <button
              class={`round${settings.headingUp ? ' active' : ''}`}
              title={settings.headingUp ? 'Map follows your heading' : 'Map is north-up'}
              aria-pressed={settings.headingUp}
              onClick={() => updateSettings({ headingUp: !settings.headingUp })}
            >
              <svg viewBox="0 0 24 24" class="north-arrow" style={{ transform: `rotate(${-mapBearing}deg)` }}>
                <path d="M12 3 L16.5 20 L12 16.5 L7.5 20 Z" />
              </svg>
            </button>
            <button
              class="round"
              title="Frame the route"
              onClick={() => setFitRequest((n) => n + 1)}
            >
              ⤢
            </button>
          </div>

          {geoError && <div class="banner">{GEO_ERROR_TEXT[geoError]}</div>}
          {!geoError && needsCompassPermission && (
            <button class="banner banner-action" onClick={onRequestCompass}>
              Tap to enable the compass
            </button>
          )}
          {!geoError && !needsCompassPermission && !heading && (
            <div class="banner banner-dim">No compass — the dial is north-up</div>
          )}

          <PlaceDrawer
            entries={entries}
            targetId={settings.targetId}
            open={drawerOpen}
            units={units}
            onToggle={() => setDrawerOpen((o) => !o)}
            onSelect={selectTarget}
          />
        </div>

        {view === 'places' && (
          <PlacesView
            saved={saved}
            builtins={BUILTIN_PLACES}
            hiddenBuiltins={settings.hiddenBuiltins}
            location={location}
            onSave={onSavePlace}
            onDelete={onDeletePlace}
            onToggleBuiltin={onToggleBuiltin}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            units={units}
            onUnits={(u) => updateSettings({ units: u })}
            heading={heading}
            needsCompassPermission={needsCompassPermission}
            onRequestCompass={onRequestCompass}
            savedCount={saved.length}
            onDataChanged={async () => setSaved(await getSavedPlaces())}
            onClearPlaces={onClearPlaces}
          />
        )}
      </main>

      <nav class="tabbar">
        <button class={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>
          <span class="tab-icon">🧭</span>Point
        </button>
        <button class={view === 'places' ? 'active' : ''} onClick={() => setView('places')}>
          <span class="tab-icon">≣</span>Places
        </button>
        <button class={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')}>
          <span class="tab-icon">⚙</span>Settings
        </button>
      </nav>
    </div>
  );
}
