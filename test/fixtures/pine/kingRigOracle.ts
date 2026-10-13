// G350 test oracle: the retired King collision bake. It opens the real committed rig GLB, builds the old three.js Bone /
// Group graph and samples the live kingRig FK at 60 Hz under portable math, so the King tests can prove the authored
// rows (data/kingCollisionRows.json) and the generated table still equal what the rig computes.
// oxlint-disable-next-line import/no-nodejs-modules -- The oracle reads the real committed GLB, never renderer fixtures.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the rig relative to the checkout under test.
import { resolve } from 'node:path';
import * as v from 'valibot';
import { Bone, Group } from 'three';
import { applyKingPose, clipPose, kingRest, newPose, type KingRest } from '../../../src/shards/pine-hollow/combat/kingRig';
import { KING_ATTACK_TIMING } from '../../../src/shards/pine-hollow/combat/kingTiming';
import { readKingCollisionBake } from '../../../src/shards/pine-hollow/runtime/kingCollisionBake';
import physics from '../../../src/shards/pine-hollow/data/physicsRows.json' with { type: 'json' };
import { withPortableMath } from '../../fake/portableMath';

const KING_RIG = 'public/assets/pine-hollow/creatures/antler-king-rig.phone.rigged.glb';
const finite = v.pipe(v.number(), v.finite()), triple = v.tuple([finite, finite, finite]);
const index = v.pipe(v.number(), v.integer(), v.minValue(0));
const glbSchema = v.object({ nodes: v.array(v.object({ name: v.string(), children: v.optional(v.array(index)),
  translation: v.optional(triple), rotation: v.optional(v.tuple([finite, finite, finite, finite])), scale: v.optional(triple) })),
skins: v.array(v.object({ joints: v.array(index) })) });
const kingSpec = v.object({ dims: v.object({ headAt: triple, bodyAt: triple,
  bodyPitch: finite, bodyHalfLen: finite, fore: v.object({ bone: v.literal('chest'), at: triple, halfLen: finite }) }) });

/** Real rig joints only; no vertex attributes or runtime renderer are loaded. */
export function readKingRig(root: string): { bones: Record<string, Bone>; group: Group; rest: KingRest } {
  const bytes = readFileSync(resolve(root, KING_RIG));
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2
    || bytes.readUInt32LE(8) !== bytes.length || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid King GLB');
  const length = bytes.readUInt32LE(12);
  if (length > bytes.length - 20) throw new Error('Truncated King GLB');
  const document = v.parse(glbSchema, JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')));
  const skin = document.skins.at(0);
  if (skin === undefined || skin.joints.length === 0) throw new Error('Missing King skin');
  const bones: Record<string, Bone> = {}, byIndex = new Map<number, Bone>();
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
  return { bones, group, rest: kingRest(bones) };
}

/** The retired bake's table from the live rig, deterministic under portable math (native transcendental functions differ
 * on arm64 and x64); the caller's Math is restored on every exit. */
export function bakeKingCollision(root: string): ReturnType<typeof readKingCollisionBake> {
  return withPortableMath(() => {
    const { bones, group, rest } = readKingRig(root), pose = newPose();
    const selected = ['body', 'chest', 'neck', 'head'].map(name => {
      const bone = bones[name]; if (bone === undefined) throw new Error(`Missing King ${name}`); return bone;
    });
    selected.forEach((bone, i) => { if (bone.parent !== (i === 0 ? group : selected[i - 1])) throw new Error(`Incompatible King collision chain at ${bone.name}`); });
    const king = physics.parked.find(row => row.kind === 'antler-king');
    if (king === undefined) throw new Error('Missing King volume metadata');
    const { dims } = v.parse(kingSpec, king.spec), chest = rest.at['chest'], ribs = v.parse(triple, physics.kingHit.ribs);
    if (chest === undefined) throw new Error('Missing King rest chest');
    return readKingCollisionBake({ version: 1, hz: 60,
      joints: selected.map((bone, i) => ({ parent: i - 1, position: bone.position.toArray() })),
      rest: { at: Object.fromEntries(Object.entries(rest.at).map(([name, at]) => [name, { x: at.x, y: at.y, z: at.z }])),
        rootPos: { x: rest.rootPos.x, y: rest.rootPos.y, z: rest.rootPos.z }, H: rest.H, walkStride: rest.walkStride, chargeStride: rest.chargeStride },
      volumes: { head: dims.headAt, body: { at: dims.bodyAt, pitch: dims.bodyPitch, halfLength: dims.bodyHalfLen },
        fore: { at: dims.fore.at, halfLength: dims.fore.halfLen }, ribs: [ribs[0] - chest.x, ribs[1] - chest.y, ribs[2] - chest.z] },
      clips: Object.entries(KING_ATTACK_TIMING).map(([name, timing]) => ({ name, duration: timing.duration,
        frames: Array.from({ length: Math.ceil(timing.duration * 60) + 1 }, (_, tick) => {
          if (name !== 'sweep' && name !== 'strike' && name !== 'roar') throw new Error('Unknown King attack');
          applyKingPose(rest, clipPose(pose, rest, name, Math.min(tick / 60 / timing.duration, 1), tick / 60)); group.updateMatrixWorld(true);
          return { tick, phase: Math.min(tick / 60 / timing.duration, 1), transforms: selected.map(bone => bone.matrixWorld.toArray()) };
        }) })),
    });
  });
}
