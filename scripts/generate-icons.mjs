/**
 * Generates the PWA / launcher icons from the Design_System palette.
 *
 *   node scripts/generate-icons.mjs
 *
 * This exists so the icons in `public/icons/` have provenance. Committing three
 * opaque PNGs that nobody can regenerate is how a palette change quietly leaves
 * the icon behind. Nothing is fetched and nothing is installed — the PNG encoder
 * below is about forty lines over Node's built-in zlib, which is cheaper than
 * adding an image dependency for three files.
 *
 * The mark is the product's own thesis drawn with four rectangles: a medical
 * cross above a bridge deck on two piers. Swasthya (health) over Setu (bridge).
 * It is axis-aligned on purpose — the Design_System's elevation is a hard offset
 * with zero blur and its radii are tooling radii, so a mark made of squared
 * shapes belongs to it and a soft gradient badge would not.
 *
 * Signal colours (--ss-high, --ss-med-fill, --ss-low) are deliberately absent.
 * They mean risk level and nothing else; using red here would make the app icon
 * read as an alert.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ── Palette, lifted verbatim from app/globals.css ── */
const CHROME = [0x0b, 0x3b, 0x33]; // --ss-chrome   petrol green
const GROUND = [0xe7, 0xeb, 0xe9]; // --ss-ground   cool porcelain
const WHITE = [0xff, 0xff, 0xff]; // --ss-chrome-fg

/* ────────────────────────────── PNG encoding ────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encodes an opaque RGB raster. Colour type 2, bit depth 8, filter 0. */
function encodePng(width, height, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ─────────────────────────────── The drawing ─────────────────────────────── */

/**
 * The mark on a 512-unit grid, as fractions so it scales to any size.
 * `inset` shrinks the composition toward the centre — the maskable icon needs
 * its content inside the safe zone, because Android crops a maskable icon to
 * whatever shape the launcher feels like and clips up to 20% off each edge.
 */
function rects(inset) {
  const scale = 1 - inset;
  const shift = (v) => 0.5 + (v - 0.5) * scale;
  const at = (x0, y0, x1, y1, color) => ({
    x0: shift(x0),
    y0: shift(y0),
    x1: shift(x1),
    y1: shift(y1),
    color,
  });

  return [
    /* Cross — the vertical bar, then the horizontal, drawn in that order so the
       joint is a single filled block rather than two overlapping strokes. */
    at(0.414, 0.164, 0.586, 0.633, WHITE),
    at(0.25, 0.32, 0.75, 0.492, WHITE),
    /* Setu — the deck, then the two piers. Deliberately heavier than looks right
       at 512: at a 48px launcher size a hairline deck disappears entirely, and
       the whole mark then reads as a plain cross. */
    at(0.172, 0.711, 0.828, 0.781, GROUND),
    at(0.258, 0.781, 0.328, 0.883, GROUND),
    at(0.672, 0.781, 0.742, 0.883, GROUND),
  ];
}

function render(size, inset) {
  const rgb = Buffer.alloc(size * size * 3);
  /* Field. */
  for (let i = 0; i < size * size; i += 1) {
    rgb[i * 3] = CHROME[0];
    rgb[i * 3 + 1] = CHROME[1];
    rgb[i * 3 + 2] = CHROME[2];
  }
  /* Shapes, painted in order. Rounded to whole pixels so every edge is crisp at
     every size — an anti-aliased 1px edge at 48px reads as a smudge. */
  for (const r of rects(inset)) {
    const x0 = Math.round(r.x0 * size);
    const y0 = Math.round(r.y0 * size);
    const x1 = Math.round(r.x1 * size);
    const y1 = Math.round(r.y1 * size);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const i = (y * size + x) * 3;
        rgb[i] = r.color[0];
        rgb[i + 1] = r.color[1];
        rgb[i + 2] = r.color[2];
      }
    }
  }
  return encodePng(size, size, rgb);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const files = [
  ['icon-192.png', render(192, 0.06)],
  ['icon-512.png', render(512, 0.06)],
  /* 28% inset keeps the mark inside the maskable safe zone with room to spare. */
  ['icon-maskable-512.png', render(512, 0.28)],
];

for (const [name, buf] of files) {
  writeFileSync(join(outDir, name), buf);
  console.log(`${name.padEnd(24)} ${String(buf.length).padStart(7)} bytes`);
}
