#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's crags baked offline. The generator
// (src/shards/pine-hollow/generators/crags.ts) reads the original renderer lattice through explicit authoring queries
// (public/assets/baked/pine-hollow/terrain.bin: the page's heights and normals), over the kit's module footprints
// (public/assets/models/pine-hollow-crags/crags.glb + crags-b.glb, loaded as the page loads them) and the forest's trunks
// (src/shards/pine-hollow/data/physicsRows.json `shelterTrees`, the authored forest trunks). GR8 G33: `pineCrags` gives
// the rows (the placements, each tier's binary hash, size and tile table) and each tier's raw face-skin binary to the
// crag scenes and the timber world, instead of the retired pine-crags job's data/crags.json and baked crags.<tier>.bin.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { pineCragQueries } from './cragGround.ts';
import { bakePineCrags, canonicalCragTiltX } from './crags.ts';

const root = resolve(import.meta.dirname, '../../../..');
const read = (path) => { const bytes = readFileSync(resolve(root, path)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };

/** The original renderer lattice, with explicit retained trail and cabin exclusion laws and no installed level. */
export function pineCragGround() {
  const ground = readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin')));
  if (ground.grid.seed !== 1337) throw new Error('bake-pine-crags: wrong Pine terrain seed');
  return pineCragQueries(ground);
}

/** the kit's nodes as the page's PineCrags.load reads them: float positions in the node's world frame, bounds computed */
export async function pineCragKit(files = ['crags.glb', 'crags-b.glb']) {
  await MeshoptDecoder.ready;
  const kit = new Map();
  for (const file of files) {
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(read(`public/assets/models/pine-hollow-crags/${file}`), '');
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const a = o.geometry.getAttribute('position'), pos = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < 3; k++) pos[i * 3 + k] = a.getComponent(i, k);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const index = o.geometry.getIndex(); if (index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from({ length: index.count }, (_v, i) => index.getX(i)), 1));
      g.applyMatrix4(o.matrixWorld);
      g.computeBoundingBox(); g.computeBoundingSphere();
      kit.set(o.name, g);
    });
  }
  return kit;
}

/** the forest's trunks the crags step round (the authored trunk rows, data/physicsRows.json `shelterTrees`: x, z, ...) */
export function pineTrunks() {
  const physics = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/data/physicsRows.json'), 'utf8'));
  return physics.shelterTrees.map(([x, z]) => ({ x, z }));
}

/** the bake: the rows and each tier's raw binary */
export async function bakeCragRows() {
  const { places, skin } = bakePineCrags(await pineCragKit(), pineTrunks(), pineCragGround());
  for (const placement of places) placement.tiltX = canonicalCragTiltX(placement.tiltX);
  const tier = (t) => ({ bin: createHash('sha256').update(skin[t].bin).digest('hex'), bytes: skin[t].bin.length, tiles: skin[t].tiles });
  return { rows: { places, skin: { phone: tier('phone'), desktop: tier('desktop') } }, bins: { phone: skin.phone.bin, desktop: skin.desktop.bin } };
}

let crags;
/** The crag bake's rows and each tier's raw binary, built once per process. */
export function pineCrags() {
  crags ??= bakeCragRows();
  return crags;
}
