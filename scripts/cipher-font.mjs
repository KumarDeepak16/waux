// Builds "WAUX Cipher": a TrueType font that draws every Basic Multilingual
// Plane character as one of 16 dot-matrix glyphs. Applied with CSS to
// sensitive text, it hides content without touching WhatsApp's DOM; word
// lengths and layout stay intact, and removing the font reveals the text.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const UPM = 1000;
const ASC = 880;
const DESC = 220;
const ADV = 540; // fallback advance for characters Geist does not cover
const SPACE_ADV = 260;
const DOT = 124;
const COLS = [86, 290];
const ROWS = [0, 172, 344, 516];
const VARIANTS = 16;
const STEP = 10; // advances are rounded to this, to bound the glyph count
const NARROW = 380; // below this advance, a glyph draws one centered column

const SPACES = new Set([0x20, 0xa0, 0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200a, 0x202f, 0x205f, 0x3000]);
const unmapped = (cp) =>
  cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || (cp >= 0xd800 && cp <= 0xdfff) || (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f) || cp === 0xfeff || cp >= 0xfffe;

/** Geist Regular's advance per code point (also 1000 UPM). Cipher text takes
 *  the room the real text will, so revealing it does not reflow. */
function geistAdvances() {
  const b = readFileSync(path.resolve(import.meta.dirname, '../node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf'));
  const t = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) t[b.toString('latin1', 12 + i * 16, 16 + i * 16)] = b.readUInt32BE(20 + i * 16);
  const metrics = b.readUInt16BE(t.hhea + 34);
  const adv = (g) => b.readUInt16BE(t.hmtx + 4 * Math.min(g, metrics - 1));
  let sub = 0; // cmap subtable 3/1, format 4
  for (let i = 0; i < b.readUInt16BE(t.cmap + 2); i++) {
    const o = t.cmap + 4 + i * 8;
    if (b.readUInt16BE(o) === 3 && b.readUInt16BE(o + 2) === 1) sub = t.cmap + b.readUInt32BE(o + 4);
  }
  const segX2 = b.readUInt16BE(sub + 6);
  const ends = sub + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
  const out = new Map();
  for (let s = 0; s < segX2; s += 2) {
    const start = b.readUInt16BE(starts + s), end = b.readUInt16BE(ends + s);
    const delta = b.readUInt16BE(deltas + s), ro = b.readUInt16BE(ranges + s);
    for (let cp = start; cp <= end && cp < 0xffff; cp++) {
      const g = ro ? b.readUInt16BE(ranges + s + ro + 2 * (cp - start)) : cp;
      if (g && (g + delta) & 0xffff) out.set(cp, adv((g + delta) & 0xffff));
    }
  }
  return out;
}

const GEIST = geistAdvances();

/** [variant, advance] for a code point; variant -1 draws nothing. */
function shapeOf(cp) {
  const a = GEIST.get(cp);
  const variant = SPACES.has(cp) || a === 0 ? -1 : cp % VARIANTS;
  if (a === undefined) return [variant, variant < 0 ? SPACE_ADV : ADV];
  return [variant, Math.round(a / STEP) * STEP];
}

// Glyph ids: 0 none, 1 space, 2..17 cipher at the fallback advances, then one
// glyph per other (variant, advance) pair Geist needs.
const EXTRA = new Map();
for (const cp of GEIST.keys()) {
  if (unmapped(cp)) continue;
  const [v, a] = shapeOf(cp);
  const key = `${v}:${a}`;
  if (a !== (v < 0 ? SPACE_ADV : ADV) && !EXTRA.has(key)) EXTRA.set(key, 2 + VARIANTS + EXTRA.size);
}

export function glyphFor(cp) {
  if (unmapped(cp)) return 0;
  const [v, a] = shapeOf(cp);
  return EXTRA.get(`${v}:${a}`) ?? (v < 0 ? 1 : 2 + v);
}

// Deterministic dot patterns: 8 cells (2 cols x 4 rows), 3 to 6 dots each.
function patterns() {
  let seed = 0x5eed;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out = [];
  while (out.length < VARIANTS) {
    let bits = 0;
    for (let i = 0; i < 8; i++) if (rand() < 0.62) bits |= 1 << i;
    const n = bits.toString(2).replace(/0/g, '').length;
    if (n < 4 || n > 7 || out.includes(bits)) continue;
    out.push(bits);
  }
  return out;
}

class W {
  constructor() {
    this.parts = [];
  }
  u8(v) { const b = Buffer.alloc(1); b.writeUInt8(v & 0xff); this.parts.push(b); return this; }
  u16(v) { const b = Buffer.alloc(2); b.writeUInt16BE(v & 0xffff); this.parts.push(b); return this; }
  i16(v) { const b = Buffer.alloc(2); b.writeInt16BE(v); this.parts.push(b); return this; }
  u32(v) { const b = Buffer.alloc(4); b.writeUInt32BE(v >>> 0); this.parts.push(b); return this; }
  bytes(b) { this.parts.push(Buffer.from(b)); return this; }
  done() { return Buffer.concat(this.parts); }
}

function glyphData(bits, adv = ADV) {
  // Narrow letters get one centered column; others scale down or center.
  const scale = Math.min(adv / ADV, 1);
  const shift = Math.max(0, (adv - ADV) / 2);
  const rects = [];
  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    if (!(bits & (1 << i))) continue;
    const x = Math.round(adv < NARROW ? (adv - DOT) / 2 : COLS[i % 2] * scale + shift);
    const y = ROWS[i >> 1];
    if (seen.has(`${x},${y}`)) continue;
    seen.add(`${x},${y}`);
    rects.push([x, y, x + DOT, y + DOT]);
  }
  const xs = rects.flatMap((r) => [r[0], r[2]]);
  const ys = rects.flatMap((r) => [r[1], r[3]]);
  const w = new W().i16(rects.length).i16(Math.min(...xs)).i16(Math.min(...ys)).i16(Math.max(...xs)).i16(Math.max(...ys));
  rects.forEach((_, i) => w.u16(i * 4 + 3));
  w.u16(0); // no instructions
  const pts = rects.flatMap(([x0, y0, x1, y1]) => [[x0, y0], [x0, y1], [x1, y1], [x1, y0]]); // clockwise
  pts.forEach(() => w.u8(0x01)); // on-curve, int16 deltas
  let px = 0;
  for (const [x] of pts) { w.i16(x - px); px = x; }
  let py = 0;
  for (const [, y] of pts) { w.i16(y - py); py = y; }
  return { data: w.done(), xMin: Math.min(...xs), xMax: Math.max(...xs), rects: rects.length };
}

function cmapFormat4() {
  const segs = [];
  let cp = 0;
  while (cp <= 0xfffd) {
    const g = glyphFor(cp);
    if (!g) { cp++; continue; }
    let end = cp;
    // Extend while glyph ids stay consecutive (one idDelta per segment).
    while (end + 1 <= 0xfffd && glyphFor(end + 1) === g + (end + 1 - cp) && g >= 2) end++;
    segs.push([cp, end, (g - cp) & 0xffff]);
    cp = end + 1;
  }
  segs.push([0xffff, 0xffff, 1]);
  const n = segs.length;
  const searchRange = 2 * 2 ** Math.floor(Math.log2(n));
  const w = new W().u16(4).u16(16 + n * 8).u16(0).u16(n * 2).u16(searchRange).u16(Math.log2(searchRange / 2)).u16(n * 2 - searchRange);
  segs.forEach((s) => w.u16(s[1]));
  w.u16(0);
  segs.forEach((s) => w.u16(s[0]));
  segs.forEach((s) => w.u16(s[2]));
  segs.forEach(() => w.u16(0));
  const sub = w.done();
  return new W().u16(0).u16(2).u16(0).u16(3).u32(20).u16(3).u16(1).u32(20).bytes(sub).done();
}

function nameTable() {
  const names = [
    [1, 'WAUX Cipher'],
    [2, 'Regular'],
    [3, 'WAUX Cipher 1.0'],
    [4, 'WAUX Cipher Regular'],
    [5, 'Version 1.0'],
    [6, 'WAUXCipher-Regular'],
  ];
  const strings = names.map(([, s]) => Buffer.from(s, 'utf16le').swap16());
  const w = new W().u16(0).u16(names.length).u16(6 + names.length * 12);
  let off = 0;
  names.forEach(([id], i) => {
    w.u16(3).u16(1).u16(0x409).u16(id).u16(strings[i].length).u16(off);
    off += strings[i].length;
  });
  strings.forEach((s) => w.bytes(s));
  return w.done();
}

const pad4 = (b) => (b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b);
function checksum(buf) {
  const b = pad4(buf);
  let sum = 0;
  for (let i = 0; i < b.length; i += 4) sum = (sum + b.readUInt32BE(i)) >>> 0;
  return sum;
}

export function buildCipherFont() {
  const pats = patterns();
  const glyphs = [{ data: Buffer.alloc(0), xMin: 0, adv: ADV }, { data: Buffer.alloc(0), xMin: 0, adv: SPACE_ADV }];
  let maxRects = 0;
  let xMin = COLS[0];
  let xMax = COLS[1] + DOT;
  const add = (bits, adv) => {
    if (bits === undefined) return glyphs.push({ data: Buffer.alloc(0), xMin: 0, adv });
    const g = glyphData(bits, adv);
    maxRects = Math.max(maxRects, g.rects);
    xMin = Math.min(xMin, g.xMin);
    xMax = Math.max(xMax, g.xMax);
    glyphs.push({ data: pad4(g.data), xMin: g.xMin, adv });
  };
  for (const bits of pats) add(bits, ADV);
  for (const key of EXTRA.keys()) {
    const [v, a] = key.split(':').map(Number);
    add(v < 0 ? undefined : pats[v], a);
  }
  const numGlyphs = glyphs.length;
  const maxAdv = Math.max(...glyphs.map((g) => g.adv));

  const glyf = Buffer.concat(glyphs.map((g) => g.data));
  const loca = new W();
  let off = 0;
  for (const g of glyphs) { loca.u32(off); off += g.data.length; }
  loca.u32(off);
  const hmtx = new W();
  glyphs.forEach((g) => hmtx.u16(g.adv).i16(g.xMin));

  const head = new W().u32(0x00010000).u32(0x00010000).u32(0).u32(0x5f0f3cf5).u16(0x000b).u16(UPM)
    .u32(0).u32(0).u32(0).u32(0) // created, modified
    .i16(xMin).i16(0).i16(xMax).i16(ROWS[3] + DOT)
    .u16(0).u16(8).i16(2).i16(1).i16(0).done();
  const hhea = new W().u32(0x00010000).i16(ASC).i16(-DESC).i16(0).u16(maxAdv).i16(0).i16(0).i16(xMax)
    .i16(1).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).i16(0).u16(numGlyphs).done();
  const maxp = new W().u32(0x00010000).u16(numGlyphs).u16(maxRects * 4).u16(maxRects)
    .u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).done();
  const os2 = new W().u16(4).i16(ADV).u16(400).u16(5).u16(0)
    .i16(650).i16(600).i16(0).i16(75).i16(650).i16(600).i16(0).i16(350).i16(50).i16(300)
    .i16(0).bytes(Buffer.alloc(10))
    .u32(0x00000003).u32(0).u32(0).u32(0)
    .bytes(Buffer.from('WAUX'))
    .u16(0x40).u16(0x20).u16(0xfffd)
    .i16(ASC).i16(-DESC).i16(0).u16(ASC).u16(DESC)
    .u32(1).u32(0)
    .i16(ROWS[2] + DOT).i16(ROWS[3] + DOT).u16(0).u16(0x20).u16(1).done();
  const post = new W().u32(0x00030000).u32(0).i16(-100).i16(50).u32(1).u32(0).u32(0).u32(0).u32(0).done();

  const tables = {
    'OS/2': os2,
    cmap: cmapFormat4(),
    glyf,
    head,
    hhea,
    hmtx: hmtx.done(),
    loca: loca.done(),
    maxp,
    name: nameTable(),
    post,
  };
  const tags = Object.keys(tables).sort();
  const n = tags.length;
  const sr = 16 * 2 ** Math.floor(Math.log2(n));
  const dir = new W().u32(0x00010000).u16(n).u16(sr).u16(Math.log2(sr / 16)).u16(n * 16 - sr);
  let offset = 12 + n * 16;
  const bodies = [];
  let headOffset = 0;
  for (const tag of tags) {
    const body = tables[tag];
    dir.bytes(Buffer.from(tag.padEnd(4))).u32(checksum(body)).u32(offset).u32(body.length);
    if (tag === 'head') headOffset = offset;
    const padded = pad4(body);
    bodies.push(padded);
    offset += padded.length;
  }
  const font = Buffer.concat([dir.done(), ...bodies]);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8);
  return font;
}
