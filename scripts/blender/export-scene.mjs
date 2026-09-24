#!/usr/bin/env node
// export-scene.mjs — step 1 of the Blender island pipeline (DRIFTWOOD-REMASTER X2, E52).
//
// Runs the game's own terrain + layout code in Node (as scripts/bake-chunk.mjs does) and writes what Blender needs
// to author the spawn cove on the SAME ground the player walks:
//
//   <cache>/scene.json       the area, the sea level, every layout spec (palms, boulders, bushes, trailside, pier)
//   <cache>/area.bin          f32 grid over the area at STEP m: height · r · g · b (the game's ground colour) · slope ·
//                             trail distance  (6 floats per vertex, row-major iz·nx + ix, x = x0 + ix·STEP, z = z0 + iz·STEP)
//   <cache>/context.bin       f32 grid over the whole chunk at the game's own 256² resolution (height only): the GI bake's
//                             surroundings (the plateau beyond the area occludes the sky, the far beach bounces light)
//   <cache>/structures.bin    the procedural structures kept in blender mode (pier, hut, trailside stair / fences, boat) as
//                             triangle soup: u32 tris · f32[tris·9] positions · f32[tris·9] colours — bake occluders only
//
// Heights come from the BAKED grid (public/assets/baked/driftwood-isle/terrain.bin → Heightfield's bilinear lookups), i.e.
// exactly the surface Player.groundAt() walks, so the Blender terrain never floats or sinks against collision.
//
//   node --import ./scripts/bake-loader.mjs scripts/blender/export-scene.mjs [cacheDir]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../..');
const CACHE = resolve(process.argv[2] ?? `${homedir()}/.cache/wildshard-blender`);
mkdirSync(CACHE, { recursive: true });
if (!('location' in globalThis)) Object.assign(globalThis, { location: new URL('http://localhost/?tier=desktop') });

const imp = (p) => import(pathToFileURL(resolve(ROOT, p)).href);
const { CHUNK_SIZE, CHUNK_HALF, TERRAIN_RES, ROAD_LENGTH } = await imp('src/core/config.ts');
const registry = await imp('src/chunks/registry.ts');
registry.setActiveChunk('driftwood-isle');
const hf = await imp('src/world/Heightfield.ts');
const baked = await imp('src/world/BakedTerrain.ts');
const def = registry.getActiveChunk();
const grid = baked.parseBakedTerrain(readFileSync(resolve(ROOT, 'public/assets/baked/driftwood-isle/terrain.bin')).buffer.slice(0));
if (!grid) throw new Error('no baked terrain');
hf._installBakedTerrain(baked.bakedSamplers(grid));
const THREE = await import('three');
const { lowPolyGroundColor } = await imp('src/world/Terrain.ts');
const island = await imp('src/chunks/driftwood-isle.ts');
const { area: AREA, STEP } = await imp('src/world/blenderArea.ts');

// ── the area grid ──
const x0 = AREA.x0, z0 = AREA.z0;
const nx = Math.round((AREA.x1 - AREA.x0) / STEP) + 1, nz = Math.round((AREA.z1 - AREA.z0) / STEP) + 1;
const wl = def.ocean.level;
const g = new Float32Array(nx * nz * 6);
const c = new THREE.Color(), pathC = new THREE.Color('#d6bd84');
const ss = THREE.MathUtils.smoothstep;
const hash2 = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
  const x = x0 + ix * STEP, z = z0 + iz * STEP, y = hf.heightAt(x, z);
  const [, ny] = hf.normalAt(x, z, 0.98);
  let lip = 0;
  if (ny < 0.8) { const hi = Math.max(hf.heightAt(x + 2.5, z), hf.heightAt(x - 2.5, z), hf.heightAt(x, z + 2.5), hf.heightAt(x, z - 2.5)); lip = 1 - ss(hi - y, 0.4, 1.4); }
  lowPolyGroundColor(c, y - wl, 1 - ny, x, z, lip);
  const td = hf.trailDistance(x, z);
  if (y - wl > 1.5 && td < 4.5) { pathC.set('#d6bd84').multiplyScalar(0.94 + hash2(x, z) * 0.12); c.lerp(pathC, 1 - ss(td, 2.2, 4.5)); }
  g.set([y, c.r, c.g, c.b, 1 - ny, td], (iz * nx + ix) * 6);
}
writeFileSync(`${CACHE}/area.bin`, Buffer.from(g.buffer));

// ── the whole chunk, coarse (the bake's surroundings) ──
const res = TERRAIN_RES, d = CHUNK_SIZE / (res - 1);
const ctx = new Float32Array(res * res);
for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) ctx[iz * res + ix] = hf.heightAt(-CHUNK_HALF + ix * d, -CHUNK_HALF + iz * d);
writeFileSync(`${CACHE}/context.bin`, Buffer.from(ctx.buffer));

// ── layout specs (desktop tier, as the bake's reference) ──
const { Palms } = await imp('src/world/Palms.ts');
const { Boulders } = await imp('src/world/Boulders.ts');
const { Bushes } = await imp('src/world/Bushes.ts');
const { Trailside } = await imp('src/world/Trailside.ts');
const { Pier } = await imp('src/world/Pier.ts');
const { Hut } = await imp('src/world/Hut.ts');
const { HUT, LOOKOUT, SHRINE, WRECK } = island;
const AVOID = [{ x: HUT.x, z: HUT.z, r: 11 }, { x: LOOKOUT.x, z: LOOKOUT.z, r: 12 }, { x: SHRINE.x, z: SHRINE.z, r: 13 }, { x: WRECK.x, z: WRECK.z, r: 14 }];
const palms = Palms.scatterIsland(def.seed, undefined, AVOID);
const rocks = Boulders.scatterShore(def.seed);
const bushes = Bushes.scatterIsland(def.seed, undefined, AVOID);
const trailside = Trailside.forIsland();

// ── structures kept in blender mode, as bake occluders ──
const sky = { setupMaterial() { /* no CSM in Node */ }, viewCamera: new THREE.PerspectiveCamera() };
const soupPos = [], soupCol = [];
const addObject = (obj) => {
  obj.updateMatrixWorld(true);
  obj.traverse((m) => {
    if (!m.isMesh || !m.geometry) return;
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const p = geo.getAttribute('position'), col = geo.getAttribute('color');
    if (!p) return;
    const v = new THREE.Vector3();
    const count = m.isInstancedMesh ? m.count : 1;
    const im = new THREE.Matrix4();
    for (let k = 0; k < count; k++) {
      const mw = m.matrixWorld.clone();
      if (m.isInstancedMesh) { m.getMatrixAt(k, im); mw.multiply(im); }
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(mw);
        soupPos.push(v.x, v.y, v.z);
        soupCol.push(col ? col.getX(i) : 0.6, col ? col.getY(i) : 0.5, col ? col.getZ(i) : 0.4);
      }
    }
  });
};
const tryBuild = (name, f) => { try { addObject(f()); } catch (e) { console.warn(`[export] ${name} skipped: ${e.message}`); } };
const pier = new Pier(sky, { x: 0, z: -CHUNK_HALF, length: ROAD_LENGTH, width: 4, deckY: wl + 1.2, landing: true }).build();
addObject(pier.group);
tryBuild('hut', () => new Hut(sky, HUT).build().group);
tryBuild('trailside', () => new Trailside(sky).build(trailside).mesh);
const tris = soupPos.length / 9;
const soup = new Float32Array(1 + soupPos.length * 2);
new Uint32Array(soup.buffer, 0, 1)[0] = tris;
soup.set(soupPos, 1); soup.set(soupCol, 1 + soupPos.length);
writeFileSync(`${CACHE}/structures.bin`, Buffer.from(soup.buffer));

const scene = {
  area: { x0, z0, x1: AREA.x1, z1: AREA.z1, step: STEP, nx, nz }, sea: wl,
  chunk: { size: CHUNK_SIZE, res },
  palms, rocks, bushes,
  trailside: { steps: trailside.steps ?? null, fences: trailside.fences ?? null, signs: trailside.signs ?? null },
  pier: { posts: pier.posts, bollards: pier.bollards, deckY: pier.deckY, colliders: pier.colliders },
  paths: island.PATHS, plateau: island.PLATEAU, hut: HUT,
};
writeFileSync(`${CACHE}/scene.json`, JSON.stringify(scene));
console.log(`[export] ${CACHE}: area ${nx}×${nz} @ ${STEP} m, palms ${palms.length}, rocks ${rocks.length}, bushes ${bushes.length}, structure tris ${tris}`);
