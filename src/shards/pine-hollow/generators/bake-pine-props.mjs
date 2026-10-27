#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's forest props scattered offline. The generator
// (src/shards/pine-hollow/generators/props.ts) uses explicit retained renderer height and normal queries, without
// installing a level, over the scans' footprints (the boulder set's six rocks and the fallen log, read from their LOD
// GLBs as the page's loaders read them) and the forest's trunks (src/shards/pine-hollow/data/physicsRows.json
// `shelterTrees`, the authored forest trunks). GR8 G26: `pineProps` gives every copy's pose to the scene model rows, the
// output's world/props.json and the prop scenes, instead of the retired pine-props job's data/props.json. D65: the scans and
// the trunk rows come from the program's sources.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakePineProps, propKit } from './props.ts';
import { pineCragGround } from './bake-pine-crags.mjs';
import { emptyShardfile } from '@wildshard/sdk/author';
import { PHYSICS_SOURCE, perSources, propScanSource, sourceJson } from './pineSources.ts';

const entries = emptyShardfile({ slug: 'pine-hollow', name: 'Pine Hollow', author: 'Wildshard', revision: 1, seed: 1337 }).entryways;

/** a LOD scan's mesh geometries in traverse order, as the page's loadLod + prepModel see them (no textures: only the shape) */
export async function pinePropScan(sources, id) {
  // the GLB re-packed without its images: Node has no image decoder, and the footprint is the geometry's alone
  const bytes = sources.bytes(propScanSource(id));
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
  loaded.scene.traverse((o) => { if (o.isMesh) out.push({ geometry: o.geometry, matrix: o.matrixWorld.clone() }); });
  return out;
}

/** the forest's trunks the props step round (the authored trunk rows, data/physicsRows.json `shelterTrees`: x, z, r, ...) */
export function pineTrunkCircles(sources) {
  return sourceJson(sources, PHYSICS_SOURCE).shelterTrees.map(([x, z, r]) => ({ x, z, r }));
}

/** the bake's rows */
export async function bakePropRows(sources) {
  const [rocks, [log]] = await Promise.all([pinePropScan(sources, 'rock_moss_set_01'), pinePropScan(sources, 'dead_tree_trunk')]);
  if (rocks.length !== 6 || log === undefined) throw new Error(`bake-pine-props: ${String(rocks.length)} rocks, log ${String(log !== undefined)}`);
  return bakePineProps(propKit(rocks.map(part => part.geometry), log.geometry), pineTrunkCircles(sources), pineCragGround(sources), entries);
}

/** The props bake's rows, built once per sources (about 15 ms). */
export const pineProps = perSources(bakePropRows);
