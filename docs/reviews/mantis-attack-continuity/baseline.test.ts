// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Matrix4 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../../../src/engine/entities/animalRig';
import { numericCreaturePose } from '../../../src/game/plugin/channelPrograms';
import { mantisEarlyKneeClips } from '../../../src/shards/driftwood-isle/generators/mantisEarlyKneeClips';


const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
function rig(): { context: AnimalRigContext; bones: Record<string, Bone> } {
  const bones: Record<string, Bone> = {};
  for (const def of native.bones) {
    const joint = new Bone(); joint.name = def.name; joint.position.fromArray(def.pos);
    if (def.parent !== null) {
      const parent = bones[def.parent], rest = native.bones.find(row => row.name === def.parent);
      if (parent === undefined || rest === undefined) throw new Error('Missing native parent');
      joint.position.sub(new Vector3(...rest.pos)); parent.add(joint);
    }
    bones[def.name] = joint;
  }
  const mem = {}, position = new Vector3();
  return { bones, context: { bones,
    dims: { bodyY: native.bones[0]?.pos[1] ?? 0, bodyHalfLen: 0, bodyRadius: 0, headRadius: 0, legLen: 0, feet: [], halfWidth: 0 },
    dt: 1 / 60, t: 0, seed: .7, scale: 1, speed: 0, strafe: 0, phase: 0, state: 'attack', alive: true,
    deathT: -1, flinch: 0, brace: 0, attack: -1, lookTarget: new Vector3(), lookWeight: 0,
    position, yaw: 0, mem, animal: { mem, position, yOffset: 0 } } };
}
function bone(bones: Record<string, Bone>, name: string): Bone {
  const result = bones[name]; if (result === undefined) throw new Error(`Missing ${name}`); return result;
}

function snapshot(bones: Record<string, Bone>) {
  return Object.fromEntries(Object.entries(bones).map(([name, b]) => [name, [...b.position, ...b.quaternion]]));
}
const animate = numericCreaturePose(mantisEarlyKneeClips());
const reports: Record<string, unknown>[] = [];
test.each([[1, -1], [3, 1]])('stage %s exact native boundary and held active baseline', (stage, side) => {
  const f = rig();
  const pose = (phase: number, clock: number, attack: number) => {
    f.context.attack = attack;
    Object.assign(f.context.mem, { 'mantis-st': stage, 'mantis-pose-phase': phase, 'mantis-pose-clock': clock });
    animate(f.context); return snapshot(f.bones);
  };
  pose(1, stage === 1 ? .6 : .4, .99);
  const before = { shoulder: bone(f.bones, `raptor${side}`).rotation.x, elbow: bone(f.bones, `raptor${side}_elbow`).rotation.x,
    hook: bone(f.bones, `raptor${side}_hook`).rotation.y, body: bone(f.bones, 'body').rotation.x, neck: bone(f.bones, 'neck').rotation.x };
  const stale = pose(1, stage === 1 ? .6 : .4, -1);
  const onset = pose(2, 0, -1);
  const after = { shoulder: bone(f.bones, `raptor${side}`).rotation.x, elbow: bone(f.bones, `raptor${side}_elbow`).rotation.x,
    hook: bone(f.bones, `raptor${side}_hook`).rotation.y, body: bone(f.bones, 'body').rotation.x, neck: bone(f.bones, 'neck').rotation.x };
  expect(after.shoulder - before.shoulder).toBeCloseTo(1.1, 12);
  expect(after.elbow - before.elbow).toBeCloseTo(-1, 12);
  expect(after.body - before.body).toBeCloseTo(.1, 12);
  expect(after.neck - before.neck).toBeCloseTo(.22, 12);
  expect(stale).not.toEqual(onset);
  for (const clock of [.1, .5, 1.7, 60]) expect(pose(2, clock, -1)).toEqual(onset);
  reports.push({ stage, before, after, nativeJump: Object.fromEntries(Object.keys(before).map(key => [key, Reflect.get(after, key) - Reflect.get(before, key)])) });
});
test('native programs fit admission and expose no attack input today', () => {
  const programs = mantisEarlyKneeClips().programs;
  expect(programs.every(p => p.nodes.length <= 128 && p.locals === undefined)).toBe(true);
  expect(programs.flatMap(p => p.numeric?.inputs ?? []).some(i => i.owner === 'frame' && i.path[0] === 'attack')).toBe(false);
  reports.push({ programs: programs.length, maxNodes: Math.max(...programs.map(p => p.nodes.length)) });
  writeFileSync('docs/reviews/mantis-attack-continuity/native-baseline.json', JSON.stringify(reports, null, 2) + '\n');
});
test('exact native transformed blade displacement across source tell/cut boundary', () => {
  const f = rig();
  const vertices = () => {
    bone(f.bones, 'body').updateMatrixWorld(true);
    return native.parts.filter(p => p.name.startsWith('raptor-1')).flatMap(p => {
      const bind = native.bones.find(b => b.name === p.name); if (bind === undefined) throw new Error('Missing bind');
      const transform = bone(f.bones, p.name).matrixWorld.clone().multiply(new Matrix4().makeTranslation(...bind.pos).invert());
      const result: Vector3[] = [];
      for (let i = 0; i < p.positions.length; i += 3) result.push(new Vector3().fromArray(p.positions, i).applyMatrix4(transform));
      return result;
    });
  };
  Object.assign(f.context.mem, { 'mantis-st': 1, 'mantis-pose-phase': 1, 'mantis-pose-clock': .6 });
  animate(f.context); const before = vertices();
  Object.assign(f.context.mem, { 'mantis-pose-phase': 2, 'mantis-pose-clock': 0 });
  animate(f.context); const after = vertices();
  const maxDistance = Math.max(...before.map((v, i) => { const p = after[i]; if (p === undefined) throw new Error('Missing vertex'); return v.distanceTo(p); }));
  expect(maxDistance).toBeGreaterThan(.5);
  reports.push({ scope: 'Same root and frame, all left raptor native vertices, source boundary only', maximumVertexDisplacementMeters: maxDistance });
  writeFileSync('docs/reviews/mantis-attack-continuity/native-baseline.json', JSON.stringify(reports, null, 2) + '\n');
});
