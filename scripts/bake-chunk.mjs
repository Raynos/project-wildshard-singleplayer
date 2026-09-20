#!/usr/bin/env node
// bake-chunk.mjs — pre-bake every registered shard's terrain at build time (docs/plans/LOAD-PERF.md §P2.1).
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
// Format (little-endian): 'WSTR' u32 version=1 · u32 res · f32 size · u32 seed · u32 landscapeHash (0 = unhashed legacy) ·
//   f32[res²] height · u8[res²·4] splat weights (each row sums to ≈ 255) — vertex i = iz·res + ix at
//   (x, z) = (−half + ix·d, −half + iz·d), d = size / (res − 1).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'public/assets/baked');
const force = process.argv.includes('--force');
const check = process.argv.includes('--check');
const VERSION = 1;

const { CHUNK_SIZE, CHUNK_HALF, TERRAIN_RES } = await import(pathToFileURL(resolve(ROOT, 'src/core/config.ts')).href);
const { landscapeHash } = await import(pathToFileURL(resolve(ROOT, 'src/chunks/terrain.ts')).href);

// every chunk module that exports a ChunkDef (has slug + terrain); the registry itself needs `location`
const chunkFiles = readdirSync(resolve(ROOT, 'src/chunks')).filter((f) => f.endsWith('.ts') && !/^(registry|terrain|ChunkDef|_template|placeholders)\.ts$/.test(f));
const shared = ['src/chunks/terrain.ts', 'src/core/noise.ts', 'src/core/rng.ts', 'src/core/config.ts', 'scripts/bake-chunk.mjs'].map((f) => readFileSync(resolve(ROOT, f)));

let stale = 0, written = 0;
for (const file of chunkFiles) {
  const mod = await import(pathToFileURL(resolve(ROOT, 'src/chunks', file)).href);
  for (const def of Object.values(mod)) {
    if (!def || typeof def !== 'object' || typeof def.slug !== 'string' || !def.terrain) continue;
    const res = TERRAIN_RES;
    const hash = createHash('sha1');
    hash.update(`v${VERSION}:${res}:${CHUNK_SIZE}:`); hash.update(readFileSync(resolve(ROOT, 'src/chunks', file)));
    for (const s of shared) hash.update(s);
    const digest = hash.digest('hex').slice(0, 16);
    const dir = resolve(OUT, def.slug);
    const meta = resolve(dir, 'terrain.json');
    const bin = resolve(dir, 'terrain.bin');
    const prev = existsSync(meta) && existsSync(bin) ? JSON.parse(readFileSync(meta, 'utf8')) : null;
    if (!force && prev?.hash === digest) { console.log(`bake: ${def.slug} terrain up to date (${digest})`); continue; }
    if (check) { console.log(`bake: ${def.slug} terrain STALE (${prev?.hash ?? 'none'} → ${digest})`); stale++; continue; }

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
    mkdirSync(dir, { recursive: true });
    writeFileSync(bin, Buffer.from(buf));
    writeFileSync(meta, `${JSON.stringify({ hash: digest, version: VERSION, res, size: CHUNK_SIZE, seed: def.seed, landscapeHash: lhash, bytes: buf.byteLength, heightRange: [min, max], bakedAt: new Date().toISOString() }, null, 2)}\n`);
    written++;
    console.log(`bake: ${def.slug} terrain ${res}² → ${(buf.byteLength / 1024).toFixed(0)} KB in ${Math.round(performance.now() - t0)} ms (h ${min.toFixed(1)}…${max.toFixed(1)} m, ${digest})`);
  }
}
if (check && stale) process.exit(1);
if (written) console.log(`bake: ${written} terrain file(s) written — commit public/assets/baked/`);
