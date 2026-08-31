// Builds the bundled city index from GeoNames.
//
// Build-time only; the generated file in src/data/ is committed, so a normal
// `npm run build` needs no network. Regenerate with `npm run cities` when you
// want fresher data (GeoNames updates daily; this data barely moves).
//
// Source: https://download.geonames.org/export/dump/ — cities15000 is every
// city over 15,000 people plus every capital, ~34k rows. See PLAN.md for why
// this tier and not the 185k-row cities500 or an online geocoder.
//
// GeoNames data is CC BY 4.0. The attribution obligation is real and lives in
// README.md and the app's Settings → About.

import { inflateRawSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Lives under src/ rather than public/ so Vite treats it as an asset and
// content-hashes the emitted filename. public/ is copied verbatim, which is
// why this used to need a hand-maintained version number in the name.
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data');
const OUT_FILE = 'cities.tsv';

const CITIES_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const COUNTRIES_URL = 'https://download.geonames.org/export/dump/countryInfo.txt';

// GeoNames' main dump columns, of which we want very few.
const COL_NAME = 1;
const COL_ASCII = 2;
const COL_LAT = 4;
const COL_LNG = 5;
const COL_COUNTRY = 8;
const COL_POP = 14;

const TAB = '\t';
const NL = '\n';

/**
 * Read the single entry out of a ZIP. Doing this by hand rather than adding a
 * dependency: it's one deflate stream behind a documented fixed-size header,
 * and a mistake fails loudly at inflate rather than producing quiet garbage.
 */
function unzipSingleFile(buffer) {
  // The End Of Central Directory record is last, after a variable-length
  // comment, so scan backwards for its signature.
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a ZIP file: no end-of-central-directory record');

  const entries = buffer.readUInt16LE(eocd + 10);
  if (entries !== 1) throw new Error(`Expected 1 file in the archive, found ${entries}`);

  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (buffer.readUInt32LE(cdOffset) !== 0x02014b50) {
    throw new Error('Malformed ZIP: bad central directory signature');
  }
  const method = buffer.readUInt16LE(cdOffset + 10);
  const compressedSize = buffer.readUInt32LE(cdOffset + 20);
  const localOffset = buffer.readUInt32LE(cdOffset + 42);

  if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
    throw new Error('Malformed ZIP: bad local header signature');
  }
  // The local header repeats the name and extra-field lengths, and they can
  // differ from the central directory's — always trust the local ones here.
  const nameLen = buffer.readUInt16LE(localOffset + 26);
  const extraLen = buffer.readUInt16LE(localOffset + 28);
  const start = localOffset + 30 + nameLen + extraLen;
  const data = buffer.subarray(start, start + compressedSize);

  if (method === 0) return data; // stored
  if (method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported ZIP compression method ${method}`);
}

async function download(url) {
  console.log(`  fetching ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Combining diacritical marks, stripped after an NFD decomposition.
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Strip diacritics and case so "Timisoara" finds "Timișoara". Mirrors `fold()`
 * in src/lib/cities.ts — the two must agree or search silently misses.
 */
function fold(value) {
  return value.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}

console.log('Building the city index');

const [citiesZip, countriesTxt] = await Promise.all([
  download(CITIES_URL),
  download(COUNTRIES_URL)
]);

// countryInfo.txt: ISO code in column 0, country name in column 4, '#' comments.
const countries = new Map();
for (const line of countriesTxt.toString('utf8').split(NL)) {
  if (!line || line.startsWith('#')) continue;
  const cols = line.split(TAB);
  if (cols[0] && cols[4]) countries.set(cols[0], cols[4]);
}
console.log(`  ${countries.size} countries`);

const parsed = [];
let skipped = 0;

for (const line of unzipSingleFile(citiesZip).toString('utf8').split(NL)) {
  if (!line.trim()) continue;
  const c = line.split(TAB);
  const name = c[COL_NAME];
  const cc = c[COL_COUNTRY];
  const lat = Number(c[COL_LAT]);
  const lng = Number(c[COL_LNG]);
  if (!name || !cc || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    skipped++;
    continue;
  }

  // Keep the ASCII transliteration only when folding the name doesn't already
  // produce it — that's most rows, and it keeps the payload down.
  const ascii = c[COL_ASCII] ?? '';
  const asciiCol = ascii && fold(ascii) !== fold(name) ? ascii : '';

  parsed.push({
    name,
    ascii: asciiCol,
    cc,
    lat,
    lng,
    // Thousands: we only rank and label with this, and the full integer is
    // high-entropy noise that compresses badly.
    pop: Math.round((Number(c[COL_POP]) || 0) / 1000)
  });
}

// Group by country and order each group by latitude, so consecutive rows are
// geographically close. Their coordinates are then written as deltas, which
// turns high-entropy absolute values into small, highly compressible numbers —
// worth ~260 KB gzipped over writing them out in full.
const byCountry = new Map();
for (const city of parsed) {
  if (!byCountry.has(city.cc)) byCountry.set(city.cc, []);
  byCountry.get(city.cc).push(city);
}

const cityLines = [];
for (const cc of [...byCountry.keys()].sort()) {
  const group = byCountry.get(cc).sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  cityLines.push(`>${cc}`);
  // Deltas restart at each group, so a group's first row carries absolutes.
  let prevLat = 0;
  let prevLng = 0;
  for (const city of group) {
    // Millidegrees: ~110 m, which keeps the bearing error to a city well under
    // what the magnetometer contributes.
    const lat = Math.round(city.lat * 1000);
    const lng = Math.round(city.lng * 1000);
    cityLines.push([city.name, city.ascii, lat - prevLat, lng - prevLng, city.pop].join(TAB));
    prevLat = lat;
    prevLng = lng;
  }
}

const countryLines = [...byCountry.keys()]
  .sort()
  .map((cc) => `${cc}${TAB}${countries.get(cc) ?? cc}`);

const out = [
  '# Wayfinder city index v1',
  '# Source: GeoNames cities15000 (https://www.geonames.org/), CC BY 4.0',
  `# Generated: ${new Date().toISOString().slice(0, 10)}`,
  '# countries: cc<TAB>name',
  ...countryLines,
  '# cities, grouped by country. ">CC" opens a group.',
  '# row: name<TAB>ascii<TAB>dLat<TAB>dLng<TAB>population-in-thousands',
  '# dLat/dLng are millidegree deltas from the previous row, reset per group.',
  ...cityLines,
  ''
].join(NL);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, OUT_FILE), out, 'utf8');

const bytes = Buffer.byteLength(out, 'utf8');
console.log(`  ${parsed.length} cities across ${byCountry.size} countries`);
if (skipped) console.log(`  skipped ${skipped} malformed rows`);
console.log(`  wrote src/data/${OUT_FILE} — ${(bytes / 1024 / 1024).toFixed(2)} MB raw`);
