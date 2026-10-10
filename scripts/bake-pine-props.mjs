#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's forest props scattered offline. The generator
// (src/shards/pine-hollow/generators/props.ts) runs here only, with the Pine level selected and its baked terrain grid
// installed (the page's heights and normals; the grid carries the level seed), over the scans' footprints (the boulder
// set's six rocks and the fallen log, read from their LOD GLBs as the page's loaders read them) and the forest's trunks
// (src/shards/pine-hollow/runtime/physics.baked.json `trees`, the page's forest). It writes every copy's pose to
// src/shards/pine-hollow/data/props.json, which the page places the scans at (src/shards/pine-hollow/world/props.ts).
// test/shards/pine-hollow/props-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-pine-props.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakePineProps, propKit } from '../src/shards/pine-hollow/generators/props.ts';
import { installPineGround } from './bake-pine-crags.mjs';

const root = resolve(import.meta.dirname, '..');

/** a LOD scan's mesh geometries in traverse order, as the page's loadLod + prepModel see them (no textures: only the shape) */
async function scan(id) {
  // the GLB re-packed without its images: Node has no image decoder, and the footprint is the geometry's alone
  const bytes = new Uint8Array(readFileSync(resolve(root, `public/assets/models/${id}/${id}_lod.glb`)));
  const len = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
  for (const key of ['images', 'textures', 'samplers']) delete gltf[key];
  for (const m of gltf.materials ?? []) {
    for (const k of ['normalTexture', 'occlusionTexture', 'emissiveTexture']) delete m[k];
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  const text = new TextEncoder().encode(JSON.stringify(gltf)), pad = (4 - (text.length % 4)) % 4, rest = bytes.subarray(20 + len);
  const glb = new Uint8Array(20 + text.length + pad + rest.length), view = new DataView(glb.buffer);
  glb.set(bytes.subarray(0, 20)); glb.set(text, 20); glb.fill(0x20, 20 + text.length, 20 + text.length + pad); glb.set(rest, 20 + text.length + pad);
  view.setUint32(8, glb.length, true); view.setUint32(12, text.length + pad, true);
  const loaded = await new GLTFLoader().parseAsync(glb.buffer, '');
  loaded.scene.updateMatrixWorld(true);
  const out = [];
  loaded.scene.traverse((o) => { if (o.isMesh) out.push(o.geometry); });
  return out;
}

/** the forest's trunks the props step round (the physics bake's capture of the page's forest: x, z, r) */
export function pineTrunkCircles() {
  const physics = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/runtime/physics.baked.json'), 'utf8'));
  return physics.trees.map(([x, z, r]) => ({ x, z, r }));
}

/** the bake's rows */
export async function bakePropRows() {
  installPineGround();
  const [rocks, [log]] = await Promise.all([scan('rock_moss_set_01'), scan('dead_tree_trunk')]);
  if (rocks.length !== 6 || log === undefined) throw new Error(`bake-pine-props: ${String(rocks.length)} rocks, log ${String(log !== undefined)}`);
  return bakePineProps(propKit(rocks, log), pineTrunkCircles());
}

if (import.meta.main) {
  const rows = await bakePropRows();
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/props.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow props: ${String(rows.rocks.length)} rocks, ${String(rows.stumps.length)} stumps, ${String(rows.logs.length)} logs (data/props.json)`);
}
