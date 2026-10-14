#!/usr/bin/env node
// SHARD-PLATFORM G285 (SF72, "bake the code-built worlds"): Pine Hollow's forest props scattered offline. The generator
// (src/shards/pine-hollow/generators/props.ts) uses explicit retained renderer height and normal queries, without
// installing a level, over the scans' footprints (the boulder
// set's six rocks and the fallen log, read from their LOD GLBs as the page's loaders read them) and the forest's trunks
// (src/shards/pine-hollow/data/physicsRows.json `shelterTrees`, the authored forest trunks). It writes every copy's pose to
// src/shards/pine-hollow/data/props.json, which the page places the scans at (src/shards/pine-hollow/world/props.ts).
// test/shards/pine-hollow/props-bake.test.ts is the stale gate (it re-runs the generator).
// Usage: node --experimental-transform-types --import ./src/sdk/bake/source-loader.mjs src/shards/pine-hollow/generators/bake-pine-props.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bakePineProps, propKit } from './props.ts';
import { pineCragGround } from './bake-pine-crags.mjs';
import { emptyShardfile } from '@wildshard/sdk/author';

const root = resolve(import.meta.dirname, '../../../..');
const entries = emptyShardfile({ slug: 'pine-hollow', name: 'Pine Hollow', author: 'Wildshard', revision: 1, seed: 1337 }).entryways;

/** a LOD scan's mesh geometries in traverse order, as the page's loadLod + prepModel see them (no textures: only the shape) */
export async function pinePropScan(id) {
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
  loaded.scene.traverse((o) => { if (o.isMesh) out.push({ geometry: o.geometry, matrix: o.matrixWorld.clone() }); });
  return out;
}

/** the forest's trunks the props step round (the authored trunk rows, data/physicsRows.json `shelterTrees`: x, z, r, ...) */
export function pineTrunkCircles() {
  const physics = JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/data/physicsRows.json'), 'utf8'));
  return physics.shelterTrees.map(([x, z, r]) => ({ x, z, r }));
}

/** the bake's rows */
export async function bakePropRows() {
  const [rocks, [log]] = await Promise.all([pinePropScan('rock_moss_set_01'), pinePropScan('dead_tree_trunk')]);
  if (rocks.length !== 6 || log === undefined) throw new Error(`bake-pine-props: ${String(rocks.length)} rocks, log ${String(log !== undefined)}`);
  return bakePineProps(propKit(rocks.map(part => part.geometry), log.geometry), pineTrunkCircles(), pineCragGround(), entries);
}

if (import.meta.main) {
  const rows = await bakePropRows();
  writeFileSync(resolve(root, 'src/shards/pine-hollow/data/props.json'), `${JSON.stringify(rows)}\n`);
  console.info(`pine-hollow props: ${String(rows.rocks.length)} rocks, ${String(rows.stumps.length)} stumps, ${String(rows.logs.length)} logs (data/props.json)`);
}

/** Retain every original material/image byte and drop the redundant source mesh payload. */
export function pinePropMaterialFiles() {
  const literal = (path) => { const text = readFileSync(resolve(root, path), 'utf8'); return JSON.parse(text.slice(text.indexOf(' = {') + 3, text.lastIndexOf('}') + 1)); };
  const GPU_FILES = literal('src/shards/pine-hollow/ktx2.generated.ts'), ASTC6_PHONE = literal('src/shards/pine-hollow/boot/astc6/ktx2.generated.ts');
  const aliases = {}, outputs = {}, costs = [];
  for (const id of ['rock_moss_set_01', 'tree_stump_01', 'dead_tree_trunk']) {
    const original = `/assets/models/${id}/${id}_lod.glb`, phone = original.replace('.glb', '.phone.glb');
    const urls = [...new Set([original, phone, GPU_FILES.desktop[original], GPU_FILES.phone[phone], ASTC6_PHONE[phone], ...readdirSync(resolve(root, `public/assets/gpu/models/${id}`)).filter(file => file.endsWith('.glb')).sort().map(file => `/assets/gpu/models/${id}/${file}`)].filter(Boolean))];
    for (const url of urls) {
      const bytes = readFileSync(resolve(root, `public${url}`)), length = bytes.readUInt32LE(12);
      const doc = JSON.parse(bytes.subarray(20, 20 + length).toString()), input = bytes.subarray(28 + length), pieces = [], views = [];
      const append = (part) => { const byteOffset = pieces.reduce((n, row) => n + row.length, 0); pieces.push(part, Buffer.alloc((-part.length) & 3)); views.push({ buffer: 0, byteOffset, byteLength: part.length }); return views.length - 1; };
      for (const image of doc.images) { const view = doc.bufferViews[image.bufferView]; image.bufferView = append(input.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)); }
      const position = append(Buffer.alloc(36)), normal = append(Buffer.alloc(36)), uv = append(Buffer.alloc(24));
      const compact = { asset: doc.asset, images: doc.images, textures: doc.textures, samplers: doc.samplers, materials: doc.materials,
        ...(doc.extensionsUsed === undefined ? {} : { extensionsUsed: doc.extensionsUsed }), ...(doc.extensionsRequired === undefined ? {} : { extensionsRequired: doc.extensionsRequired }),
        buffers: [{ byteLength: pieces.reduce((n, row) => n + row.length, 0) }], bufferViews: views,
        accessors: [{ bufferView: position, componentType: 5126, count: 3, type: 'VEC3', min: [0,0,0], max: [0,0,0] }, { bufferView: normal, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: uv, componentType: 5126, count: 3, type: 'VEC2' }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, material: 0, mode: 4 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 };
      const json = Buffer.from(JSON.stringify(compact)), text = Buffer.concat([json, Buffer.alloc((-json.length) & 3, 0x20)]), bin = Buffer.concat(pieces), header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8);
      header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2,4); header.writeUInt32LE(28 + text.length + bin.length,8); header.writeUInt32LE(text.length,12); header.writeUInt32LE(0x4e4f534a,16);
      binaryHeader.writeUInt32LE(bin.length); binaryHeader.writeUInt32LE(0x004e4942,4);
      const packed = Buffer.concat([header,text,binaryHeader,bin]), hash = createHash('sha256').update(packed).digest('hex'), target = `/assets/pine-hollow/baked/prop-materials/${hash}.glb`;
      aliases[url] = target; outputs[`public${target}`] = packed; costs.push({ original: url, before: bytes.length, after: packed.length });
    }
  }
  return { aliases, outputs, costs };
}
