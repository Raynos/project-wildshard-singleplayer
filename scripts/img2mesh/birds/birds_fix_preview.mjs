#!/usr/bin/env node
// birds_fix_preview.mjs — E322 F-M5: run src/pinehollow/life/birdFix.ts (Debug ▸ Bird fix = B) on birds.glb in Node and
// write GLBs to render: the owl's flying body inflated, the perched woodpecker clinging — both in the frame the game
// shows them in (the owl as flown; the woodpecker in its perch's world frame: +y up, the bark the plane z = 0.05).
//
//   node --import ./scripts/bake-loader.mjs scripts/img2mesh/birds/birds_fix_preview.mjs <birds.glb> <birds.json> <out dir>
//
// Writes <out>/birds-A.glb (today, same frames) and <out>/birds-B.glb (fixed); render them with birds_fix_render.py.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as THREE from 'three';
import { inflateBody, clingPose } from '../../../src/pinehollow/life/birdFix.ts';

const [src, sidePath, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const side = JSON.parse(readFileSync(sidePath, 'utf8')).meshes;
const WOOD_PITCH = 1.3, WOOD_FEET = 0.115;   // birdModels.ts BIRDS: the woodpecker's perch pitch and feet

function parse(buf) {
  const len = buf.readUInt32LE(12), json = JSON.parse(buf.subarray(20, 20 + len).toString());
  const binLen = buf.readUInt32LE(20 + len), bin = Buffer.from(buf.subarray(28 + len, 28 + len + binLen));
  return { json, bin };
}
function write(path, json, bin) {
  let j = Buffer.from(JSON.stringify(json)); j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const b = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const h = Buffer.alloc(12); h.writeUInt32LE(0x46546c67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const cj = Buffer.alloc(8); cj.writeUInt32LE(j.length, 0); cj.writeUInt32LE(0x4e4f534a, 4);
  const cb = Buffer.alloc(8); cb.writeUInt32LE(b.length, 0); cb.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([h, cj, j, cb, b]));
}
const view = (json, bin, ai) => {
  const a = json.accessors[ai], bv = json.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  if (a.componentType === 5126) return new Float32Array(bin.buffer, bin.byteOffset + off, a.count * n);
  if (a.componentType === 5123) return new Uint16Array(bin.buffer, bin.byteOffset + off, a.count * n);
  return new Uint32Array(bin.buffer, bin.byteOffset + off, a.count * n);
};
/** birdModels.ts smoothNormals, on flat arrays */
function smoothNormals(pos, idx, nor) {
  const key = (i) => `${Math.round(pos[i * 3] * 2e4)},${Math.round(pos[i * 3 + 1] * 2e4)},${Math.round(pos[i * 3 + 2] * 2e4)}`;
  const acc = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let t = 0; t < idx.length / 3; t++) {
    const i0 = idx[t * 3], i1 = idx[t * 3 + 1], i2 = idx[t * 3 + 2];
    a.fromArray(pos, i0 * 3); b.fromArray(pos, i1 * 3); c.fromArray(pos, i2 * 3);
    const n = c.sub(b).cross(a.sub(b));
    for (const i of [i0, i1, i2]) { const k = key(i), v = acc.get(k); if (v) v.add(n); else acc.set(k, n.clone()); }
  }
  for (let i = 0; i < pos.length / 3; i++) { const v = acc.get(key(i)); if (!v) continue; v.normalize(); nor[i * 3] = v.x; nor[i * 3 + 1] = v.y; nor[i * 3 + 2] = v.z; }
}

for (const variant of ['A', 'B']) {
  const { json, bin } = parse(readFileSync(src));
  for (const node of json.nodes) {
    if (node.mesh === undefined) continue;
    const prim = json.meshes[node.mesh].primitives[0];
    const pos = view(json, bin, prim.attributes.POSITION), nor = view(json, bin, prim.attributes.NORMAL), idx = view(json, bin, prim.indices);
    const s = side[node.name];
    if (node.name === 'owl_fly' && variant === 'B') { inflateBody(pos, nor, s); smoothNormals(pos, idx, nor); }
    if (node.name === 'wood_perch') {
      // birdModels.ts's pose frame (lift, then the level tilt), then — for B — the cling, then the perch's world frame
      const lift = new THREE.Matrix4().makeTranslation(0, -WOOD_FEET - s.feetY, 0);
      const tilt = Math.atan2(s.beakTip[1] - s.tailRoot[1], s.beakTip[2] - s.tailRoot[2]);
      const g2p = new THREE.Matrix4().makeRotationX(tilt).multiply(lift);
      const p = new THREE.Vector3();
      for (let i = 0; i < pos.length / 3; i++) { p.fromArray(pos, i * 3).applyMatrix4(g2p); p.toArray(pos, i * 3); }
      if (variant === 'B') clingPose(pos, s, g2p, { pitch: WOOD_PITCH });
      const W = new THREE.Matrix4().makeRotationX(-WOOD_PITCH);
      for (let i = 0; i < pos.length / 3; i++) { p.fromArray(pos, i * 3).applyMatrix4(W); p.toArray(pos, i * 3); }
      smoothNormals(pos, idx, nor);
    }
    const a = json.accessors[prim.attributes.POSITION];
    a.min = [0, 1, 2].map((k) => Math.min(...Array.from({ length: pos.length / 3 }, (_, i) => pos[i * 3 + k])));
    a.max = [0, 1, 2].map((k) => Math.max(...Array.from({ length: pos.length / 3 }, (_, i) => pos[i * 3 + k])));
  }
  write(`${out}/birds-${variant}.glb`, json, bin);
  console.log(`${out}/birds-${variant}.glb`);
}
