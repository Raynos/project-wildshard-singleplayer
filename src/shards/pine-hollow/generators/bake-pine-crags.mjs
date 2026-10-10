#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's crags baked offline. The generator
// (src/shards/pine-hollow/generators/crags.ts) runs here only, with the Pine level selected and its baked terrain grid
// installed (public/assets/baked/pine-hollow/terrain.bin: the page's heights and normals), over the kit's module footprints
// (public/assets/models/pine-hollow-crags/crags.glb + crags-b.glb, loaded as the page loads them) and the forest's trunks
// (src/shards/pine-hollow/runtime/physics.baked.json `trees`, the page's forest). It writes each tier's face skin,
// its 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/pine-hollow/baked/crags.<tier>.bin and the rows (the placements, each tier's binary hash,
// size and tile table) to src/shards/pine-hollow/data/crags.json, which the page reads (src/shards/pine-hollow/world/cragBake.ts).
// test/shards/pine-hollow/crag-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/pine-hollow/generators/bake-pine-crags.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { setActiveChunk } from '../../../game/shard/registry.ts';
import { installBakedGrid, parseBakedTerrain } from '../../../engine/world/BakedTerrain.ts';
import { bakePineCrags, shuffleLanes } from './crags.ts';

const root = resolve(import.meta.dirname, '../../../..');
const read = (path) => { const bytes = readFileSync(resolve(root, path)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };

/** the page's ground under the crags: the Pine level selected, its baked grid installed as the page installs it at load */
export function installPineGround() {
  setActiveChunk('pine-hollow');
  const grid = parseBakedTerrain(read('public/assets/baked/pine-hollow/terrain.bin'));
  if (grid === null) throw new Error('bake-pine-crags: no Pine terrain grid');
  installBakedGrid(grid); // refuses a grid whose seed is not the level's
  return grid.seed;
}

/** the kit's nodes as the page's PineCrags.load reads them: float positions in the node's world frame, bounds computed */
export async function pineCragKit() {
  await MeshoptDecoder.ready;
  const kit = new Map();
  for (const file of ['crags.glb', 'crags-b.glb']) {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(read(`public/assets/models/pine-hollow-crags/${file}`), '');
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const a = o.geometry.getAttribute('position'), pos = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = a.getComponent(i, k);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.applyMatrix4(o.matrixWorld);
      g.computeBoundingBox();
      kit.set(o.name, g);
    });
  }
  return kit;
}

/** the forest's trunks the crags step round (the physics bake's capture of the page's forest) */
export function pineTrunks() {
  const physics = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/runtime/physics.baked.json'), 'utf8'));
  return physics.trees.map(([x, z]) => ({ x, z }));
}

/** the bake: the rows and each tier's raw binary */
export async function bakeCragRows() {
  installPineGround();
  const { places, skin } = bakePineCrags(await pineCragKit(), pineTrunks());
  const tier = (t) => ({ bin: createHash('sha256').update(skin[t].bin).digest('hex'), bytes: skin[t].bin.length, tiles: skin[t].tiles });
  return { rows: { places, skin: { phone: tier('phone'), desktop: tier('desktop') } }, bins: { phone: skin.phone.bin, desktop: skin.desktop.bin } };
}

if (import.meta.main) {
  const { rows, bins } = await bakeCragRows();
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const sizes = [];
  for (const t of ['phone', 'desktop']) {
    const packed = deflateSync(shuffleLanes(bins[t]), { level: 9 });
    writeFileSync(resolve(out, `crags.${t}.bin`), packed);
    sizes.push(`${t} ${String(rows.skin[t].tiles.length)} tiles ${String(bins[t].length)} → ${String(packed.length)} zlib`);
  }
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/crags.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow crags: ${String(rows.places.length)} placements; ${sizes.join('; ')} (baked/crags.<tier>.bin)`);
}
