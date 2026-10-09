#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built creature bodies baked offline.
// The generator (src/shards/sunscar-dunes/generators/species.ts) runs here only; each body's skinned GLB goes to
// public/assets/sunscar-dunes/rigs/<name>.glb, which the client reads (world/meshes.ts duneRig).
// test/shards/sunscar-dunes/rig-bake.test.ts is the byte-exact stale gate (it re-runs the generator).
// Usage: node --import ./scripts/bake-loader.mjs scripts/bake-signal-rigs.mjs
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/rigs');
const RIGS = [['skitterer', 'generators/species.ts', 'bakeSignalSkitterer']];
mkdirSync(out, { recursive: true });
const keep = new Set();
for (const [name, file, bake] of RIGS) {
  const generator = await import(pathToFileURL(resolve(project, file)).href);
  const { glb } = generator[bake]();
  writeFileSync(resolve(out, `${name}.glb`), glb); keep.add(`${name}.glb`);
  console.info(`sunscar-dunes ${name}: ${String(glb.length)} bytes → rigs/${name}.glb`);
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) rmSync(resolve(out, entry));
