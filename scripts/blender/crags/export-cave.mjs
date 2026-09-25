#!/usr/bin/env node
// export-cave.mjs — the bear cave's inputs for scripts/blender/crags/build_cave.py (PH-B2): the baked Pine Hollow heights
// on a 1 m grid in the cave's own frame (lx across, lz into the rock, from the mouth at BEAR_CAVE; src/world/PineCrags.ts
// `caveWorld`), and the hero arch's pose there (src/world/PineLandmarks.ts places it: 1.2 m inside the mouth, turned to
// face out, ×1.4, sunk 0.45 m). Run by scripts/blender/crags/run.sh:
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/blender/crags/export-cave.mjs <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../../..');
const OUT = process.argv[2] ?? resolve(ROOT, 'cave-in.json');
const noop = () => undefined;
Object.assign(globalThis, { window: { addEventListener: noop, location: new URL('http://localhost/') }, location: new URL('http://localhost/'), document: { createElement: () => ({ getContext: () => null, style: {} }) } });
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node', maxTouchPoints: 0, hardwareConcurrency: 8 }, configurable: true });
const src = (p) => import(pathToFileURL(resolve(ROOT, 'src', p)).href);
const registry = await src('chunks/registry.ts');
const HF = await src('world/Heightfield.ts');
const BT = await src('world/BakedTerrain.ts');
const L = await src('chunks/pineHollowLayout.ts');
registry.setActiveChunk('pine-hollow');
const buf = readFileSync(resolve(ROOT, 'public/assets/baked/pine-hollow/terrain.bin'));
HF._installBakedTerrain(BT.bakedSamplers(BT.parseBakedTerrain(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))));

const F = { x: L.BEAR_CAVE.x, z: L.BEAR_CAVE.z, yaw: L.BEAR_CAVE.rot };
const c = Math.cos(F.yaw), s = Math.sin(F.yaw);
const world = (lx, lz) => [F.x + lx * c + lz * s, F.z - lx * s + lz * c];
// the grid: lx −26…26, lz −16…50, 1 m
const X0 = -26, Z0 = -16, NX = 53, NZ = 67;
const h = [];
for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const [x, z] = world(X0 + i, Z0 + j); h.push(Math.round(HF.heightAt(x, z) * 1000) / 1000); }
// the arch (PineLandmarks.buildProps): 1.2 m inside the mouth, its front (+Z of the model) facing out (local −Z), ×1.4
const archY = HF.heightAt(L.BEAR_CAVE.x, L.BEAR_CAVE.z) - 0.45;
const out = {
  frame: F,
  grid: { x0: X0, z0: Z0, step: 1, nx: NX, nz: NZ, h },
  arch: { glb: resolve(ROOT, 'public/assets/models/pine-hollow-hero/cave-arch/cave-arch.glb'), lx: 0, lz: 1.2, y: archY, yaw: Math.PI, scale: 1.4 },
  mouthGround: HF.heightAt(L.BEAR_CAVE.x, L.BEAR_CAVE.z),
};
writeFileSync(OUT, JSON.stringify(out));
console.log(`[cave] ${OUT}: grid ${NX}×${NZ}, mouth ground ${out.mouthGround.toFixed(2)}, arch y ${archY.toFixed(2)}`);
