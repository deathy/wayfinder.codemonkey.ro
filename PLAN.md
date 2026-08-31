# Wayfinder — design decisions & roadmap

Working notes for `wayfinder.codemonkey.ro`. Goals, the "why" behind choices, and
what's next. Kept in the repo as living documentation.

## Goal

Show the direction to a chosen place: a compass needle that points at it in real
space, the bearing and distance as numbers, and the true great-circle line drawn on
a map. Personal tool, mobile-first, fully client-side, deployable as static content
to Cloudflare.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Name | `wayfinder.codemonkey.ro` | Says what it does; matches the `qr.` / `spot.` sibling pattern |
| Framework | Preact + Vite + TS | Matches the sibling apps; tiny runtime, fast build |
| Map | OpenLayers + raw OSM tiles | Rotation is a first-class `View` property, not a plugin patch; keeps us on free keyless tiles with no third-party service |
| Map orientation | Heading-up, toggleable | A north-up map is hard to relate to what's in front of you, which is the app's whole job. North-up stays one tap away |
| Map engine | Behind a `MapEngine` interface | Nothing outside `src/map/` imports OpenLayers, so swapping to MapLibre is one new file, not a rewrite |
| Map damping | Own filter, α = 0.08 per frame | The needle's α = 0.25 applied to a whole viewport is nauseating; driven by rAF, not renders, so a steady sensor can't strand it mid-turn |
| Route line | Sampled great circle | The honest "line of sight". A straight Mercator line points the wrong way over any distance |
| Earth model | Sphere, R = 6 371 008.8 m | ~0.5% on distance, a fraction of a degree on bearing — far inside magnetometer error, and keeps the maths auditable |
| Heading | Rotation matrix, not raw `alpha` | Stays correct when the phone is tilted; falls back to the back-facing axis when held upright |
| Smoothing | Circular EMA on the unit vector | Averaging angles makes 359° and 1° average to 180°; averaging vectors doesn't |
| City search | Bundled GeoNames `cities15000` | ~34k cities, searched on-device. No geocoder means no query ever leaves the browser |
| City encoding | Millidegree deltas, country-grouped | Absolute coordinates are high-entropy and compress badly: 367 KB gzipped instead of 626 KB |
| Data asset | `src/data/`, imported with `?url` | Vite content-hashes it, so it can be cached immutably and a regenerated index arrives under a new name. `public/` is copied verbatim and would need a hand-bumped version |
| Storage | IndexedDB (`idb`) + localStorage | Places in IDB (room to grow), preferences in localStorage |
| PWA | `vite-plugin-pwa` from the start | Installable, offline shell + runtime-cached tiles |
| Deploy | Cloudflare static-assets Worker | Same as sibling projects; SPA fallback |
| License | Apache-2.0 | Intended open-source |

## Privacy stance

This repo is meant to be published, so **no coordinates in the source say anything
about where anyone actually is**. The four built-in places are public landmarks. Your
own places live only in your browser's IndexedDB and only ever leave it if you press
Export yourself. The only network traffic the app makes is map tiles.

## Data model

```ts
interface Place {
  id: string;          // `builtin:` prefix for the shipped samples
  label: string;
  lat: number;
  lng: number;
  builtin?: boolean;   // shipped in code; not editable, only hideable
  createdAt: number;
  updatedAt: number;
}
```

- IndexedDB store: `places` (key `id`, index `by-updated`). Built-ins are never stored.
- Export shape = stored shape, wrapped and versioned via `EXPORT_VERSION`.
- Import is additive and id-keyed, so re-importing the same file is a no-op rather
  than a pile of duplicates.

## The map engine seam

`src/map/types.ts` defines a `MapEngine` interface that speaks only lat/lng and
degrees. Nothing outside `src/map/` imports OpenLayers — `MapView` drives the
interface, and `src/map/index.ts` is the single line that picks an implementation.

Markers are DOM elements rather than engine-native styled features, because
OpenLayers `Overlay` and MapLibre `Marker` both position a DOM node — so the pins,
their CSS and their animations port across untouched.

**Swapping to MapLibre** means adding `src/map/maplibre.ts` that satisfies
`MapEngine` and changing which factory `createMapEngine` points at. The reason to
do it is labels: raster tiles have their text baked in, so it rotates with the map
and reads sideways when you face south. Only vector tiles keep labels upright.
Measured costs of that swap: ~+62 KB gzipped over OpenLayers, and a dependency on
a keyless but donation-funded, no-SLA tile service (OpenFreeMap), where today the
app talks to nothing but OSM raster tiles.

Measured bundle sizes, for when that trade-off comes up again (gzipped):

| Engine | JS | App total |
|---|---|---|
| Leaflet (no rotation) | 42.5 KB | 58 KB |
| Leaflet + `leaflet-rotate` | 48.4 KB | ~64 KB |
| **OpenLayers (current)** | **89.4 KB + 1.4 KB CSS** | **107 KB** |
| MapLibre GL + vector tiles | 142.5 KB + 10.4 KB CSS | ~168 KB |

## Open questions / known gaps

- **Magnetic vs true north.** Both platform APIs report magnetic. The declination is
  ~6°E around Timișoara and ~3°E at Mecca — enough to matter for a qibla, not enough
  to matter for "which way is the pub". Currently reported honestly rather than
  corrected.
- **Screen-rotation sign.** `toScreenFrame()` adds `screen.orientation.angle`. The
  manifest locks portrait so this is a no-op in the installed app, but the sign needs
  checking in a landscape browser tab.
- **Magnetometer calibration.** Android readings drift until the phone is waved in a
  figure-eight. There's a hint in Settings, no detection.
- **Rotated labels.** The heading-up map rotates raster tiles, text and all. Living
  with it for now; see the engine seam above for the fix and its price.

## Roadmap

### Phase 1 — done

- Map, live position, four sample places, distance-sorted drawer.
- Bearing/distance maths with tests cross-checked against independent formulas.
- Great-circle path with antimeridian-safe longitude unwrapping.
- Compass dial: tilt-tolerant heading, smoothing, GPS-course and north-up fallbacks.
- Save/edit/delete your own places; hide built-ins; units; JSON export/import.
- PWA, Cloudflare Worker config, sensor `Permissions-Policy` header.

### Phase 2 — in progress

- **Heading-up map** — done. OpenLayers behind the `MapEngine` seam, with its own
  damping filter and a north-arrow button that doubles as a rotation indicator.
- **True north**: vendor a World Magnetic Model implementation, correct the heading,
  and show which reference is live.
- **Target by pin or paste**: long-press the map to point at an arbitrary spot; paste
  coordinates, a `geo:` URI, or a maps link. Cheap, and probably covers most of what
  search would.
- **Share a target** as a URL.
- Proximity/arrival feedback (haptic when the needle lines up, distance countdown).
- Compass calibration detection and a clearer "your compass is lying" state.
- Reorder places; colour/icon per place.

### Phase 3 — city search — done

**One bundled global file**, as chosen. GeoNames `cities15000` turned out to be 34,127
rows (the dump has grown), which at 4 decimals and full population integers came to
626 KB gzipped — double the estimate. Encoding fixed that:

- Coordinates as **millidegree deltas** from the previous row, grouped by country and
  ordered by latitude within a group, so neighbouring rows differ by small numbers.
- **Population in thousands**, since it's only used for ranking and a label.
- 3 decimals (~110 m). At 20 km that's 0.3° of bearing error, far inside what the
  magnetometer contributes.

Result: **367 KB gzipped / 322 KB brotli**, fetched on first search and then kept by
the service worker. It lives in `src/data/` and is imported with `?url`, so the build
emits it as `assets/cities-<hash>.tsv`; `public/_headers` caches everything under
`/assets/` immutably for a year, which is only safe *because* the names are hashed. Base36 deltas were measured too and saved ~1%, not worth the loss
of a human-readable file.

Search folds diacritics on both sides, so "timisoara" finds "Timişoara", and falls back
to GeoNames' ASCII transliteration for letters that don't decompose (ø, ł, đ). Ranking
is prefix > word-start > substring, then population — so "london" gives the British one
and "rome" beats "Romeoville".

**Known gap: English exonyms.** The index carries each city's GeoNames primary name,
which is usually the English one (Munich, Rome, Vienna, Prague, Warsaw all present) but
not always — Cologne is "Köln" and Mecca is "Makkah". The dump's `alternatenames`
column was measured as a fix and rejected: it added 651 KB raw and its first entries
are mostly noise ("Köln → Augusta Ubiorum, CGN, Cologna"), not the English name. The
real fix would be filtering `alternateNames.txt` to `isPreferredName` + `lang=en`, which
means processing a ~400 MB file in the build.

Rejected alternatives, recorded so we don't re-litigate:

- **Online geocoder** (Photon/Nominatim): zero bundle, but every keystroke leaves the
  device — against the whole point — and Nominatim's policy forbids autocomplete.
- **Per-country shards** down to `cities500`: village-level coverage, but adds a
  "pick a country first" step and ~250 generated assets. Revisit only if the global
  file proves too coarse.
- **Prefix-bucketed static index**: scales to the full 12M-row dump, but that's real
  machinery for a personal app.

GeoNames is **CC BY 4.0** — data licenses separately from the Apache-2.0 code, but the
attribution obligation is real and must land in the README and in-app About.
