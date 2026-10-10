#!/usr/bin/env node
// SHARD-PLATFORM M3 (the offline skinned-model bake): Sky Reach's creature bodies baked offline. The generator
// (src/shards/far-reach/generators/creatures.ts) reads each generated source GLB under public/, processes it as the runtime
// did and writes its skinned GLB to public/assets/far-reach/rigs/<creature>.glb (the Roc's painted map embedded); the
// client loads them (species/bodies.ts). test/shards/far-reach/creature-bake.test.ts is
// the byte-exact stale gate (it re-runs the generator).
// Usage: node --import ./scripts/bake-loader.mjs src/shards/far-reach/generators/bake-sky-rigs.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../../..'), out = resolve(root, 'public/assets/far-reach/rigs');
const generator = await import(pathToFileURL(resolve(root, 'src/shards/far-reach/generators/creatures.ts')).href);
const bakes = await generator.bakeSkyCreatures((url) => new Uint8Array(readFileSync(resolve(root, `public${url}`))));
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
const keep = new Set();
for (const [creature, { glb }] of Object.entries(bakes)) {
  emit(resolve(out, `${creature}.glb`), glb); keep.add(`${creature}.glb`);
  console.info(`far-reach ${creature}: ${String(glb.length)} bytes → rigs/${creature}.glb`);
}
// the folder holds exactly this bake: no orphan file from an older bake ships
for (const entry of readdirSync(out)) if (!keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
