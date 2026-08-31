// The bundled city index: ~34k places from GeoNames, fetched on first use and
// then cached by the service worker. Never loaded unless you open city search,
// so it costs nothing on a normal launch.
//
// The file format is written by scripts/build-cities.mjs — see the header of
// that file. Coordinates arrive as millidegree deltas from the previous row
// within a country group, which is what keeps a 34k-row index down to ~370 KB
// gzipped instead of ~630 KB.

export interface City {
  name: string;
  /** ISO country code. */
  cc: string;
  lat: number;
  lng: number;
  /** Population in thousands — used for ranking, and shown to disambiguate. */
  popK: number;
  /** Diacritic-folded name, precomputed so search doesn't redo it per keystroke. */
  key: string;
  /** Folded ASCII transliteration; empty when it matches `key`. */
  keyAscii: string;
}

export interface CityIndex {
  cities: City[];
  countries: Map<string, string>;
}

// Combining diacritical marks, stripped after an NFD decomposition.
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Strip diacritics and case so "Timisoara" finds "Timișoara". Must stay in
 * step with `fold()` in scripts/build-cities.mjs — if they disagree, search
 * misses silently rather than failing.
 *
 * Letters that don't decompose (ø, ł, đ) survive this untouched; those rows
 * carry GeoNames' ASCII transliteration in `keyAscii` instead.
 */
export function foldText(value: string): string {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

const CITIES_MARKER = '# cities';

export function parseCityIndex(text: string): CityIndex {
  const countries = new Map<string, string>();
  const cities: City[] = [];

  let readingCities = false;
  let cc = '';
  let lat = 0;
  let lng = 0;

  for (const raw of text.split('\n')) {
    // Tolerate a CRLF checkout: a stray carriage return would otherwise ride
    // along on the last column of every row.
    const line = raw.charCodeAt(raw.length - 1) === 13 ? raw.slice(0, -1) : raw;
    if (!line) continue;

    if (line.charCodeAt(0) === 35 /* # */) {
      if (line.startsWith(CITIES_MARKER)) readingCities = true;
      continue;
    }

    if (!readingCities) {
      const tab = line.indexOf('\t');
      if (tab > 0) countries.set(line.slice(0, tab), line.slice(tab + 1));
      continue;
    }

    // ">CC" opens a country group and restarts the delta chain.
    if (line.charCodeAt(0) === 62 /* > */) {
      cc = line.slice(1);
      lat = 0;
      lng = 0;
      continue;
    }

    const parts = line.split('\t');
    if (parts.length < 5) continue;
    lat += Number(parts[2]);
    lng += Number(parts[3]);
    const name = parts[0]!;
    const ascii = parts[1]!;
    cities.push({
      name,
      cc,
      lat: lat / 1000,
      lng: lng / 1000,
      popK: Number(parts[4]) || 0,
      key: foldText(name),
      keyAscii: ascii ? foldText(ascii) : ''
    });
  }

  return { cities, countries };
}

const DATA_URL = '/data/cities-v1.tsv';

let pending: Promise<CityIndex> | null = null;

/** Fetch and parse the index once per session; the SW caches the file itself. */
export function loadCityIndex(): Promise<CityIndex> {
  if (!pending) {
    pending = fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`City list unavailable (HTTP ${res.status})`);
        return res.text();
      })
      .then(parseCityIndex)
      .catch((err) => {
        // Don't cache a failure — a retry after reconnecting should work.
        pending = null;
        throw err;
      });
  }
  return pending;
}

// Ranked lowest (best) first: an exact prefix beats a word start, which beats a
// match buried mid-word. Population breaks ties, so "london" finds the big one.
const SCORE_PREFIX = 0;
const SCORE_WORD = 1;
const SCORE_SUBSTRING = 2;

function score(key: string, query: string): number {
  if (!key) return -1;
  if (key.startsWith(query)) return SCORE_PREFIX;
  const at = key.indexOf(query);
  if (at < 0) return -1;
  const before = key.charCodeAt(at - 1);
  // 32 = space, 45 = hyphen, 39 = apostrophe: the starts of "Frankfurt am Main".
  return before === 32 || before === 45 || before === 39 ? SCORE_WORD : SCORE_SUBSTRING;
}

/** Best matches for a query, nearest-to-exact first then by population. */
export function searchCities(index: CityIndex, query: string, limit = 25): City[] {
  const q = foldText(query.trim());
  if (!q) return [];

  const hits: { city: City; rank: number }[] = [];
  for (const city of index.cities) {
    let rank = score(city.key, q);
    if (rank < 0) rank = score(city.keyAscii, q);
    if (rank < 0) continue;
    hits.push({ city, rank });
  }

  hits.sort((a, b) => a.rank - b.rank || b.city.popK - a.city.popK);
  return hits.slice(0, limit).map((h) => h.city);
}

/** "Timișoara, Romania" — the label a picked city is saved under. */
export function cityLabel(city: City, countries: Map<string, string>): string {
  return `${city.name}, ${countries.get(city.cc) ?? city.cc}`;
}

/**
 * Stable id derived from the city itself, so adding the same city twice updates
 * the saved place instead of piling up duplicates.
 */
export function cityPlaceId(city: City): string {
  return `city:${city.cc}:${city.lat.toFixed(3)},${city.lng.toFixed(3)}`;
}

/** Population for display, from the stored thousands. */
export function formatPopulation(popK: number): string {
  if (popK <= 0) return '';
  if (popK >= 1000) return `${(popK / 1000).toFixed(popK >= 10_000 ? 0 : 1)}M`;
  return `${popK}k`;
}
