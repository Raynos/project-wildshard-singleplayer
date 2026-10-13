#!/usr/bin/env node
// DS1.5: the authored places/specimens/dressing generator runs in Node, over the real terrain grid.
// Normal generation and --check use the same exact row/float bytes and zlib lanes on every platform.
// Regenerate: node --experimental-transform-types --import ./scripts/bake-loader.mjs generators/bake-nalati-places.mjs
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '../../../..');
const OUT = resolve(root, 'public/assets/nalati/baked');
const DATA = resolve(root, 'src/shards/nalati-grasslands/data');
const TERRAIN = resolve(root, 'public/assets/baked/nalati-grasslands/terrain.bin');

/** the binary in four byte lanes (every word's first bytes, then its second …): floats compress better so */
function shuffle(bin) {
  if (bin.length % 4 !== 0) throw new Error('[nalati places] the bake is not whole words');
  const n = bin.length / 4, out = new Uint8Array(bin.length);
  for (let i = 0; i < n; i++) for (let b = 0; b < 4; b++) out[b * n + i] = bin[i * 4 + b] ?? 0;
  return out;
}
/** The raw binary from its shipped lanes (every 4-byte word's first bytes, then its second …). */
export function unshuffle(lanes) {
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}
const stamp = (bin, rows) => ({ notice: 'DO NOT EDIT: regenerate with generators/bake-nalati-places.mjs (Node canonical).', bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, rows });
const terrainBuffer = () => { const b = readFileSync(TERRAIN); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

/** Each geometry of a bake expanded to its per-vertex floats (welded ones through their index). */
export function expanded(json, bin, geos) {
  const out = [];
  let at = 0;
  const words = (n) => { const v = new DataView(bin.buffer, bin.byteOffset + at, n * 4); at += n * 4; return v; };
  for (const row of json.rows) for (const m of geos(row)) {
    const g = m.geometry, attrs = g.attrs.map(([name, , size]) => { const v = words(g.count * size); return { name, size, get: (i) => v.getFloat32(i * 4, true) }; });
    const idx = g.index === null ? null : (() => { const v = words(g.indexCount); const a = []; let last = 0; for (let i = 0; i < g.indexCount; i++) { last += v.getInt32(i * 4, true); a.push(last); } return a; })();
    const n = g.expand ? g.indexCount : g.count, floats = [];
    for (const a of attrs) for (let i = 0; i < n; i++) { const v = g.expand && idx !== null ? (idx[i] ?? 0) : i; for (let c = 0; c < a.size; c++) floats.push(a.get(v * a.size + c)); }
    out.push({ floats, index: g.expand ? null : idx });
  }
  return out;
}
const near = (a, b, tol = 1e-9) => a === b || Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
/** Two row trees alike: the same shape, strings, booleans, and numbers within 1e-9 (welded counts aside); else the first difference. */
export function alike(a, b, path, skip, tol = 1e-9) {
  if (typeof a === 'number' && typeof b === 'number') return near(a, b, tol) ? null : `${path}: ${String(a)} vs ${String(b)}`;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) return `${path}: differs in kind`;
  if (typeof a !== 'object' || a === null) return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
  const keys = Array.isArray(a) ? [...a.keys()] : Object.keys(a);
  if (keys.length !== (Array.isArray(b) ? b.length : Object.keys(b).length)) return `${path}: differs in length`;
  for (const k of keys) { if (skip(k)) continue; const d = alike(a[k], b[k], `${path}.${String(k)}`, skip, tol); if (d !== null) return d; }
  return null;
}

/** The committed places, specimens and dressing-shape bakes (rows, raw binary) as the page reads them. */
export function committedPlaces() {
  return Object.fromEntries([['places', 'places.bin', 'places.json'], ['specimens', 'specimens.bin', 'placeSpecimens.json'], ['dressing', 'dressing.bin', 'dressingGeos.json']].map(([file, bin, json]) => {
    const rows = JSON.parse(readFileSync(resolve(DATA, json), 'utf8')), raw = unshuffle(new Uint8Array(inflateSync(readFileSync(resolve(OUT, bin)))));
    if (raw.length !== rows.bytes || createHash('sha256').update(raw).digest('hex') !== rows.bin) throw new Error(`bake-nalati-places: ${bin} is not its rows' binary`);
    return [file, { rows, raw }];
  }));
}

/** The first difference between a committed bake and a rebake's rows and binary (rows within 1e-9, floats within 2^-20), or null. */
export function bakeDifference(file, committed, made, geos) {
  const rowsDiff = alike(committed.rows.rows, made.rows, file, (k) => k === 'count' || k === 'geometry');
  if (rowsDiff !== null) return rowsDiff;
  const a = expanded(committed.rows, committed.raw, geos), b = expanded({ rows: made.rows }, made.bin, geos);
  if (a.length !== b.length) return `${file}: ${String(a.length)} vs ${String(b.length)} geometries`;
  for (let i = 0; i < a.length; i++) { const d = alike(a[i], b[i], `${file} geometry ${String(i)}`, () => false, 2 ** -20); if (d !== null) return d; }
  return null;
}

/** Read the actual native terrain bytes; the painted recipe receives this explicit input. */
export function readNalatiTerrain() { return terrainBuffer(); }

/** Publish/check the unchanged Nalati wire envelopes, at the existing Node I/O boundary. */
export function writeNalatiParts(parts, check = false) {
  let changed = 0;
  const put = (path, bytes) => {
    const buffer = Buffer.from(bytes);
    if (check) {
      if (!existsSync(path) || !readFileSync(path).equals(buffer)) { changed++; console.error(`nalati bake: STALE ${path}`); }
    } else { mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, buffer); }
  };
  for (const { name, json, part } of parts) {
    if (!['places', 'specimens', 'dressing'].includes(name) || !['places.json', 'placeSpecimens.json', 'dressingGeos.json'].includes(json)) throw new Error('Unknown Nalati bake output');
    put(resolve(OUT, `${name}.bin`), deflateSync(shuffle(part.bin), { level: 9 }));
    put(resolve(DATA, json), `${JSON.stringify(stamp(part.bin, part.rows))}\n`);
  }
  if (changed !== 0) throw new Error(`Nalati bake has ${changed} stale outputs`);
}

/** Publish/check the standard dressing Scene, using the same retained file boundary. */
export function writeDressingScene(scene, check = false) {
  const path = resolve(DATA, 'dressing.scene.generated.json'), bytes = Buffer.from(`${JSON.stringify(scene)}\n`);
  if (check) {
    if (!existsSync(path) || !readFileSync(path).equals(bytes)) throw new Error('Nalati dressing Scene is stale');
  } else { mkdirSync(DATA, { recursive: true }); writeFileSync(path, bytes); }
}

if (import.meta.main) throw new Error('Run bake-nalati-painted.mjs for places or bake-nalati-dressing.mjs for dressing');
