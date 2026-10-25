#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built world pieces baked offline. The
// generators (src/shards/sunscar-dunes/generators/*.ts) run here only; each piece's static GLB goes to
// public/assets/sunscar-dunes/baked/<piece>.glb and its rows (the GLB's content hash, the instanced kinds, the colliders) to
// src/shards/sunscar-dunes/data/<piece>.json, which the client reads (world/baked.ts). test/shards/sunscar-dunes/
// world-bake.test.ts is the byte-exact stale gate (it re-runs the generators).
// G320 (SF87): author-only. Every input is a literal import from this shard's authoring folders, the SDK or a package, under
// the SDK's authoring loader (no game, engine, runtime or look module; no public/ model; no committed output read back as a
// seed). The lash's hand tip is a frozen row (data/whip.ts LASH_TIP), recomputed from the generated glove by its test.
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-world.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bakeSignalWorldSources } from './worldSources.ts';
import { publishScene } from '@wildshard/sdk/bake';

const root = resolve(import.meta.dirname, '../../../..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/baked');
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
const keep = new Set();
// SF80: the pieces are one three.js scene through the SDK's `bake(scene, identity)` (generators/scene.ts), which also writes
// the inspectable .wildshard/cache/sunscar-dunes/scene.json (never committed)
const source = readFileSync(new URL('../assets/models/dry-well.glb', import.meta.url));
const { files, world } = await bakeSignalWorldSources(source);
const scene = publishScene(world.scene, root, 'sunscar-dunes');
for (const [name, bytes] of files) {
  if (name.endsWith('.json')) emit(resolve(project, 'data', name), bytes);
  else { emit(resolve(out, name), bytes); if (name.endsWith('.glb')) keep.add(name); }
  console.info(`sunscar-dunes ${name}: ${String(bytes.length)} bytes`);
}
console.info(`sunscar-dunes scene.json: ${String(world.scene.nodes.length)} nodes → ${scene.path}`);
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
