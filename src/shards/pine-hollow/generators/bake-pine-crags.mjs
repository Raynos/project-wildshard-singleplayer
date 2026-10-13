#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's crags baked offline. The generator
// (src/shards/pine-hollow/generators/crags.ts) reads the original renderer lattice through explicit authoring queries
// (public/assets/baked/pine-hollow/terrain.bin: the page's heights and normals), over the kit's module footprints
// (public/assets/models/pine-hollow-crags/crags.glb + crags-b.glb, loaded as the page loads them) and the forest's trunks
// (src/shards/pine-hollow/data/physicsRows.json `shelterTrees`, the authored forest trunks). It writes each tier's face skin,
// its 4-byte words' bytes in four lanes and zlib-compressed, to public/assets/pine-hollow/baked/crags.<tier>.bin and the rows (the placements, each tier's binary hash,
// size and tile table) to src/shards/pine-hollow/data/crags.json, which the page reads (src/shards/pine-hollow/world/cragBake.ts).
// test/shards/pine-hollow/crag-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/pine-hollow/generators/bake-pine-crags.mjs
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readNativeTerrain } from '@wildshard/sdk/bake/terrain';
import { pineCragQueries } from './cragGround.ts';
import { bakePineCrags, shuffleLanes } from './crags.ts';
import { pineCragBake } from './cragScene.ts';

const root = resolve(import.meta.dirname, '../../../..');
const read = (path) => { const bytes = readFileSync(resolve(root, path)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };

/** The original renderer lattice, with explicit retained trail and cabin exclusion laws and no installed level. */
export function pineCragGround() {
  const ground = readNativeTerrain(readFileSync(resolve(root, 'public/assets/baked/pine-hollow/terrain.bin')));
  if (ground.grid.seed !== 1337) throw new Error('bake-pine-crags: wrong Pine terrain seed');
  return pineCragQueries(ground);
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

/** the forest's trunks the crags step round (the authored trunk rows, data/physicsRows.json `shelterTrees`: x, z, ...) */
export function pineTrunks() {
  const physics = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/data/physicsRows.json'), 'utf8'));
  return physics.shelterTrees.map(([x, z]) => ({ x, z }));
}

/** the bake: the rows and each tier's raw binary */
export async function bakeCragRows() {
  const { places, skin } = bakePineCrags(await pineCragKit(), pineTrunks(), pineCragGround());
  const tier = (t) => ({ bin: createHash('sha256').update(skin[t].bin).digest('hex'), bytes: skin[t].bin.length, tiles: skin[t].tiles });
  return { rows: { places, skin: { phone: tier('phone'), desktop: tier('desktop') } }, bins: { phone: skin.phone.bin, desktop: skin.desktop.bin } };
}

if (import.meta.main) {
  const { rows, bins } = await bakeCragRows();
  const authored = pineCragBake({ phone: { bin: bins.phone, tiles: rows.skin.phone.tiles }, desktop: { bin: bins.desktop, tiles: rows.skin.desktop.tiles } }, root);
  const out = resolve(root, 'public/assets/pine-hollow/baked');
  mkdirSync(out, { recursive: true });
  const sizes = [];
  for (const t of ['phone', 'desktop']) {
    const packed = deflateSync(shuffleLanes(bins[t]), { level: 9 });
    writeFileSync(resolve(out, `crags.${t}.bin`), packed);
    sizes.push(`${t} ${String(rows.skin[t].tiles.length)} tiles ${String(bins[t].length)} → ${String(packed.length)} zlib`);
  }
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/crags.json'), `${JSON.stringify(rows)}\n`);
  const shapes = resolve(out, 'crag-skins'); mkdirSync(shapes, { recursive: true });
  const pieces = authored.pieces.map(piece => {
    const hash = createHash('sha256').update(piece.glb).digest('hex');
    writeFileSync(resolve(shapes, `${hash}.glb`), piece.glb);
    return { id: piece.name, glb: hash, kinds: piece.kinds };
  });
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/cragScene.generated.json'), `${JSON.stringify({ scene: authored.sceneHash, pieces })}\n`);
  console.info(`pine-hollow crags: ${String(rows.places.length)} placements; ${sizes.join('; ')} (baked/crags.<tier>.bin)`);
}
