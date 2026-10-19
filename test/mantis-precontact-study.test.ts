// oxlint-disable-next-line import/no-nodejs-modules -- Exact native fixture and source-test measurement output.
import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Matrix4 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { mantisEarlyKneeClips } from '../src/shards/driftwood-isle/generators/mantisEarlyKneeClips';
import { mantisPrecontactClips } from '../src/shards/driftwood-isle/generators/mantisPrecontactClips';

const native = v.parse(v.object({ bones: v.array(v.strictObject({ name: v.string(), parent: v.nullable(v.string()),
  pos: v.tuple([v.number(), v.number(), v.number()]) })), parts: v.array(v.object({ name: v.string(), positions: v.array(v.number()), skinIndices: v.array(v.number()), skinWeights: v.array(v.number()) })) }), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/v7-rigid1/mantis-v7-native.json', 'utf8')));
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

const animate = numericCreaturePose(mantisPrecontactClips()), fallback = numericCreaturePose(mantisEarlyKneeClips());
function pose(stage: number, phase: number, clock: number, attack: number, old = false, extra: Partial<AnimalRigContext> = {}) {
  const f = rig(); Object.assign(f.context, extra, { attack });
  Object.assign(f.context.mem, { 'mantis-st': stage, 'mantis-pose-phase': phase, 'mantis-pose-clock': clock });
  (old ? fallback : animate)(f.context); return f;
}
const report: Record<string, unknown> = { acceptance: false, scope: 'Exact native weighted vertices, fixed identity root, source evaluator only; no runtime world/contact claim' };
function weighted(f: ReturnType<typeof rig>, prefix = '') {
  bone(f.bones, 'body').updateMatrixWorld(true);
  const transforms = native.bones.map(b => bone(f.bones, b.name).matrixWorld.clone().multiply(new Matrix4().makeTranslation(...b.pos).invert()));
  return native.parts.filter(p => p.name.startsWith(prefix)).flatMap(p => {
    const result: Vector3[] = [];
    for (let i = 0; i < p.positions.length / 3; i++) {
      const position = new Vector3().fromArray(p.positions, i * 3), value = new Vector3(); let total = 0;
      for (let j = 0; j < 4; j++) {
        const index = p.skinIndices[i * 4 + j], weight = p.skinWeights[i * 4 + j];
        if (index === undefined || weight === undefined || transforms[index] === undefined) throw new Error('Missing skin influence');
        value.addScaledVector(position.clone().applyMatrix4(transforms[index]), weight); total += weight;
      }
      if (Math.abs(total - 1) > 1e-7) throw new Error('Invalid skin weights'); result.push(value);
    }
    return result;
  });
}
function distance(a: Vector3[], b: Vector3[]) { return Math.max(...a.map((p, i) => { const q = b[i]; if (!q) throw new Error('Missing point'); return p.distanceTo(q); })); }
test('strict numeric source admission: bounded DAG, frame attack, no local history or joint feedback', () => {
  const clips = mantisPrecontactClips();
  expect(clips.programs.every(p => p.nodes.length <= 128 && p.locals === undefined)).toBe(true);
  const inputs = clips.programs.flatMap(p => p.numeric?.inputs ?? []);
  expect(inputs.some(i => i.owner === 'frame' && i.path[0] === 'attack')).toBe(true);
  expect(inputs.every(i => i.owner === 'frame' || i.owner === 'scalars')).toBe(true);
  report.admission = { programs: clips.programs.length, maxNodes: Math.max(...clips.programs.map(p => p.nodes.length)) };
});
test.each([[1, -1, .75], [3, 1, .45]])('stage %s continuous keys, stale observer precedence and same-tick active', (stage, side, duration) => {
  for (const phase of [0, 1, 2, 3]) for (const clock of [0, .1, 1.5]) {
    for (const [attack, shoulder, elbow] of [[0, 0, 0], [.3, -.45, .35], [.45, -.45, .35], [.95, .65, -.65], [1, .65, -.65]]) {
      if (attack === undefined || shoulder === undefined || elbow === undefined) throw new Error('Missing key');
      const f = pose(stage, phase, clock, attack);
      expect(bone(f.bones, `raptor${side}`).rotation.x).toBeCloseTo(shoulder, 12);
      expect(bone(f.bones, `raptor${side}_elbow`).rotation.x).toBeCloseTo(elbow, 12);
    }
  }
  const endpoint = snapshot(pose(stage, 1, duration, 1).bones);
  expect(snapshot(pose(stage, 1, duration - .1, -1).bones)).toEqual(endpoint);
  expect(snapshot(pose(stage, 2, 0, -1).bones)).toEqual(endpoint);
  expect(snapshot(pose(stage, 3, 0, -1).bones)).toEqual(endpoint);
  for (const clock of [.1, .6, 2, 50]) expect(snapshot(pose(stage, 2, clock, -1).bones)).toEqual(endpoint);
  expect(snapshot(pose(stage, 3, stage === 1 ? .12 : 1.1, -1).bones)).toEqual(snapshot(pose(stage, 0, 0, -1).bones));
  for (const key of [0, .3, .45, .95, 1]) {
    const a = pose(stage, 1, 0, Math.max(0, key - 1e-7)), b = pose(stage, 1, 0, Math.min(1, key + 1e-7));
    expect(distance(weighted(a), weighted(b))).toBeLessThan(1e-5);
  }
});
test('first recovery to second windup and stage 0/2/5 cannot leak stale attack', () => {
  const f = pose(1, 3, .12, -1); // Reuse the fixture to expose accidental history.
  Object.assign(f.context.mem, { 'mantis-st': 3 }); f.context.attack = 0; animate(f.context);
  expect(snapshot(f.bones)).toEqual(snapshot(pose(3, 0, 0, 0).bones));
  f.context.attack = .7; animate(f.context);
  expect(snapshot(f.bones)).toEqual(snapshot(pose(3, 1, 0, .7).bones));
  expect(bone(f.bones, 'raptor-1').rotation.x).toBe(0);
  for (const stage of [0, 2, 5]) for (const phase of [0, 1, 2, 3]) for (const attack of [-1, 0, .7, 1])
    expect(snapshot(pose(stage, phase, .1, attack).bones)).toEqual(snapshot(pose(stage, 0, 0, -1).bones));
});
test('lower-body living gait and accelerated death are candidate6-exact', () => {
  let cases = 0;
  for (const stage of [0, 1, 2, 3, 5]) for (const phase of [0, 1, 2, 3]) for (const attack of [-1, 0, .3, .7, 1])
    for (const deathT of [-1, 0, .05, .2, .4, .7, 1]) {
      const extra = { t: .23, speed: .8, phase: .37, deathT, alive: deathT < 0, flinch: .25 };
      const a = snapshot(pose(stage, phase, .1, attack, true, extra).bones), b = snapshot(pose(stage, phase, .1, attack, false, extra).bones);
      for (const name of Object.keys(a)) if (name.startsWith('leg') || stage === 5 || deathT === 1) expect(b[name]).toEqual(a[name]);
      cases++;
    }
  // Nonattack gait keeps root and every other joint exact, including idle breathing.
  for (const gait of [0, .1, .3, .7, 1]) expect(snapshot(pose(0, 0, 0, -1, false, { phase: gait, speed: .8 }).bones)).toEqual(snapshot(pose(0, 0, 0, -1, true, { phase: gait, speed: .8 }).bones));
  report.parityCases = cases;
}, 30000);
test.each([[1, -1, .75], [3, 1, .45]])('stage %s weighted native blade travel, boundary continuity and local contact', (stage, side, duration) => {
  const prefix = `raptor${side}`;
  const baselineJump = distance(weighted(pose(stage, 1, duration, .99, true), prefix), weighted(pose(stage, 2, 0, -1, true), prefix));
  const endpointJump = distance(weighted(pose(stage, 1, duration, 1), prefix), weighted(pose(stage, 1, duration, -1), prefix));
  const travel = distance(weighted(pose(stage, 1, 0, .45), prefix), weighted(pose(stage, 1, 0, .95), prefix));
  let minBladeY = Infinity, minAllY = Infinity, maxVertexStep = 0, maxShoulderStep = 0;
  for (let offset = 0; offset < 10; offset++) {
    let previous: Vector3[] | undefined, previousShoulder: number | undefined;
    for (let t = offset / 300; t <= duration + .1; t += 1 / 30) {
      const f = pose(stage, 1, Math.floor(t * 10) / 10, t < duration ? t / duration : -1);
      const points = weighted(f, prefix), shoulder = bone(f.bones, prefix).rotation.x;
      minBladeY = Math.min(minBladeY, ...points.map(p => p.y)); minAllY = Math.min(minAllY, ...weighted(f).map(p => p.y));
      if (previous) maxVertexStep = Math.max(maxVertexStep, distance(previous, points));
      if (previousShoulder !== undefined) maxShoulderStep = Math.max(maxShoulderStep, Math.abs(previousShoulder - shoulder));
      previous = points; previousShoulder = shoulder;
    }
  }
  expect(baselineJump).toBeGreaterThan(.5); expect(endpointJump).toBe(0); expect(travel).toBeGreaterThan(.5);
  expect(maxShoulderStep).toBeLessThan(.25); expect(maxVertexStep).toBeLessThan(baselineJump * .4);
  expect(minBladeY).toBeGreaterThan(0); expect(minAllY).toBeGreaterThan(0);
  report[`strike${stage}`] = { duration, baselineJump, endpointJump, travel, maxVertexStep, maxShoulderStep, minBladeY, minAllY, samplesHz: 30, offsetSamples: 10, contactAcceptance: false };
  writeFileSync('docs/reviews/mantis-precontact-source/results.json', `${JSON.stringify(report, null, 2)}\n`);
});

test('unchanged lower-body, head, abdomen DAGs remain byte-exact after program identity normalization', () => {
  const before = mantisEarlyKneeClips(), after = mantisPrecontactClips();
  expect(after.scalars).toEqual(before.scalars); expect(after.states).toEqual(before.states);
  let exact = 0;
  for (let i = 0; i < before.programs.length; i++) {
    const a = before.programs[i], b = after.programs[i]; if (!a || !b) throw new Error('Missing channel');
    const target = a.numeric?.outputs[0]?.target ?? '';
    if (target.startsWith('joint.leg') || target === 'joint.head' || target === 'joint.abdomen') {
      expect(JSON.stringify(b).replaceAll('motion7.', 'motion6.')).toBe(JSON.stringify(a)); exact++;
    }
  }
  expect(exact).toBe(14);
});
