#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Sky Reach's code-built world pieces baked offline. The
// generators (src/shards/far-reach/generators/*.ts) run here only; each piece's static GLB goes to
// public/assets/far-reach/baked/<piece>.glb and its rows (the GLB's content hash, the instanced kinds, the colliders) to
// src/shards/far-reach/data/<rows>.json, which the client reads (world/baked.ts). test/shards/far-reach/world-bake.test.ts
// is the byte-exact stale gate (it re-runs the generators).
// Usage: node --import ./scripts/bake-loader.mjs scripts/bake-sky-world.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..'), project = resolve(root, 'src/shards/far-reach');
const out = resolve(root, 'public/assets/far-reach/baked');
// [piece (the GLB's name), its rows file under data/, the generator module, its bake function]
const PIECES = [['winch-house', 'winchHouse', 'generators/winchHouse.ts', 'bakeSkyWinchHouse'], ['roost', 'roost', 'generators/roost.ts', 'bakeSkyRoost'], ['docks', 'docks', 'generators/skyDock.ts', 'bakeSkyDocks'],
  ['crown', 'crown', 'generators/crown.ts', 'bakeSkyCrown'], ['mill', 'mill', 'generators/mill.ts', 'bakeSkyMill'],
  ['book-stand', 'bookStand', 'generators/bookStand.ts', 'bakeSkyBookStand'], ['knolls', 'knolls', 'generators/knoll.ts', 'bakeSkyKnolls'],
  ['geometries', 'geometries', 'generators/geometries.ts', 'bakeSkyGeometries']];
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
// the data-only bakes: rows a generator computes (no GLB)
for (const [rows, file, name] of [['seaTexture', 'generators/seaTexture.ts', 'bakeSkySeaTexture'], ['skyCards', 'generators/skyCards.ts', 'bakeSkyCards']]) {
  const generator = await import(pathToFileURL(resolve(project, file)).href);
  writeFileSync(resolve(project, `data/${rows}.json`), `${JSON.stringify(generator[name](), null, 2)}\n`);
  console.info(`far-reach ${rows}: data/${rows}.json`);
}
// the instance bakes: a generator's placed copies as float32 instance matrices + colours (lane-shuffled, deflated)
{
  const { bakeSkyDressing } = await import(pathToFileURL(resolve(project, 'generators/dressing.ts')).href);
  const { rows, bytes, discs } = bakeSkyDressing(), bin = deflateSync(bytes, { level: 9 });
  writeFileSync(resolve(out, 'dressing.bin'), bin);
  writeFileSync(resolve(project, 'data/dressing.json'), `${JSON.stringify({ lanes: createHash('sha256').update(bytes).digest('hex'), sets: rows, discs }, null, 2)}\n`);
  console.info(`far-reach dressing: ${String(bytes.length)} bytes → baked/dressing.bin (${String(bin.length)} deflated), ${rows.map((r) => `${r.name} ${String(r.count)}`).join(', ')}`);
}
// the rope bridges: every rope span from the kit's two source models, as a deflated geometry pack (world/shapes.ts ropeBridge)
{
  const { bakeSkyBridges } = await import(pathToFileURL(resolve(project, 'generators/bridges.ts')).href);
  const { bin, rows } = await bakeSkyBridges((url) => new Uint8Array(readFileSync(resolve(root, `public${url}`)))), packed = deflateSync(bin, { level: 9 });
  writeFileSync(resolve(out, 'bridges.bin'), packed);
  writeFileSync(resolve(project, 'data/bridges.json'), `${JSON.stringify({ pack: createHash('sha256').update(bin).digest('hex'), ...rows })}\n`);
  console.info(`far-reach bridges: ${String(bin.length)} bytes → baked/bridges.bin (${String(packed.length)} deflated), ${String(rows.spans.length)} spans, ${String(rows.geometries.length)} geometries`);
}
// the war fan's built shapes, as a deflated geometry pack (weapons/fanModel.ts fanParts)
{
  const { bakeSkyFan } = await import(pathToFileURL(resolve(project, 'generators/fan.ts')).href);
  const { bin, rows } = bakeSkyFan(), packed = deflateSync(bin, { level: 9 });
  writeFileSync(resolve(out, 'fan.bin'), packed);
  writeFileSync(resolve(project, 'data/fan.json'), `${JSON.stringify({ pack: createHash('sha256').update(bin).digest('hex'), ...rows })}\n`);
  console.info(`far-reach fan: ${String(bin.length)} bytes → baked/fan.bin (${String(packed.length)} deflated), ${String(rows.geometries.length)} geometries`);
}
// the sky-isle models' unit frames (world/skyIsleHd.ts skyIsleUnit), found from each model's GLB
{
  const { bakeSkyIsleFrames } = await import(pathToFileURL(resolve(project, 'generators/skyIsleFrames.ts')).href);
  const frames = await bakeSkyIsleFrames((url) => new Uint8Array(readFileSync(resolve(root, `public${url}`))));
  writeFileSync(resolve(project, 'data/skyIsleFrames.json'), `${JSON.stringify(frames, null, 2)}\n`);
  console.info(`far-reach sky isle frames: ${frames.map((f) => f.model).join(', ')}`);
}
// the folder holds exactly this bake: no orphan GLB from an older bake ships
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry)) rmSync(resolve(out, entry));
