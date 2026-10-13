#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built world pieces baked offline. The
// generators (src/shards/sunscar-dunes/generators/*.ts) run here only; each piece's static GLB goes to
// public/assets/sunscar-dunes/baked/<piece>.glb and its rows (the GLB's content hash, the instanced kinds, the colliders) to
// src/shards/sunscar-dunes/data/<piece>.json, which the client reads (world/baked.ts). test/shards/sunscar-dunes/
// world-bake.test.ts is the byte-exact stale gate (it re-runs the generators).
// Usage: node --import ./scripts/bake-loader.mjs src/shards/sunscar-dunes/generators/bake-signal-world.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '../../../..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/baked');
const PIECES = [['rocks', 'generators/rocks.ts', 'bakeSignalRocks'], ['dressing', 'generators/dressing.ts', 'bakeSignalDressing'], ['tower', 'generators/tower.ts', 'bakeSignalTower'],
  ['caravan', 'generators/places.ts', 'bakeSignalCaravan'], ['well', 'generators/places.ts', 'bakeSignalWell'], ['braziers', 'generators/places.ts', 'bakeSignalBraziers']];
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
const keep = new Set();
for (const [piece, file, name] of PIECES) {
  const generator = await import(pathToFileURL(resolve(project, file)).href);
  const { glb, ...rows } = generator[name]();
  const hash = createHash('sha256').update(glb).digest('hex');
  emit(resolve(out, `${piece}.glb`), glb); keep.add(`${piece}.glb`);
  emit(resolve(project, `data/${piece}.json`), `${JSON.stringify({ glb: hash, ...rows }, null, 2)}\n`);
  console.info(`sunscar-dunes ${piece}: ${String(glb.length)} bytes → baked/${piece}.glb (${hash}), ${String(rows.colliders.length)} colliders`);
}
// the held lash (G345, generators/lash.ts): its tubes, and where the lash leaves the hand from the client's own intake of the
// generated glove (the model library, reading public/ through the bake fetch); the client no longer loads the glove
{
  const { installBakeEnvironment } = await import(pathToFileURL(resolve(root, 'scripts/bake/environment.mjs')).href);
  const environment = installBakeEnvironment(root);
  try {
    const [{ createModelLibrary }, { DUNE_MODELS }, { bakeSignalLash }] = await Promise.all([import(pathToFileURL(resolve(root, 'src/sdk/looks/modelLibrary.ts')).href),
      import(pathToFileURL(resolve(project, 'data/files.ts')).href), import(pathToFileURL(resolve(project, 'generators/lash.ts')).href)]);
    const library = createModelLibrary({ ...DUNE_MODELS, meshes: ['whip-glove'], hd: [] }, '[sunscar-dunes bake]');
    await library.preload();
    const glove = library.mesh('whip-glove');
    if (glove === null) throw new Error('whip-glove did not load');
    const { glb, ...rows } = bakeSignalLash(glove), hash = createHash('sha256').update(glb).digest('hex');
    emit(resolve(out, 'lash.glb'), glb); keep.add('lash.glb');
    emit(resolve(project, 'data/lash.json'), `${JSON.stringify({ glb: hash, ...rows }, null, 2)}\n`);
    console.info(`sunscar-dunes lash: ${String(glb.length)} bytes → baked/lash.glb (${hash})`);
  } finally { environment.dispose(); }
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
