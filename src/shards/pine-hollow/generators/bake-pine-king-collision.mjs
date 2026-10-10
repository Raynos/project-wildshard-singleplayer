// Native collision metadata from the real GLB. Clips are sampled at 60 Hz for the old-bone oracle;
// gameplay uses the scalar blend + collision-only FK, never interpolation of this clip-only table.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';
import { Bone, Group } from 'three';
import { kingRest, newPose, clipPose, applyKingPose } from '../combat/kingRig.ts';
import { KING_ATTACK_TIMING } from '../combat/kingTiming.ts';
import { readKingCollisionBake } from '../runtime/kingCollisionBake.ts';
import { withPortableMath } from '../../../../test/fake/portableMath.ts';

const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const index = v.pipe(v.number(), v.integer(), v.minValue(0));
const glbSchema = v.object({ nodes: v.array(v.object({ name: v.string(), children: v.optional(v.array(index)),
  translation: v.optional(triple), rotation: v.optional(v.tuple([finite, finite, finite, finite])), scale: v.optional(triple) })),
skins: v.array(v.object({ joints: v.array(index) })) });
const physicsSchema = v.object({ kingHit: v.object({ ribs: triple }),
  parked: v.array(v.object({ kind: v.string(), spec: v.unknown() })) });
const kingSpec = v.object({ dims: v.object({ headAt: triple, bodyAt: triple,
  bodyPitch: finite, bodyHalfLen: finite, fore: v.object({ bone: v.literal('chest'), at: triple, halfLen: finite }) }) });
export const KING_COLLISION_INPUTS = [
  'public/assets/pine-hollow/creatures/antler-king-rig.phone.rigged.glb',
  'src/shards/pine-hollow/combat/kingRig.ts', 'src/shards/pine-hollow/data/kingClips.ts', 'src/game/systems/species/limbRig.ts',
  'src/shards/pine-hollow/combat/kingTiming.ts',
  'src/shards/pine-hollow/runtime/physics.baked.json', 'src/shards/pine-hollow/runtime/kingCollision.ts',
  'src/shards/pine-hollow/runtime/kingCollisionBake.ts', 'src/game/combat/collisionPose.ts',
  'src/shards/pine-hollow/generators/bake-pine-king-collision.mjs', 'test/fake/portableMath.ts',
];

/** Real rig joints only; no vertex attributes or runtime renderer are loaded. @param {string} root */
export function readKingRig(root) {
  const bytes = readFileSync(resolve(root, KING_COLLISION_INPUTS[0]));
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid King GLB');
  const length = bytes.readUInt32LE(12);
  if (length > bytes.length - 20) throw new Error('Truncated King GLB');
  const document = v.parse(glbSchema, JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')));
  const skin = document.skins.at(0);
  if (skin === undefined || skin.joints.length === 0) throw new Error('Missing King skin');
  /** @type {Record<string, Bone>} */ const bones = {};
  /** @type {Map<number, Bone>} */ const byIndex = new Map();
  for (const id of skin.joints) {
    const node = document.nodes.at(id);
    if (node === undefined || Object.hasOwn(bones, node.name) || node.rotation?.some((n, i) => n !== (i === 3 ? 1 : 0))
      || node.scale?.some(n => n !== 1)) throw new Error('Incompatible King rest joint');
    const bone = new Bone(); bone.name = node.name;
    const at = node.translation ?? [0, 0, 0]; bone.position.set(at[0], at[1], at[2]);
    bones[node.name] = bone; byIndex.set(id, bone);
  }
  for (const id of skin.joints) {
    const node = document.nodes.at(id), parent = byIndex.get(id);
    if (node === undefined || parent === undefined) throw new Error('Missing King joint');
    for (const child of node.children ?? []) { const bone = byIndex.get(child); if (bone !== undefined) parent.add(bone); }
  }
  const group = new Group(), body = Object.values(bones).find(bone => bone.name === 'body');
  if (body === undefined) throw new Error('Missing King root');
  group.add(body); group.updateMatrixWorld(true);
  const rest = kingRest(bones);
  return { bones, group, rest };
}

/** Deterministic trusted bake. @param {string} root */
export function bakeKingCollision(root) {
  // Recorded matrices pin exact bits; native transcendental functions differ on arm64 and x64.
  // Keep this confined to the build-time oracle, restoring the caller's Math on every exit.
  return withPortableMath(() => bakePortableKingCollision(root));
}

/** @param {string} root */
function bakePortableKingCollision(root) {
  const { bones, group, rest } = readKingRig(root), pose = newPose();
  const names = ['body', 'chest', 'neck', 'head'];
  const selected = names.map(name => {
    const bone = Object.values(bones).find(row => row.name === name);
    if (bone === undefined) throw new Error(`Missing King ${name}`); return bone;
  });
  for (let i = 0; i < selected.length; i++) {
    const bone = selected[i], parent = i === 0 ? group : selected[i - 1];
    if (bone.parent !== parent) throw new Error(`Incompatible King collision chain at ${bone.name}`);
  }
  const physics = v.parse(physicsSchema, JSON.parse(readFileSync(resolve(root, 'src/shards/pine-hollow/runtime/physics.baked.json'), 'utf8')));
  const king = physics.parked.find(row => row.kind === 'antler-king');
  const chest = rest.at.chest;
  if (king === undefined) throw new Error('Missing King volume metadata');
  const { dims } = v.parse(kingSpec, king.spec);
  const inputs = Object.fromEntries(KING_COLLISION_INPUTS.map(path => [path, createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex')]));
  const baked = { version: 1, hz: 60, inputs,
    joints: selected.map((bone, i) => ({ parent: i - 1, position: bone.position.toArray() })),
    rest: { at: Object.fromEntries(Object.entries(rest.at).map(([name, at]) => [name, { x: at.x, y: at.y, z: at.z }])),
      rootPos: { x: rest.rootPos.x, y: rest.rootPos.y, z: rest.rootPos.z }, H: rest.H, walkStride: rest.walkStride, chargeStride: rest.chargeStride },
    volumes: { head: dims.headAt, body: { at: dims.bodyAt, pitch: dims.bodyPitch, halfLength: dims.bodyHalfLen },
      fore: { at: dims.fore.at, halfLength: dims.fore.halfLen },
      ribs: [physics.kingHit.ribs[0] - chest.x, physics.kingHit.ribs[1] - chest.y, physics.kingHit.ribs[2] - chest.z] },
    clips: Object.entries(KING_ATTACK_TIMING).map(([name, timing]) => ({ name, duration: timing.duration,
      frames: Array.from({ length: Math.ceil(timing.duration * 60) + 1 }, (_, tick) => {
        const phase = Math.min(tick / 60 / timing.duration, 1);
        if (name !== 'sweep' && name !== 'strike' && name !== 'roar') throw new Error('Unknown King attack');
        applyKingPose(rest, clipPose(pose, rest, name, phase, tick / 60)); group.updateMatrixWorld(true);
        return { tick, phase, transforms: selected.map(bone => bone.matrixWorld.toArray()) };
      }) })),
  };
  return readKingCollisionBake(baked);
}

if (process.argv[1] === import.meta.filename) {
  const root = resolve(import.meta.dirname, '../../../..');
  const output = resolve(root, 'src/shards/pine-hollow/runtime/kingCollision.baked.json');
  writeFileSync(output, `${JSON.stringify(bakeKingCollision(root))}\n`);
  console.log(`Wrote ${output}`);
}
