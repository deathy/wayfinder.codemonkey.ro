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
| Map | Leaflet + raw OSM tiles | Free, keyless, no account; fine for personal scale |
| Map orientation | North-up, rotating needle | Rotating tiles rotates their labels too; a needle is easier to trust than a map moving under your thumb |
| Route line | Sampled great circle | The honest "line of sight". A straight Mercator line points the wrong way over any distance |
| Earth model | Sphere, R = 6 371 008.8 m | ~0.5% on distance, a fraction of a degree on bearing — far inside magnetometer error, and keeps the maths auditable |
| Heading | Rotation matrix, not raw `alpha` | Stays correct when the phone is tilted; falls back to the back-facing axis when held upright |
| Smoothing | Circular EMA on the unit vector | Averaging angles makes 359° and 1° average to 180°; averaging vectors doesn't |
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

## Roadmap

### Phase 1 — done

- Map, live position, four sample places, distance-sorted drawer.
- Bearing/distance maths with tests cross-checked against independent formulas.
- Great-circle path with antimeridian-safe longitude unwrapping.
- Compass dial: tilt-tolerant heading, smoothing, GPS-course and north-up fallbacks.
- Save/edit/delete your own places; hide built-ins; units; JSON export/import.
- PWA, Cloudflare Worker config, sensor `Permissions-Policy` header.

### Phase 2 — after the first phone test

- **True north**: vendor a World Magnetic Model implementation, correct the heading,
  and show which reference is live.
- **Target by pin or paste**: long-press the map to point at an arbitrary spot; paste
  coordinates, a `geo:` URI, or a maps link. Cheap, and probably covers most of what
  search would.
- **Share a target** as a URL.
- Proximity/arrival feedback (haptic when the needle lines up, distance countdown).
- Compass calibration detection and a clearer "your compass is lying" state.
- Reorder places; colour/icon per place.

### Phase 3 — city search

**Chosen: one bundled global file.** GeoNames `cities15000` (~26k cities), stripped to
`name, country, lat, lng, pop` with coordinates at 4 decimals, ≈1 MB raw / ~300 KB
gzipped. Lazy-loaded on first search, then service-worker cached. Fully offline, no
third-party lookups, one build script.

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
