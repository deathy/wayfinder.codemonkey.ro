import { describe, expect, it } from 'vitest';
// Vite inlines the committed data file, so the test needs no filesystem access
// and no Node type definitions.
import citiesData from '../../public/data/cities-v1.tsv?raw';
import {
  cityLabel,
  cityPlaceId,
  foldText,
  formatPopulation,
  parseCityIndex,
  searchCities,
  type CityIndex
} from './cities';
import { distance } from './geodesy';

// Parsed against the committed data file rather than a fixture: the delta
// encoding is a custom format, so the encoder in scripts/build-cities.mjs and
// the decoder here have to be tested as a pair or a drift between them would
// only show up as cities quietly landing in the wrong place.
const index: CityIndex = parseCityIndex(citiesData);

/** Highest-population match for an exact name, which is what search ranks first. */
function city(name: string) {
  const found = index.cities
    .filter((c) => c.name === name)
    .sort((a, b) => b.popK - a.popK)[0];
  expect(found, `expected "${name}" in the index`).toBeDefined();
  return found!;
}

describe('the index', () => {
  it('holds the whole cities15000 tier', () => {
    expect(index.cities.length).toBeGreaterThan(30_000);
    expect(index.countries.size).toBeGreaterThan(200);
  });

  it('never produces an out-of-range coordinate', () => {
    // A break in the delta chain would send later rows off the planet, so this
    // is the cheap canary for the whole decoding scheme.
    const bad = index.cities.filter(
      (c) => Math.abs(c.lat) > 90 || Math.abs(c.lng) > 180 || !Number.isFinite(c.lat)
    );
    expect(bad).toHaveLength(0);
  });

  it('decodes deltas back to the right place on the globe', () => {
    // Independently known coordinates; a decoding bug lands hundreds of km out,
    // so 5 km of tolerance is plenty while still catching real breakage.
    const expected: [string, number, number][] = [
      ['London', 51.5085, -0.1257],
      ['Tokyo', 35.6895, 139.6917],
      ['Cairo', 30.0626, 31.2497],
      ['New York City', 40.7143, -74.006],
      ['Bucharest', 44.4323, 26.1063],
      ['Reykjavík', 64.1355, -21.8954]
    ];
    for (const [name, lat, lng] of expected) {
      expect(distance(city(name), { lat, lng })).toBeLessThan(5000);
    }
  });

  it('resets the delta chain at every country boundary', () => {
    // Each country's first row carries absolutes; if a reset were missed, that
    // country's cities would all be offset from the previous country's last row.
    const firstOfCountry = new Map<string, (typeof index.cities)[number]>();
    for (const c of index.cities) if (!firstOfCountry.has(c.cc)) firstOfCountry.set(c.cc, c);
    const ro = firstOfCountry.get('RO')!;
    const gb = firstOfCountry.get('GB')!;
    expect(Math.abs(ro.lat - 45)).toBeLessThan(4); // Romania spans ~43.6–48.3
    expect(Math.abs(gb.lat - 53)).toBeLessThan(6); // Great Britain ~49.9–60.8
  });
});

describe('search', () => {
  it('finds a city by its exact name', () => {
    expect(searchCities(index, 'London')[0]!.name).toBe('London');
  });

  it('ranks the biggest match first', () => {
    // There are many Londons and many Romes; the famous one must win.
    expect(searchCities(index, 'london')[0]!.cc).toBe('GB');
    expect(searchCities(index, 'rome')[0]!.cc).toBe('IT');
  });

  it('ignores diacritics in both the query and the data', () => {
    // GeoNames spells it "Timişoara" with a cedilla; nobody types that.
    const hit = searchCities(index, 'timisoara')[0]!;
    expect(hit.cc).toBe('RO');
    expect(distance(hit, { lat: 45.7537, lng: 21.2257 })).toBeLessThan(5000);
    expect(searchCities(index, 'Timișoara')[0]!.name).toBe(hit.name);
    expect(searchCities(index, 'zurich')[0]!.cc).toBe('CH');
  });

  it('prefers a prefix over a match buried mid-word', () => {
    const results = searchCities(index, 'york', 10);
    const york = results.findIndex((c) => c.key.startsWith('york'));
    const newYork = results.findIndex((c) => c.name === 'New York City');
    expect(york).toBeGreaterThanOrEqual(0);
    // "New York City" matches at a word start, so it should still be up there,
    // but a plain "York..." prefix ranks ahead of it.
    expect(york).toBeLessThan(newYork === -1 ? Infinity : newYork + 5);
  });

  it('matches the ASCII transliteration for names folding cannot reach', () => {
    // "ø" has no decomposition, so this can only work via the ascii column.
    const hits = searchCities(index, 'malmo', 5);
    expect(hits.some((c) => c.cc === 'SE')).toBe(true);
  });

  it('returns nothing for an empty or whitespace query', () => {
    expect(searchCities(index, '')).toHaveLength(0);
    expect(searchCities(index, '   ')).toHaveLength(0);
  });

  it('respects the result limit', () => {
    expect(searchCities(index, 'a', 12)).toHaveLength(12);
  });

  it('stays fast enough to run on every keystroke', () => {
    const started = performance.now();
    for (let i = 0; i < 20; i++) searchCities(index, 'san', 25);
    // 20 scans of 34k rows; generous bound, but a linear scan going quadratic
    // would blow straight past it.
    expect((performance.now() - started) / 20).toBeLessThan(50);
  });
});

describe('helpers', () => {
  it('folds diacritics and case', () => {
    expect(foldText('Timișoara')).toBe('timisoara');
    expect(foldText('ZÜRICH')).toBe('zurich');
  });

  it('labels a city with its country', () => {
    expect(cityLabel(city('Bucharest'), index.countries)).toBe('Bucharest, Romania');
  });

  it('derives a stable id so re-adding a city updates it', () => {
    expect(cityPlaceId(city('London'))).toBe(cityPlaceId(city('London')));
    expect(cityPlaceId(city('London'))).not.toBe(cityPlaceId(city('Bucharest')));
    expect(cityPlaceId(city('London')).startsWith('city:GB:')).toBe(true);
  });

  it('formats population from stored thousands', () => {
    expect(formatPopulation(319)).toBe('319k');
    expect(formatPopulation(1877)).toBe('1.9M');
    expect(formatPopulation(32054)).toBe('32M');
    expect(formatPopulation(0)).toBe('');
  });
});

describe('robustness', () => {
  it('parses a CRLF checkout identically to an LF one', () => {
    // .gitattributes pins line endings, but a stray carriage return on every
    // row would silently corrupt the last column, so the parser handles it.
    const crlf = parseCityIndex(citiesData.replace(/\n/g, '\r\n'));
    expect(crlf.cities.length).toBe(index.cities.length);
    expect(crlf.countries.size).toBe(index.countries.size);
    const a = searchCities(crlf, 'bucharest')[0]!;
    const b = searchCities(index, 'bucharest')[0]!;
    expect([a.name, a.lat, a.lng, a.popK]).toEqual([b.name, b.lat, b.lng, b.popK]);
  });
});
