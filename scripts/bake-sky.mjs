#!/usr/bin/env node
// bake-sky.mjs — the sun direction and horizon colour of every shard's HDRI, at build time (LOAD-PERF.md §P2).
//
// Sky.build scans the decoded 2k HDR twice at launch (findSun: every other pixel for the brightest texel;
// sampleHorizon: one row above the horizon) — pure functions of the file. This runs the same maths in Node
// (three's HDRLoader.parse is DOM-free) and writes public/assets/baked/<slug>/sky.json; Sky.ts reads it and
// skips the scans. Idempotent by a hash of the HDR + this script (Sky.ts keeps the reference implementation:
// change the maths in both places). Runs from vite.config.ts with the terrain bake.
//
//   node --import ./scripts/bake-loader.mjs scripts/bake-sky.mjs [--force]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { DataUtils } from 'three';

const ROOT = resolve(import.meta.dirname, '..');
const force = process.argv.includes('--force');
const VERSION = 1;
const self = readFileSync(resolve(ROOT, 'scripts/bake-sky.mjs'));

const chunkFiles = readdirSync(resolve(ROOT, 'src/chunks')).filter((f) => f.endsWith('.ts') && !/^(registry|terrain|ChunkDef|_template|placeholders)\.ts$/.test(f));
for (const file of chunkFiles) {
  const mod = await import(pathToFileURL(resolve(ROOT, 'src/chunks', file)).href);
  for (const def of Object.values(mod)) {
    if (!def || typeof def !== 'object' || typeof def.slug !== 'string' || !def.sky?.hdri) continue;
    const hdrPath = resolve(ROOT, `public/assets/hdri/${def.sky.hdri}_2k.hdr`);
    if (!existsSync(hdrPath)) { console.warn(`bake-sky: ${def.slug}: ${hdrPath} missing`); continue; }
    const hdr = readFileSync(hdrPath);
    const digest = createHash('sha1').update(`v${VERSION}:`).update(hdr).update(self).digest('hex').slice(0, 16);
    const out = resolve(ROOT, 'public/assets/baked', def.slug, 'sky.json');
    const prev = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
    if (!force && prev?.hash === digest) { console.log(`bake-sky: ${def.slug} up to date (${digest})`); continue; }

    const t0 = performance.now();
    const img = new HDRLoader().parse(hdr.buffer.slice(hdr.byteOffset, hdr.byteOffset + hdr.byteLength));
    const { width, height, data } = img;
    const isHalf = data instanceof Uint16Array;
    const px = (i) => (isHalf ? DataUtils.fromHalfFloat(data[i]) : data[i]);
    // findSun (Sky.ts): brightest texel on the 2×2 grid; HDR is flipY=true so row 0 is the top
    let best = -1, bx = 0, by = 0;
    for (let y = 0; y < height; y += 2) for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const l = px(i) + px(i + 1) + px(i + 2);
      if (l > best) { best = l; bx = x; by = y; }
    }
    const u = (bx + 0.5) / width, v = 1 - (by + 0.5) / height;
    const theta = (u - 0.5) * 2 * Math.PI, phi = (v - 0.5) * Math.PI;
    let sx = Math.cos(theta) * Math.cos(phi), sy = Math.sin(phi), sz = Math.sin(theta) * Math.cos(phi);
    let l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
    if (sy < 0.12) { sy = 0.12; l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l; }
    // sampleHorizon (Sky.ts): mean of the row just above the horizon, clamped so fog never blows out
    const row = Math.floor(height * 0.47);
    let r = 0, g = 0, b = 0, n = 0;
    for (let x = 0; x < width; x += 4) { const i = (row * width + x) * 4; r += px(i); g += px(i + 1); b += px(i + 2); n++; }
    r /= n; g /= n; b /= n;
    const m = Math.max(r, g, b, 1e-3);
    if (m > 1.1) { r *= 1.1 / m; g *= 1.1 / m; b *= 1.1 / m; }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, `${JSON.stringify({ hash: digest, version: VERSION, hdri: def.sky.hdri, sunDir: [sx, sy, sz], horizon: [r, g, b] }, null, 2)}\n`);
    console.log(`bake-sky: ${def.slug} sun (${sx.toFixed(3)}, ${sy.toFixed(3)}, ${sz.toFixed(3)}) horizon (${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}) in ${Math.round(performance.now() - t0)} ms (${digest})`);
  }
}
