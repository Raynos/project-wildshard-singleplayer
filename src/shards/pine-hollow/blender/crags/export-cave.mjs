#!/usr/bin/env node
// export-cave.mjs — the bear cave's inputs for src/shards/pine-hollow/blender/crags/build_cave.py (PH-B2): the baked Pine Hollow heights
// on a 1 m grid in the cave's own frame (lx across, lz into the rock, from the mouth at BEAR_CAVE; src/shards/pine-hollow/world/crags.ts
// `caveWorld`), and the hero arch's pose there (src/shards/pine-hollow/world/landmarks.ts places it: 1.2 m inside the mouth, turned to
// face out, ×1.4, sunk 0.45 m). Run by scripts/blender/build.sh pine-hollow/cave (its pre step):
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/blender/crags/export-cave.mjs <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readNativeTerrain } from '@wildshard/sharddev/bake/terrain';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../../../../..');
const OUT = process.argv[2] ?? resolve(ROOT, 'cave-in.json');
const { BEAR_CAVE } = await import(pathToFileURL(resolve(ROOT, 'src/shards/pine-hollow/generators/layout.ts')).href);
const { heightAt } = readNativeTerrain(readFileSync(resolve(ROOT, 'public/assets/baked/pine-hollow/terrain.bin')));

const F = { x: BEAR_CAVE.x, z: BEAR_CAVE.z, yaw: BEAR_CAVE.rot };
const c = Math.cos(F.yaw), s = Math.sin(F.yaw);
const world = (lx, lz) => [F.x + lx * c + lz * s, F.z - lx * s + lz * c];
// the grid: lx −26…26, lz −16…50, 1 m
const X0 = -26, Z0 = -16, NX = 53, NZ = 67;
const h = [];
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const [x, z] = world(X0 + i, Z0 + j); h.push(Math.round(heightAt(x, z) * 1000) / 1000); }
// the arch (PineLandmarks.buildProps): 1.2 m inside the mouth, its front (+Z of the model) facing out (local −Z), ×1.4
const archY = heightAt(BEAR_CAVE.x, BEAR_CAVE.z) - 0.45;
const out = {
  frame: F,
  grid: { x0: X0, z0: Z0, step: 1, nx: NX, nz: NZ, h },
  arch: { glb: resolve(ROOT, 'public/assets/models/pine-hollow-hero/cave-arch/cave-arch.glb'), lx: 0, lz: 1.2, y: archY, yaw: Math.PI, scale: 1.4 },
  mouthGround: heightAt(BEAR_CAVE.x, BEAR_CAVE.z),
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`[cave] ${OUT}: grid ${NX}×${NZ}, mouth ground ${out.mouthGround.toFixed(2)}, arch y ${archY.toFixed(2)}`);
