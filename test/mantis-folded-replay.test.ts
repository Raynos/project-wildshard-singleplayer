// oxlint-disable-next-line import/no-nodejs-modules -- Exact recorded geometry/transform replay, no browser or physics injection.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Matrix4, Quaternion, Euler, Vector3 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';

const native = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: v.array(v.number()) })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
const traceSchema = v.array(v.object({ frame: v.number(), alive: v.boolean(), world: v.pipe(v.array(v.number()), v.length(16)),
  bones: v.record(v.string(), v.pipe(v.array(v.number()), v.length(7))) }));
const fixtures = [
  'art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate2/evidence/observer-render-trace.json',
  'art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate3/evidence/observer-render-trace.json',
];

test('anatomy-only folds clear all recorded corpse vertices across both preserved rigid ragdoll trajectories', () => {
  const results = [];
  for (const path of fixtures) {
    const frames = v.parse(traceSchema, JSON.parse(readFileSync(path, 'utf8'))).filter(row => !row.alive);
    let originalMin = Infinity, foldedMin = Infinity, below = 0;
    for (const row of frames) {
      const root = row.bones['body']; if (root === undefined) throw new Error('Missing captured body');
      const bodyEuler = new Euler().setFromQuaternion(new Quaternion().fromArray(root, 3));
      const d = Math.min(1, Math.max(0, bodyEuler.z / .6));
      for (const revised of [false, true]) {
        const posed = new Map<string, Matrix4>(), world = new Matrix4().fromArray(row.world);
        for (const bone of native.bones) {
          const values = row.bones[bone.name]; if (values === undefined) throw new Error('Missing captured joint');
          const q = new Quaternion().fromArray(values, 3), e = new Euler().setFromQuaternion(q);
          if (revised) {
            if (bone.name === 'body') e.z -= .2 * d;
            if (bone.name === 'abdomen') e.x += .2 * d;
            if (bone.name.startsWith('raptor') && bone.name.endsWith('_elbow')) e.x += .4 * d;
            if (bone.name.startsWith('leg') && bone.name.endsWith('_knee')) e.z += (bone.name.includes('-1') ? -1 : 1) * 2 * d * (1 - d);
            q.setFromEuler(e);
          }
          const matrix = new Matrix4().compose(new Vector3().fromArray(values), q, new Vector3(1, 1, 1));
          if (bone.parent !== null) { const parent = posed.get(bone.parent); if (parent === undefined) throw new Error('Missing posed parent'); matrix.premultiply(parent); }
          posed.set(bone.name, matrix);
        }
        for (const part of native.parts) {
          const bone = native.bones.find(def => def.name === part.name), pose = posed.get(part.name);
          if (bone === undefined || pose === undefined) throw new Error('Missing rigid skin part');
          const inverse = new Matrix4().makeTranslation(new Vector3().fromArray(bone.pos)).invert();
          const skin = world.clone().multiply(pose).multiply(inverse), point = new Vector3();
          for (let i = 0; i < part.positions.length; i += 3) {
            point.fromArray(part.positions, i).applyMatrix4(skin); const height = point.y - 900;
            if (revised) { foldedMin = Math.min(foldedMin, height); if (height < -.005) below++; }
            else originalMin = Math.min(originalMin, height);
          }
        }
      }
    }
    expect(originalMin).toBeLessThan(-.12); expect(foldedMin).toBeGreaterThan(.01); expect(below).toBe(0);
    results.push({ path, frames: frames.length, originalMin, foldedMin, below });
  }
  expect(results.reduce((sum, row) => sum + row.frames, 0)).toBe(134);
  mkdirSync('tmp/mantis-native-measurement', { recursive: true });
  writeFileSync('tmp/mantis-native-measurement/folded-replay.json', JSON.stringify({
    scope: 'Replay only, same captured meshWorld and translations, anatomy rotations only. Requires fresh actual collapse/settle capture; no general physical contact acceptance.', results }, null, 2));
});
