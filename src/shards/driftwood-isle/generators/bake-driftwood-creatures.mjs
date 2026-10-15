#!/usr/bin/env node
// SHARD-PLATFORM C4: Driftwood Isle's lofted creature bodies (reef crab, coconut monkey, Drowned Sailor with its Hunyuan
// head, and the shared boar and bear in the island's toon palette), built offline by ./creatureBodies.ts exactly as the
// page's low-poly factory built them, written as one deflated, hash-named bake
// (public/assets/driftwood-isle/creatures/bodies-<sha256>.bin: every material group's attributes as built,
// @wildshard/sdk/kit/bakedGeometry blocks, each identical one once) and its rows (data/creatureBodies.generated.json). The
// page reads it back (species/bodies.ts) and faceted, tints and skins it as before. `--check` refuses stale outputs.
// Usage: node --experimental-transform-types --import ./scripts/bake-loader.mjs src/shards/driftwood-isle/generators/bake-driftwood-creatures.mjs [--check]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { BufferAttribute, Float16BufferAttribute, Mesh } from 'three';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { bakeCreatureBodies, faceHeadOf, bakeCaptainBody } from './creatureBodies.ts';

/** @wildshard/sdk/kit/bakedGeometry's element sizes and block padding (its reader decodes these blocks) */
const BAKED_BYTES = { f32: 4, f16: 2, u16: 2, i8: 1, u8: 1 }, pad4 = (n) => Math.ceil(n / 4) * 4;

const root = resolve(import.meta.dirname, '../../../..'), check = process.argv.includes('--check');
const HEAD = 'public/assets/models/driftwood-hero/faces/sailor-head.glb';
const source = await readSourceModel(new Uint8Array(readFileSync(resolve(root, HEAD))));
source.gltf.scene.updateMatrixWorld(true);
/** @type {Mesh[]} */
const meshes = [];
source.gltf.scene.traverse((o) => { if (o instanceof Mesh) meshes.push(o); });
if (meshes.length !== 1) throw new Error(`${HEAD} must hold one mesh`);
const headMesh = meshes.at(0);
if (headMesh === undefined) throw new Error('Missing sailor head');
const captain = await readSourceModel(new Uint8Array(readFileSync(resolve(root, 'public/assets/models/driftwood-hero/captain/captain.glb'))));
const bodies = [...bakeCreatureBodies(faceHeadOf(headMesh.geometry.clone().applyMatrix4(headMesh.matrixWorld))), bakeCaptainBody(captain.gltf.scene)];

/** @type {Uint8Array[]} */
const blocks = [];
let size = 0;
const push = (bytes) => { const block = new Uint8Array(pad4(bytes.length)); block.set(bytes); blocks.push(block); size += block.length; };
const typeOf = (attr, what) => {
  if (attr instanceof Float16BufferAttribute) return 'f16';
  const a = attr.array;
  if (a instanceof Float32Array) return 'f32';
  if (a instanceof Uint16Array) return 'u16';
  if (a instanceof Int8Array) return 'i8';
  if (a instanceof Uint8Array) return 'u8';
  throw new Error(`${what}: an attribute type the bake does not store`);
};
/** the blocks written so far by their bytes: an attribute (or index) identical to one already written (the boar coats
 *  share every channel but the colour, a kind's eye pairs all of them) points at the same block, as the reader copies
 *  each one out fresh */
const written = new Map();
const blockAt = (bytes) => {
  const digest = createHash('sha256').update(bytes).digest('hex'), seen = written.get(digest);
  if (seen !== undefined) return seen;
  const offset = size;
  push(bytes);
  written.set(digest, offset);
  return offset;
};
/** one geometry's row and each of its blocks' offsets into the inflated bake (its attributes in order, then its index) */
const write = (g, what) => {
  if (g === null) return null;
  const attrs = [], offsets = [];
  for (const [name, attr] of Object.entries(g.attributes).sort(([a], [b]) => Number(b === 'position') - Number(a === 'position'))) {
    if (!(attr instanceof BufferAttribute)) throw new Error(`${what}: '${name}' is interleaved`);
    const type = typeOf(attr, what);
    attrs.push([name, type, attr.itemSize, attr.normalized]);
    offsets.push(blockAt(new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.count * attr.itemSize * BAKED_BYTES[type])));
  }
  // the reader computes each group's bounds as it reads the first block
  if (attrs[0]?.[0] !== 'position') throw new Error(`${what}: position must come first`);
  const index = g.index;
  if (index !== null) {
    const deltas = new Int32Array(index.count);
    let last = 0;
    for (let i = 0; i < index.count; i++) { const v = index.getX(i); deltas[i] = v - last; last = v; }
    offsets.push(blockAt(new Uint8Array(deltas.buffer)));
  }
  const count = g.getAttribute('position').count;
  const row = { attrs, count, index: index === null ? null : count > 65535 ? 'u32' : 'u16', indexCount: index === null ? 0 : index.count, box: false };
  g.dispose();
  return { offsets, row };
};
const rows = bodies.map((b) => ({
  kind: b.kind, variant: b.variant, bones: b.bones, dims: b.dims,
  fur: write(b.fur, `${b.kind}.${b.variant} fur`), hard: write(b.hard, `${b.kind}.${b.variant} hard`), eye: write(b.eye, `${b.kind}.${b.variant} eye`),
}));
const raw = new Uint8Array(size);
let at = 0;
for (const block of blocks) { raw.set(block, at); at += block.length; }
const deflated = deflateSync(raw, { level: 9 });
const hash = createHash('sha256').update(deflated).digest('hex');
const url = `/assets/driftwood-isle/creatures/bodies-${hash}.bin`;
const json = `${JSON.stringify({ file: url, bytes: raw.length, bodies: rows })}\n`;
const outputs = [[resolve(root, `public${url}`), deflated], [resolve(root, 'src/shards/driftwood-isle/data/creatureBodies.generated.json'), Buffer.from(json)]];
let stale = false;
for (const [path, bytes] of outputs) {
  if (existsSync(path) && Buffer.compare(readFileSync(path), Buffer.from(bytes)) === 0) continue;
  if (check) { console.error(`Driftwood creature bodies stale: ${path}`); stale = true; continue; }
  mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, bytes);
}
if (!check) for (const name of readdirSync(resolve(root, 'public/assets/driftwood-isle/creatures'))) if (/^bodies-[0-9a-f]{64}\.bin$/u.test(name) && name !== `bodies-${hash}.bin`) console.warn(`Driftwood creature bodies: an older bake is left in place: ${name}`);
console.info(`Driftwood creature bodies: ${rows.map((r) => `${r.kind}.${r.variant}`).join(', ')}; ${String(raw.length)} bytes inflated, ${String(deflated.length)} deflated${check ? (stale ? ' STALE' : ' match') : ''}`);
if (stale) process.exitCode = 1;
