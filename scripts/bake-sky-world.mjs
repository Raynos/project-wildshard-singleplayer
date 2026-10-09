#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Sky Reach's code-built world pieces baked offline. The
// generators (src/shards/far-reach/generators/*.ts) run here only; each piece's static GLB goes to
// public/assets/far-reach/baked/<piece>.glb and its rows (the GLB's content hash, the instanced kinds, the colliders) to
// src/shards/far-reach/data/<rows>.json, which the client reads (world/baked.ts). test/shards/far-reach/world-bake.test.ts
// is the byte-exact stale gate (it re-runs the generators).
// Usage: node --import ./scripts/bake-loader.mjs scripts/bake-sky-world.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/far-reach');
const out = resolve(root, 'public/assets/far-reach/baked');
// [piece (the GLB's name), its rows file under data/, the generator module, its bake function]
const PIECES = [['winch-house', 'winchHouse', 'generators/winchHouse.ts', 'bakeSkyWinchHouse']];
mkdirSync(out, { recursive: true });
const keep = new Set();
for (const [piece, rows, file, name] of PIECES) {
  const generator = await import(pathToFileURL(resolve(project, file)).href);
  const { glb, ...data } = generator[name]();
  const hash = createHash('sha256').update(glb).digest('hex');
  writeFileSync(resolve(out, `${piece}.glb`), glb); keep.add(`${piece}.glb`);
  writeFileSync(resolve(project, `data/${rows}.json`), `${JSON.stringify({ glb: hash, ...data }, null, 2)}\n`);
  console.info(`far-reach ${piece}: ${String(glb.length)} bytes → baked/${piece}.glb (${hash}), ${String(data.kinds.length)} kinds, ${String(data.colliders.length)} colliders`);
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) rmSync(resolve(out, entry));
