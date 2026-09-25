#!/usr/bin/env node
// bake-chunk.mjs — pre-bake every registered shard's terrain at build time (project/archive/2026-09-22-load-perf.md §P2.1).
//
// Runs the chunk's pure terrain functions (src/chunks/<slug>.ts → buildTerrain: seeded Noise2D / Rng)
// in Node and writes public/assets/baked/<slug>/terrain.bin — the height and splat weights at every
// vertex of the terrain mesh grid (TERRAIN_RES² over CHUNK_SIZE, the exact PlaneGeometry order), so
// the phone builds the mesh, plants the forest and walks the ground from a lookup instead of ~200 k
// noise evaluations at launch. src/world/BakedTerrain.ts reads it and swaps Heightfield's bindings.
//
// Idempotent by content hash: the sources that determine the field (the chunk file, terrain.ts,
// noise.ts, rng.ts, config.ts, this script) are hashed into terrain.json; an unchanged hash writes
// nothing (so `vite` in dev and `vite build` on Vercel both call this for free).
//
//   node --import ./scripts/bake-loader.mjs scripts/bake-chunk.mjs [--force] [--check]
//
// Bake variants (a Look Lab pick that moves the ground, e.g. Nalati's N23 edge berm, `?edge=1`): VARIANTS lists them per
// shard; each is baked by a child run of this script under BAKE_VARIANT=<suffix>, with the variant's query in the page's
// `location` (so the def reads the pick at import, as in the browser), into terrain<suffix>.bin / .json.
//
// Format (little-endian): 'WSTR' u32 version=1 · u32 res · f32 size · u32 seed · u32 landscapeHash (0 = unhashed legacy) ·
//   f32[res²] height · u8[res²·4] splat weights (each row sums to ≈ 255) — vertex i = iz·res + ix at
//   (x, z) = (−half + ix·d, −half + iz·d), d = size / (res − 1).
//   Then, for a shard that grows undergrowth, the placement decision log (src/world/placement.ts — the forest
//   planted on this grid, then every undergrowth candidate's kept / skipped bit, ~17 KB): 'WSPL' u32 version=1 ·
//   u32 decisions · u32 kinds · u32[kinds] counts · f64 checksum sum · u8[⌈decisions/8⌉] bits.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'public/assets/baked');
const force = process.argv.includes('--force');
const check = process.argv.includes('--check');
const VERSION = 1;
/** per shard: the bake variants (file suffix → the page query that selects them; the def's `bakeVariant` names the suffix) */
const VARIANTS = { 'nalati-grasslands': { '.edge': 'edge=1' } };
const VARIANT = process.env.BAKE_VARIANT ?? '';
const variantQuery = (slug) => (VARIANT ? VARIANTS[slug]?.[VARIANT] ?? null : '');
// before any game module loads: the settings (and the defs that read them) take the page's query at import
if (!('location' in globalThis)) {
  const q = VARIANT ? Object.values(VARIANTS).map((v) => v[VARIANT]).find(Boolean) ?? '' : '';
  Object.assign(globalThis, { location: new URL(`http://localhost/${q ? `?${q}` : ''}`) });
}

const { CHUNK_SIZE, CHUNK_HALF, TERRAIN_RES } = await import(pathToFileURL(resolve(ROOT, 'src/core/config.ts')).href);
const { landscapeHash } = await import(pathToFileURL(resolve(ROOT, 'src/chunks/terrain.ts')).href);

// every chunk module that exports a ChunkDef (has slug + terrain); the registry itself needs `location`
const chunkFiles = readdirSync(resolve(ROOT, 'src/chunks')).filter((f) => f.endsWith('.ts') && !/^(registry|terrain|ChunkDef|_template|placeholders)\.ts$/.test(f));
const shared = ['src/chunks/terrain.ts', 'src/core/noise.ts', 'src/core/rng.ts', 'src/core/config.ts', 'scripts/bake-chunk.mjs',
  // the placement decision log: the placer, the samplers it plants on, the field they are bound into
  'src/world/placement.ts', 'src/world/treeSpecies.ts', 'src/world/BakedTerrain.ts', 'src/world/Heightfield.ts'].map((f) => readFileSync(resolve(ROOT, f)));

const registry = await import(pathToFileURL(resolve(ROOT, 'src/chunks/registry.ts')).href);
const heightfield = await import(pathToFileURL(resolve(ROOT, 'src/world/Heightfield.ts')).href);
const bakedTerrain = await import(pathToFileURL(resolve(ROOT, 'src/world/BakedTerrain.ts')).href);
const placement = await import(pathToFileURL(resolve(ROOT, 'src/world/placement.ts')).href);

/** The undergrowth decision log for `def` planted on the grid in `gridBuf` — null for a shard that grows none (main.ts: no forest carpet at sea). */
function placementSection(def, gridBuf) {
  if (def.ocean || !registry.findChunk(def.slug)) return null;
  registry.setActiveChunk(def.slug);
  heightfield._installBakedTerrain(bakedTerrain.bakedSamplers(bakedTerrain.parseBakedTerrain(gridBuf))); // as loadBakedTerrain does at launch
  const variants = placement.plantSpecs(def.trees); // the species set when the shard has one (PH-B4), else the runtime pines
  const { trees, grid } = placement.placeForest(variants);
  if (trees.length === 0) return null;
  const log = placement.DecisionLog.record();
  const run = placement.placeUndergrowth(trees, grid, log);
  let r = run.next(); while (!r.done) r = run.next();
  const { counts, sum } = placement.placementChecksum(r.value);
  const bits = log.bits();
  const out = new ArrayBuffer(16 + counts.length * 4 + 8 + bits.length);
  const dv = new DataView(out);
  dv.setUint8(0, 0x57); dv.setUint8(1, 0x53); dv.setUint8(2, 0x50); dv.setUint8(3, 0x4c); // 'WSPL'
  dv.setUint32(4, 1, true); dv.setUint32(8, log.count, true); dv.setUint32(12, counts.length, true);
  counts.forEach((c, k) => dv.setUint32(16 + k * 4, c, true));
  dv.setFloat64(16 + counts.length * 4, sum, true);
  new Uint8Array(out, 16 + counts.length * 4 + 8).set(bits);
  return { bytes: new Uint8Array(out), decisions: log.count, counts, trees: trees.length };
}

/** the chunk file's own sibling modules (`from './pineHollowLayout'`: where a shard keeps its coordinates) — they shape its
 *  field as much as the chunk file does, so they are hashed with it (the shared engine files are already in `shared`) */
function localImports(file) {
  const src = readFileSync(resolve(ROOT, 'src/chunks', file), 'utf8');
  const out = [];
  for (const m of src.matchAll(/from '\.\/([\w-]+)'/g)) {
    const name = m[1];
    if (/^(terrain|ChunkDef)$/.test(name)) continue;
    const p = resolve(ROOT, 'src/chunks', `${name}.ts`);
    if (existsSync(p)) out.push(readFileSync(p));
  }
  return out;
}
/** per-chunk sources beyond the chunk file that shape its landscape (so editing them re-bakes it) */
const EXTRA_DEPS = { 'nalati-grasslands.ts': ['src/chunks/nalatiLayout.ts', 'src/world/nalati/clearings.ts', 'src/chunks/nalatiEdge.ts'] };

let stale = 0, written = 0;
for (const file of chunkFiles) {
  const mod = await import(pathToFileURL(resolve(ROOT, 'src/chunks', file)).href);
  for (const def of Object.values(mod)) {
    if (!def || typeof def !== 'object' || typeof def.slug !== 'string' || !def.terrain) continue;
    if (variantQuery(def.slug) === null) continue; // a variant run bakes only the shards that have that variant
    const res = TERRAIN_RES;
    const hash = createHash('sha1');
    hash.update(`v${VERSION}:${res}:${CHUNK_SIZE}:${VARIANT}`); hash.update(readFileSync(resolve(ROOT, 'src/chunks', file)));
    for (const dep of EXTRA_DEPS[file] ?? []) hash.update(readFileSync(resolve(ROOT, dep)));
    for (const s of shared) hash.update(s);
    if (EXTRA_DEPS[file] === undefined) for (const s of localImports(file)) hash.update(s); // a chunk with declared deps hashes exactly those
    const digest = hash.digest('hex').slice(0, 16);
    const dir = resolve(OUT, def.slug);
    const meta = resolve(dir, `terrain${VARIANT}.json`);
    const bin = resolve(dir, `terrain${VARIANT}.bin`);
    const tag = `${def.slug}${VARIANT}`;
    const prev = existsSync(meta) && existsSync(bin) ? JSON.parse(readFileSync(meta, 'utf8')) : null;
    if (!force && prev?.hash === digest) { console.log(`bake: ${tag} terrain up to date (${digest})`); continue; }
    if (check) { console.log(`bake: ${tag} terrain STALE (${prev?.hash ?? 'none'} → ${digest})`); stale++; continue; }

    const t0 = performance.now();
    const n = res * res;
    const header = 24;
    const buf = new ArrayBuffer(header + n * 4 + n * 4);
    const dv = new DataView(buf);
    dv.setUint8(0, 0x57); dv.setUint8(1, 0x53); dv.setUint8(2, 0x54); dv.setUint8(3, 0x52); // 'WSTR'
    const lhash = landscapeHash(def.terrain, CHUNK_SIZE); // the runtime recomputes this from the live def and refuses a mismatch (BakedTerrain.ts)
    dv.setUint32(4, VERSION, true); dv.setUint32(8, res, true); dv.setFloat32(12, CHUNK_SIZE, true); dv.setUint32(16, def.seed >>> 0, true); dv.setUint32(20, lhash, true);
    const heights = new Float32Array(buf, header, n);
    const splat = new Uint8Array(buf, header + n * 4, n * 4);
    const d = CHUNK_SIZE / (res - 1);
    let min = Infinity, max = -Infinity;
    for (let iz = 0; iz < res; iz++) {
      const z = -CHUNK_HALF + iz * d;
      for (let ix = 0; ix < res; ix++) {
        const x = -CHUNK_HALF + ix * d;
        const i = iz * res + ix;
        const h = def.terrain.heightAt(x, z);
        heights[i] = h; if (h < min) min = h; if (h > max) max = h;
        const s = def.terrain.splatAt(x, z);
        // quantise so the four bytes sum to exactly 255 (largest weight absorbs the rounding)
        const q = s.map((w) => Math.round(w * 255));
        const sum = q[0] + q[1] + q[2] + q[3];
        let k = 0; for (let j = 1; j < 4; j++) if (q[j] > q[k]) k = j;
        q[k] += 255 - sum;
        splat[i * 4] = q[0]; splat[i * 4 + 1] = q[1]; splat[i * 4 + 2] = q[2]; splat[i * 4 + 3] = q[3];
      }
    }
    const tp = performance.now();
    const section = placementSection(def, buf);
    const bytes = section ? Buffer.concat([Buffer.from(buf), section.bytes]) : Buffer.from(buf);
    if (section) console.log(`bake: ${tag} placement: ${section.trees} trees, ${section.decisions} undergrowth candidates → ${section.counts.join(' / ')} kept, ${section.bytes.length} B in ${Math.round(performance.now() - tp)} ms`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(bin, bytes);
    writeFileSync(meta, `${JSON.stringify({ hash: digest, version: VERSION, res, size: CHUNK_SIZE, seed: def.seed, landscapeHash: lhash, bytes: bytes.byteLength, placement: section ? { decisions: section.decisions, counts: section.counts } : null, heightRange: [min, max], bakedAt: new Date().toISOString() }, null, 2)}\n`);
    written++;
    console.log(`bake: ${tag} terrain ${res}² → ${(buf.byteLength / 1024).toFixed(0)} KB in ${Math.round(performance.now() - t0)} ms (h ${min.toFixed(1)}…${max.toFixed(1)} m, ${digest})`);
  }
}
// the variants: one child run per suffix (a fresh process, so every module reads the variant's query at import)
if (!VARIANT) {
  for (const suffix of new Set(Object.values(VARIANTS).flatMap((v) => Object.keys(v)))) {
    const r = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], { stdio: 'inherit', env: { ...process.env, BAKE_VARIANT: suffix } });
    if (r.status !== 0) { if (check) stale++; else process.exit(r.status ?? 1); }
  }
}
if (check && stale) process.exit(1);
if (written) console.log(`bake: ${written} terrain file(s) written — commit public/assets/baked/`);
