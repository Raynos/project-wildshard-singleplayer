#!/usr/bin/env node
// SHARD-PLATFORM M3 (Nalati's 80/20, the places bake): the spring camp, the Kunes bridge and the summer camp painted
// offline, with the Explorer specimens of every model they paint. The generator
// (src/shards/nalati-grasslands/generators/places.ts) is bundled by vite as it stands and run in a muted Chromium page over
// the page's baked terrain grid: the places' colliders come out of it, and Chromium's sin / cos / atan2 are the page's to
// the last bit (Node's differ in the last bit; measured). It writes each bake's binary (every geometry's float bytes,
// welded, in four byte lanes, zlib-compressed) to public/assets/nalati/baked/{places,specimens}.bin and its rows (the raw
// binary's hash and size, the places' / specimens' rows) to src/shards/nalati-grasslands/data/{places,placeSpecimens}.json,
// which the page reads (src/shards/nalati-grasslands/world/placeBake.ts).
// `--check` (Node, the stale gate's cheap half): reruns the generator in Node and compares every row number and every
// expanded vertex float with the committed bake, within 1e-9 for the rows' doubles and 2^-20 for the stored float32s (a
// last-bit double difference can round a float32 one step), failing on any structural difference.
// Usage: scripts/browser-lane.sh node scripts/bake-nalati-places.mjs    (run in a clean export)
//        node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-nalati-places.mjs --check
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
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
function unshuffle(lanes) {
  const n = lanes.length / 4, out = new Uint8Array(lanes.length);
  for (let b = 0; b < 4; b++) for (let i = 0; i < n; i++) out[i * 4 + b] = lanes[b * n + i] ?? 0;
  return out;
}
const stamp = (bin, rows) => ({ bin: createHash('sha256').update(bin).digest('hex'), bytes: bin.length, rows });
const terrainBuffer = () => { const b = readFileSync(TERRAIN); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); };

/** each geometry of a bake expanded to its per-vertex floats (welded ones through their index) */
function expanded(json, bin, geos) {
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
/** two rows trees alike: the same shape, strings, booleans, and numbers within 1e-9 (welded counts aside) */
function alike(a, b, path, skip, tol = 1e-9) {
  if (typeof a === 'number' && typeof b === 'number') return near(a, b, tol) ? null : `${path}: ${String(a)} vs ${String(b)}`;
  if (typeof a !== typeof b || Array.isArray(a) !== Array.isArray(b) || (a === null) !== (b === null)) return `${path}: differs in kind`;
  if (typeof a !== 'object' || a === null) return a === b ? null : `${path}: ${String(a)} vs ${String(b)}`;
  const keys = Array.isArray(a) ? [...a.keys()] : Object.keys(a);
  if (keys.length !== (Array.isArray(b) ? b.length : Object.keys(b).length)) return `${path}: differs in length`;
  for (const k of keys) { if (skip(k)) continue; const d = alike(a[k], b[k], `${path}.${String(k)}`, skip, tol); if (d !== null) return d; }
  return null;
}

if (process.argv.includes('--check')) {
  const { bakeNalatiPlacesOnTerrain } = await import('../src/shards/nalati-grasslands/generators/places.ts');
  const node = bakeNalatiPlacesOnTerrain(terrainBuffer());
  let failed = false;
  for (const { file, bin, json, made, geos } of [
    { file: 'places', bin: 'places.bin', json: 'places.json', made: node.places, geos: (r) => r.meshes },
    { file: 'specimens', bin: 'specimens.bin', json: 'placeSpecimens.json', made: node.specimens, geos: (r) => r.parts },
  ]) {
    const committed = JSON.parse(readFileSync(resolve(DATA, json), 'utf8')), shipped = unshuffle(new Uint8Array(inflateSync(readFileSync(resolve(OUT, bin)))));
    if (shipped.length !== committed.bytes || createHash('sha256').update(shipped).digest('hex') !== committed.bin) { console.error(`bake-nalati-places: ${bin} is not its rows' binary`); failed = true; continue; }
    const rowsDiff = alike(committed.rows, made.rows, file, (k) => k === 'count' || k === 'geometry');
    const a = expanded(committed, shipped, geos), b = expanded({ rows: made.rows }, made.bin, geos);
    let geoDiff = a.length === b.length ? null : `${file}: ${String(a.length)} vs ${String(b.length)} geometries`;
    for (let i = 0; geoDiff === null && i < a.length; i++) geoDiff = alike(a[i], b[i], `${file} geometry ${String(i)}`, () => false, 2 ** -20);
    if (rowsDiff !== null || geoDiff !== null) { console.error(`bake-nalati-places: the committed ${file} bake is stale: ${rowsDiff ?? geoDiff}`); failed = true; }
  }
  if (failed) process.exit(1);
  console.info('bake-nalati-places: the places and specimens bakes match a Node rebake (rows within 1e-9, floats within 2^-20)');
  process.exit(0);
}

const { chromium } = await import('playwright');
const { build } = await import('vite');
const bundle = await build({
  configFile: false, logLevel: 'error', root,
  // an IIFE has no import.meta: the modules that resolve asset URLs against it resolve them against the bake page
  define: { 'import.meta.url': JSON.stringify('http://bake.invalid/') },
  build: { write: false, minify: false, lib: { entry: resolve(root, 'src/shards/nalati-grasslands/generators/places.ts'), formats: ['iife'], name: 'NalatiPlaces', fileName: () => 'places.js' } },
});
const output = (Array.isArray(bundle) ? bundle[0] : bundle).output.find((o) => o.type === 'chunk');
if (!output) throw new Error('bake-nalati-places: vite produced no chunk');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
let baked;
try {
  const page = await (await browser.newContext()).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // a blank page on an http origin (the bundle resolves asset URLs against it; nothing is fetched: every request 404s)
  await page.route('**/*', (route) => (route.request().url() === 'http://bake.invalid/' ? route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }) : route.fulfill({ status: 404, body: '' })));
  await page.goto('http://bake.invalid/');
  await page.addScriptTag({ content: output.code });
  if (errors.length > 0) throw new Error(`bake-nalati-places: the bundle failed to load: ${errors.join('; ')}`);
  baked = await page.evaluate((terrainB64) => {
    const bytes = Uint8Array.from(atob(terrainB64), (c) => c.codePointAt(0) ?? 0);
    const out = window.NalatiPlaces.bakeNalatiPlacesOnTerrain(bytes.buffer);
    const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCodePoint(...u8.subarray(i, i + 0x8000)); return btoa(s); };
    return { places: { rows: JSON.stringify(out.places.rows), bin: b64(out.places.bin) }, specimens: { rows: JSON.stringify(out.specimens.rows), bin: b64(out.specimens.bin) }, ua: navigator.userAgent };
  }, Buffer.from(readFileSync(TERRAIN)).toString('base64'));
  if (errors.length > 0) throw new Error(`bake-nalati-places: page errors: ${errors.join('; ')}`);
} finally { await browser.close(); }
mkdirSync(OUT, { recursive: true });
for (const { name, json, part } of [{ name: 'places', json: 'places.json', part: baked.places }, { name: 'specimens', json: 'placeSpecimens.json', part: baked.specimens }]) {
  const bin = new Uint8Array(Buffer.from(part.bin, 'base64')), packed = deflateSync(shuffle(bin), { level: 9 });
  writeFileSync(resolve(OUT, `${name}.bin`), packed);
  writeFileSync(resolve(DATA, json), `${JSON.stringify(stamp(bin, JSON.parse(part.rows)))}\n`);
  console.info(`nalati ${name}: ${String(bin.length)} → ${String(packed.length)} zlib (baked/${name}.bin) in ${baked.ua.split(' ').find((w) => w.startsWith('Chrome/')) ?? 'Chromium'}`);
}
