/** E336: export the original skin joint order and rest matrices for local UniMate inference. */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { writeFileSync } from 'node:fs';

const [source, output] = process.argv.slice(2);
if (!source || !output) throw new Error('Usage: unimate-rig-input.mjs <skin.glb> <rig.json>');
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(source);
const skin = doc.getRoot().listSkins().at(0);
if (!skin) throw new Error('No skin in input');
const joints = skin.listJoints();
const world = joints.map((j) => new Matrix4().fromArray(j.getWorldMatrix()));
const rows = joints.map((j, i) => {
  const parent = joints.findIndex((p) => p.listChildren().includes(j));
  const local = world[i].clone();
  if (parent !== -1) local.premultiply(world[parent].clone().invert());
  const p = new Vector3(), q = new Quaternion(), s = new Vector3();
  local.decompose(p, q, s);
  const wp = new Vector3(), wq = new Quaternion();
  world[i].decompose(wp, wq, new Vector3());
  return { name: j.getName(), parent, position: p.toArray(), quaternion: q.toArray(), worldPosition: wp.toArray(), worldQuaternion: wq.toArray(), scale: s.toArray() };
});
writeFileSync(output, `${JSON.stringify({ source, joints: rows }, null, 2)  }\n`);
