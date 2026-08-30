// Generates the PWA app icons from the compass logo. Build-time only; the
// generated PNGs in public/ are committed. Run with `npm run icons`.
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const BG = '#0f172a';
const RING = '#38bdf8';
const NORTH = '#f87171';
const SOUTH = '#e2e8f0';
// Same compass rose as favicon.svg: a ring with a red-tipped needle.
const COMPASS = `<circle cx="32" cy="32" r="23" fill="none" stroke="${RING}" stroke-width="3"/>
  <path d="M32 11 L39.5 33 L32 29 L24.5 33 Z" fill="${NORTH}"/>
  <path d="M32 53 L24.5 31 L32 35 L39.5 31 Z" fill="${SOUTH}"/>`;

function iconSvg(size, { maskable = false } = {}) {
  // Maskable icons must be full-bleed (the OS applies its own circle/squircle
  // mask), and the logo must stay inside the ~80% safe zone — so no rounded
  // corners and a slightly shrunk, centred rose. "any" icons keep the rounding.
  const rx = maskable ? 0 : 14;
  const rose = maskable
    ? `<g transform="translate(32 32) scale(0.78) translate(-32 -32)">${COMPASS}</g>`
    : COMPASS;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="${rx}" fill="${BG}"/>
  ${rose}
</svg>`;
}

async function render(name, size, opts) {
  const png = await sharp(Buffer.from(iconSvg(size, opts))).png().toBuffer();
  writeFileSync(join(publicDir, name), png);
  console.log(`  ${name} (${size}x${size})`);
}

console.log('Generating PWA icons into public/');
await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('icon-maskable-512.png', 512, { maskable: true });
console.log('Done.');
