# Wayfinder — which way is it?

Point your phone at a place and it tells you which way to turn. Bearing, distance,
and the **real** great-circle line over the ground — the one that curves on a map,
because that's what "shortest way there" actually looks like.

Which way is home from here. Which way is Mecca. Which way is the Great Pyramid,
3,000 km away behind a wall.

**Live:** https://wayfinder.codemonkey.ro

## Principles

- **Mobile-first.** A compass in your hand is the whole point.
- **Pure client-side.** No backend, no accounts, no analytics, no tracking.
- **Privacy by default.** Your saved places live in your browser's storage. They
  are never uploaded, and they are not part of this repo — the only coordinates in
  the source are famous public landmarks.
- **Yours to keep.** One-tap JSON export for backup or moving devices, and import
  to restore.
- **Offline-capable.** Installable PWA; the app shell works offline and visited map
  tiles are cached.

## How it works

- **Pick a target** from the slide-up drawer at the bottom, sorted nearest-first.
  Four public landmarks ship with the app: Timișoara, London, the Pyramids of Giza,
  and the Kaaba in Mecca.
- **The dial** counter-rotates against your compass heading, so N on screen really
  is north and the blue arrow sits physically over the target. Turn until the arrow
  points straight up and you're facing it — it turns green when you're within 8°.
- **The map** rotates so the way you're facing is up, and draws the great-circle
  path from you to the target. Turn to face the target and the line runs straight up
  the screen. On any long route that line is visibly a curve; a straight line on a
  Mercator map would be the wrong direction.
- **Heading-up or north-up** — the north arrow button in the bottom right shows where
  north has gone and switches between the two. It's the same button either way, so
  you can always find north again.
- **Save where you are** with a label, from the Places tab, so "home" is one tap away.
- **Find a city** — search ~34,000 cities worldwide by name. Accents are optional
  ("timisoara" finds "Timişoara"), results rank by population and show how far away
  they are, and picking one saves it and points at it in a single tap. The list is
  bundled with the app and searched entirely on your device — nothing is sent anywhere.

### About the compass

Browsers expose two incompatible orientation APIs and neither agrees on what north
means:

- **Android/Chrome** — `deviceorientationabsolute`. We derive the heading from the
  full rotation matrix rather than raw `alpha`, which keeps it correct when the phone
  is tilted, and switches to the phone's back-facing axis when you hold it upright.
- **iOS/Safari** — `deviceorientation` + `webkitCompassHeading`, after an explicit
  permission tap.
- **Neither available** — falls back to your GPS travel direction while you're moving,
  and failing that shows a north-up dial with the correct bearing.

Both platforms report **magnetic** north. Depending where you are that sits several
degrees off true north; correcting for it (World Magnetic Model) is on the roadmap,
and until then the app says which reference it's using rather than quietly pretending.
Readings are smoothed with a circular filter so the needle doesn't twitch.

See [PLAN.md](PLAN.md) for the reasoning behind these choices and what's next.

## Develop

```bash
npm install
npm run dev
```

```bash
npm test
```

The geodesy is covered by tests cross-checked against two independent formulas
(spherical law of cosines, 3D chord length) — the maths is the part that has to be
right, and it's the part you can't eyeball.

```bash
npm run build
```

The compass and geolocation both need a secure context, so a plain-HTTP LAN dev
server won't give you a heading on a phone. Test those against the deployed site.

## Deploy

Static assets on a Cloudflare Worker — see [`wrangler.jsonc`](wrangler.jsonc). Build
output is `dist/`, with an SPA fallback so deep links survive a refresh.

Motion sensors are gated by `Permissions-Policy`; the required header lives in
[`public/_headers`](public/_headers). Without it Chrome silently withholds
orientation events and the compass just never appears.

## Attribution

Map tiles © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.

City data from [GeoNames](https://www.geonames.org/), used under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The bundled index is built
from the `cities15000` dump by [`scripts/build-cities.mjs`](scripts/build-cities.mjs)
into `src/data/cities.tsv`, which is committed so a normal build needs no network;
regenerate it with `npm run cities`. The build emits it as a content-hashed asset, so
regenerating it invalidates caches on its own. Note that GeoNames' data licence is separate from
this repo's Apache-2.0 code licence.

## License

[Apache-2.0](LICENSE).
