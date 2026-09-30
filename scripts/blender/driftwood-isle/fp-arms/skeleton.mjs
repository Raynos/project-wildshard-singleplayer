#!/usr/bin/env node
// skeleton.mjs — step 1 of Driftwood's first-person arms (E334, scripts/blender/targets.json "driftwood-isle/fp-arms"):
// read Nine Dragon's rig (public/assets/nine-dragon/viewmodel/fp-rig.glb: its skeleton and its 16 clips, round 13) and write
// the bind skeleton as JSON for the Blender script (arms.py), which models the castaway arms round it.
//
//   node scripts/blender/driftwood-isle/fp-arms/skeleton.mjs <out.json>
//
// Rig space = the viewmodel camera's space at scale 1 (x right, y up, −z forward, metres). Every bone's bind world
// matrix is the product of the node TRS down from vm_root (the GLB's nodes sit at the bind pose).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Matrix4, Quaternion, Vector3 } from 'three';

const ROOT = resolve(import.meta.dirname, '../../../..');
export const SRC = resolve(ROOT, 'public/assets/nine-dragon/viewmodel/fp-rig.glb');
/** the joints each arm keeps, in the skin's order */
export const ARM = ['shoulder', 'upperarm', 'forearm', 'twist1', 'twist2', 'twist3', 'hand'];

export async function rigIO() {
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
}

/** name → { parent, t, r, s, world (16, column-major) } for every node under vm_root that carries no mesh */
export function bindSkeleton(doc) {
  const root = doc.getRoot().listNodes().find((n) => n.getName() === 'vm_root');
  if (root === undefined) throw new Error('fp-rig.glb: no vm_root');
  const out = {};
  const walk = (n, parentName, parentWorld) => {
    const local = new Matrix4().compose(new Vector3(...n.getTranslation()), new Quaternion(...n.getRotation()), new Vector3(...n.getScale()));
    const world = parentWorld.clone().multiply(local);
    if (n.getMesh() === null) out[n.getName()] = { parent: parentName, t: n.getTranslation(), r: n.getRotation(), s: n.getScale(), world: world.toArray() };
    for (const c of n.listChildren()) walk(c, n.getName(), world);
  };
  for (const c of root.listChildren()) walk(c, null, new Matrix4());
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.length < 3) throw new Error('usage: skeleton.mjs <out.json>');
  const outPath = process.argv[2];
  const doc = await (await rigIO()).read(SRC);
  const bones = bindSkeleton(doc);
  const clips = doc.getRoot().listAnimations().map((a) => a.getName());
  writeFileSync(outPath, JSON.stringify({ source: 'public/assets/nine-dragon/viewmodel/fp-rig.glb', bones, clips }, null, 1));
  console.log(`skeleton.mjs: ${Object.keys(bones).length} nodes, ${clips.length} clips → ${outPath}`);
}
