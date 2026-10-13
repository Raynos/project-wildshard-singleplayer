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
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { signalDunesBake } from './scene.ts';
import { pieceRows } from './kinds.ts';
import { bakeSignalLash, plaitTexels } from './lash.ts';

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
const baked = signalDunesBake(root);
for (const part of baked.pieces) {
  const piece = part.name.replace(/^sunscar\./u, ''), { glb, ...rows } = pieceRows(part);
  const hash = createHash('sha256').update(glb).digest('hex');
  emit(resolve(out, `${piece}.glb`), glb); keep.add(`${piece}.glb`);
  emit(resolve(project, `data/${piece}.json`), `${JSON.stringify({ glb: hash, ...rows }, null, 2)}\n`);
  console.info(`sunscar-dunes ${piece}: ${String(glb.length)} bytes → baked/${piece}.glb (${hash}), ${String(rows.colliders.length)} colliders`);
}
console.info(`sunscar-dunes scene.json: ${String(baked.scene.nodes.length)} nodes → ${String(baked.scenePath)}`);
// the held lash (G345, generators/lash.ts): its tubes and where the lash leaves the hand (the frozen glove fit)
{
  const { glb, ...rows } = bakeSignalLash(), hash = createHash('sha256').update(glb).digest('hex');
  emit(resolve(out, 'lash.glb'), glb); keep.add('lash.glb');
  emit(resolve(project, 'data/lash.json'), `${JSON.stringify({ glb: hash, ...rows }, null, 2)}\n`);
  console.info(`sunscar-dunes lash: ${String(glb.length)} bytes → baked/lash.glb (${hash})`);
  // the hero coil's plait tile: its three tiles' texels, deflated (world/baked.ts reads them; runtime/items/lashHold.ts)
  const texels = plaitTexels(), plait = new Uint8Array(await new Response(new Blob([texels]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  emit(resolve(out, 'plait.bin'), plait);
  console.info(`sunscar-dunes plait: ${String(texels.length)} bytes → baked/plait.bin (${String(plait.length)} deflated)`);
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }
