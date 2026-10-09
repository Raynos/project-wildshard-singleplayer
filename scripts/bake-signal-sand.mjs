#!/usr/bin/env node
// SHARD-PLATFORM SF72 (RENDERING.md: a world-build output that is a pure function of committed files is baked): Signal
// Dunes' sand maps baked offline. The generator (src/shards/sunscar-dunes/generators/sand.ts) runs here only; each map's
// raw bytes go as a zlib stream to public/assets/sunscar-dunes/sand/<map>.bin and the grain tile's means to
// src/shards/sunscar-dunes/data/sand.json, which the client reads (look/render.ts loadSandMaps).
// test/shards/sunscar-dunes/sand-bake.test.ts is the byte-exact stale gate (it re-runs the generator).
// Usage: node --import ./scripts/bake-loader.mjs scripts/bake-signal-sand.mjs
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zlibSync } from 'fflate';

const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/sand');
const { bakeSignalSand } = await import(pathToFileURL(resolve(project, 'generators/sand.ts')).href);
const { shadow, trail, grain, meanR, meanGlint } = bakeSignalSand();
mkdirSync(out, { recursive: true });
const maps = { shadow, trail, grain };
for (const [name, bytes] of Object.entries(maps)) {
  const packed = zlibSync(bytes, { level: 9 });
  writeFileSync(resolve(out, `${name}.bin`), packed);
  console.info(`sunscar-dunes sand ${name}: ${String(bytes.length)} bytes → sand/${name}.bin (${String(packed.length)})`);
}
// the folder holds exactly this bake: no orphan map from an older bake ships
for (const entry of readdirSync(out)) if (!Object.hasOwn(maps, entry.replace(/\.bin$/u, ''))) rmSync(resolve(out, entry));
writeFileSync(resolve(project, 'data/sand.json'), `${JSON.stringify({ meanR, meanGlint }, null, 2)}\n`);
