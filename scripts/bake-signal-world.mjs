#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Signal Dunes' code-built world pieces baked offline. The
// generators (src/shards/sunscar-dunes/generators/*.ts) run here only; each piece's static GLB goes to
// public/assets/sunscar-dunes/baked/<piece>.glb and its rows (the GLB's content hash, the instanced kinds, the colliders) to
// src/shards/sunscar-dunes/data/<piece>.json, which the client reads (world/baked.ts). test/shards/sunscar-dunes/
// world-bake.test.ts is the byte-exact stale gate (it re-runs the generators).
// Usage: node --import ./scripts/bake-loader.mjs scripts/bake-signal-world.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/sunscar-dunes');
const out = resolve(root, 'public/assets/sunscar-dunes/baked');
const PIECES = [['rocks', 'generators/rocks.ts', 'bakeSignalRocks']];
mkdirSync(out, { recursive: true });
const keep = new Set();
for (const [piece, file, name] of PIECES) {
  const generator = await import(pathToFileURL(resolve(project, file)).href);
  const { glb, ...rows } = generator[name]();
  const hash = createHash('sha256').update(glb).digest('hex');
  writeFileSync(resolve(out, `${piece}.glb`), glb); keep.add(`${piece}.glb`);
  writeFileSync(resolve(project, `data/${piece}.json`), `${JSON.stringify({ glb: hash, ...rows }, null, 2)}\n`);
  console.info(`sunscar-dunes ${piece}: ${String(glb.length)} bytes → baked/${piece}.glb (${hash}), ${String(rows.colliders.length)} colliders`);
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) rmSync(resolve(out, entry));
