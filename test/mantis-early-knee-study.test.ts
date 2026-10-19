// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Matrix4, Box3, Quaternion } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { mantisFoldedClips } from '../src/shards/driftwood-isle/generators/mantisFoldedClips';
import { mantisOnsetClips } from '../src/shards/driftwood-isle/generators/mantisOnsetClips';
import { mantisEarlyKneeClips } from '../src/shards/driftwood-isle/generators/mantisEarlyKneeClips';

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
const oldAnimate = numericCreaturePose(mantisFoldedClips()), newAnimate = numericCreaturePose(mantisOnsetClips());


const candidateAnimate = numericCreaturePose(mantisEarlyKneeClips());
const rowSchema = v.object({ boutTime: v.optional(v.number()), frame: v.number(), gameTime: v.number(), stage: v.number(), posePhase: v.number(), poseClock: v.number(), speed: v.number(), gait: v.number(), flinch: v.number(), deathT: v.number(), alive: v.boolean(), yaw: v.optional(v.number()), world: v.array(v.number()), bones: v.record(v.string(), v.array(v.number())) });
type Row = v.InferOutput<typeof rowSchema>;
const traces = [4, 5].map(candidate => ({ candidate, rows: v.parse(v.array(rowSchema), JSON.parse(readFileSync(`art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate${candidate}/evidence/observer-render-trace.json`, 'utf8'))) }));
function evaluate(row: Row, animate = newAnimate, overrides: Partial<AnimalRigContext> = {}) {
  const fixture = rig();
  Object.assign(fixture.context, { t: row.boutTime ?? 0, speed: row.speed, phase: row.gait, flinch: row.flinch, deathT: row.deathT, alive: row.alive, yaw: row.yaw ?? 0 }, overrides);
  Object.assign(fixture.context.mem, { 'mantis-st': row.stage, 'mantis-pose-phase': row.posePhase, 'mantis-pose-clock': row.poseClock });
  animate(fixture.context); return fixture;
}
function fromSnapshot(values: Record<string, number[]>) {
  const result = rig(); for (const [name, data] of Object.entries(values)) { const joint = bone(result.bones, name); joint.position.fromArray(data); joint.quaternion.fromArray(data, 3); } return result;
}
function error(a: Record<string, number[]>, b: Record<string, number[]>) {
  return Math.max(...Object.entries(a).flatMap(([key, values]) => values.map((value, i) => Math.abs(value - (b[key]?.[i] ?? Infinity)))));
}
function parts(bones: Record<string, Bone>, world: number[]) {
  bone(bones, 'body').updateMatrixWorld(true); const worldMatrix = new Matrix4().fromArray(world);
  return native.parts.map(part => {
    const bind = native.bones.find(row => row.name === part.name); if (bind === undefined) throw new Error('Missing bind');
    const skin = worldMatrix.clone().multiply(bone(bones, part.name).matrixWorld).multiply(new Matrix4().makeTranslation(...bind.pos).invert());
    const points: Vector3[] = []; for (let i = 0; i < part.positions.length; i += 3) points.push(new Vector3().fromArray(part.positions, i).applyMatrix4(skin));
    return { name: part.name, points, box: new Box3().setFromPoints(points), minimum: Math.min(...points.map(p => p.y - 900)), below: points.filter(p => p.y < 900).length };
  });
}
const knee = (name: string) => name.startsWith('leg') && name.endsWith('_knee');
const compact = (values: ReturnType<typeof parts>) => values.map(({ name, minimum, below }) => ({ name, minimum, below })).sort((a, b) => a.minimum - b.minimum);
const report: Record<string, unknown> = { curve: 'K=smoothstep(clamp(2.5*deathT)); side*(.38*K+2*K*(1-K)); live gait uses unchanged D', acceptance: false };
function triangleHit(a: Vector3[], b: Vector3[]) {
  const a0 = a[0], a1 = a[1], a2 = a[2], b0 = b[0], b1 = b[1], b2 = b[2];
  if (!a0 || !a1 || !a2 || !b0 || !b1 || !b2) throw new Error('Incomplete triangle');
  const ae = [a1.clone().sub(a0), a2.clone().sub(a1), a0.clone().sub(a2)], be = [b1.clone().sub(b0), b2.clone().sub(b1), b0.clone().sub(b2)];
  const an = a1.clone().sub(a0).cross(a2.clone().sub(a0)), bn = b1.clone().sub(b0).cross(b2.clone().sub(b0));
  const axes = [an, bn, ...ae.flatMap(x => be.map(y => x.clone().cross(y))), ...ae.map(x => an.clone().cross(x)), ...be.map(x => bn.clone().cross(x))];
  for (const axis of axes) {
    if (axis.lengthSq() < 1e-20) continue; axis.normalize();
    const ap = a.map(p => p.dot(axis)), bp = b.map(p => p.dot(axis));
    if (Math.max(...ap) < Math.min(...bp) - 1e-9 || Math.max(...bp) < Math.min(...ap) - 1e-9) return false;
  }
  return true;
}
const intersectionCache = new Map<string, string[]>();
function otherLegIntersections(bones: Record<string, Bone>) {
  const key = JSON.stringify(snapshot(bones)); const cached = intersectionCache.get(key); if (cached) return cached;
  const limbs = parts(bones, new Matrix4().toArray()).filter(p => p.name.startsWith('leg'));
  const intersections: string[] = [];
  for (let i = 0; i < limbs.length; i++) for (let j = i + 1; j < limbs.length; j++) {
    const a = limbs[i], b = limbs[j]; if (!a || !b) throw new Error('Missing limb');
    if (a.name.replace('_knee', '') === b.name.replace('_knee', '') || !a.box.intersectsBox(b.box)) continue;
    let hit = false;
    for (let x = 0; x < a.points.length && !hit; x += 3) for (let y = 0; y < b.points.length && !hit; y += 3) {
      const ta = a.points.slice(x, x + 3), tb = b.points.slice(y, y + 3);
      if (new Box3().setFromPoints(ta).intersectsBox(new Box3().setFromPoints(tb)) && triangleHit(ta, tb)) hit = true;
    }
    if (hit) intersections.push(`${a.name}:${b.name}`);
  }
  intersectionCache.set(key, intersections); return intersections;
}
test('reproduce exact failed baseline before evaluating the selected curve', () => {
  const row = traces[1]?.rows[385]; if (!row) throw new Error('Missing failure');
  const before = evaluate(row), old = evaluate(row, oldAnimate), after = evaluate(row, candidateAnimate);
  expect(error(snapshot(before.bones), row.bones)).toBe(0);
  expect(error(snapshot(before.bones), snapshot(old.bones))).toBe(0);
  const baseline = compact(parts(before.bones, row.world)), candidate = compact(parts(after.bones, row.world));
  expect(baseline[0]?.minimum).toBeCloseTo(-.10222949073886411, 12);
  expect(candidate[0]?.minimum).toBeGreaterThan(0);
  report.failedPose = { frame: row.frame, boutTime: row.boutTime, deathT: row.deathT, flinch: row.flinch, baseline, candidate, baselineKnee: bone(before.bones, 'leg-1_1_knee').rotation.z, candidateKnee: bone(after.bones, 'leg-1_1_knee').rotation.z };
  const lethal = traces[1]?.rows[384], previous = traces[1]?.rows[383]; if (!lethal || !previous) throw new Error('Missing lethal');
  report.lethalCurrentInputError = error(snapshot(evaluate(lethal).bones), lethal.bones);
  expect(error(snapshot(evaluate(lethal, newAnimate, { flinch: previous.flinch }).bones), lethal.bones)).toBe(0);
});
test('all unrelated channels, living and final endpoints and candidate5 active onset remain exactly unchanged', () => {
  const row = traces[1]?.rows[385]; if (!row) throw new Error('Missing fixture');
  let count = 0;
  for (const deathT of [-1, 0, .000001, .05, .11, .2, .35, .4, .7, 1, 2]) for (const stage of [0, 1, 3, 5]) for (const phase of [0, 1, 2, 3]) for (const speed of [0, .8]) {
    const input = { ...row, stage, posePhase: phase, poseClock: .01, speed, deathT, alive: deathT < 0 };
    const a = snapshot(evaluate(input).bones), b = snapshot(evaluate(input, candidateAnimate).bones);
    for (const [name, value] of Object.entries(a)) {
      if (!knee(name) || deathT <= 0 || deathT >= 1) expect(b[name]).toEqual(value);
      else expect(b[name]?.slice(0, 3)).toEqual(value.slice(0, 3));
    }
    count++;
  }
  report.parityCases = count;
});
test('all captured orientations and both death neighborhoods use exact knee inputs; unmatched full inputs stay explicit', () => {
  const results = [];
  for (const trace of traces) {
    const measurements = []; let previous: { before: Record<string, Bone>; after: Record<string, Bone>; frame: number } | undefined;
    for (const row of trace.rows) {
      const baseline = evaluate(row), candidate = evaluate(row, candidateAnimate);
      const kneeError = error(Object.fromEntries(Object.entries(snapshot(baseline.bones)).filter(([name]) => knee(name))), row.bones);
      const before = fromSnapshot(row.bones), after = fromSnapshot(row.bones);
      const valid = kneeError < 1e-12;
      if (valid) for (const [name, joint] of Object.entries(candidate.bones)) if (knee(name)) bone(after.bones, name).quaternion.copy(joint.quaternion);
      const baseParts = compact(parts(before.bones, row.world)), nextParts = compact(parts(after.bones, row.world));
      const baseIntersections = otherLegIntersections(before.bones), nextIntersections = otherLegIntersections(after.bones);
      let baselineJump = 0, candidateJump = 0;
      if (previous) for (const name of Object.keys(before.bones).filter(knee)) {
        baselineJump = Math.max(baselineJump, bone(before.bones, name).quaternion.angleTo(bone(previous.before, name).quaternion));
        candidateJump = Math.max(candidateJump, bone(after.bones, name).quaternion.angleTo(bone(previous.after, name).quaternion));
      }
      measurements.push({ frame: row.frame, deathT: row.deathT, validKneeInputs: valid, kneeError,
        fullReplayError: row.boutTime === undefined ? null : error(snapshot(baseline.bones), row.bones),
        baselineMinimum: baseParts[0], candidateMinimum: nextParts[0],
        baselineJump, candidateJump, baselineIntersections: baseIntersections, candidateIntersections: nextIntersections,
        introducedIntersections: nextIntersections.filter(pair => !baseIntersections.includes(pair)),
        ...(row.deathT >= 0 && row.deathT < 1 ? { baselineParts: baseParts, candidateParts: nextParts } : {}) });
      previous = { before: before.bones, after: after.bones, frame: row.frame };
    }
    results.push({ candidate: trace.candidate, rows: measurements.length, validKneeInputs: measurements.filter(m => m.validKneeInputs).length,
      unmatchedKneeFrames: measurements.filter(m => !m.validKneeInputs).map(m => m.frame),
      minimum: Math.min(...measurements.filter(m => m.validKneeInputs).map(m => m.candidateMinimum?.minimum ?? Infinity)),
      introducedIntersectionFrames: measurements.filter(m => m.introducedIntersections.length > 0).map(m => m.frame),
      maxBaselineJump: Math.max(...measurements.map(m => m.baselineJump)), maxCandidateJump: Math.max(...measurements.map(m => m.candidateJump)), measurements });
  }
  expect(results.every(result => result.minimum >= 0 && result.introducedIntersectionFrames.length === 0)).toBe(true);
  report.traces = results;
  writeFileSync('docs/reviews/mantis-early-knee/results.json', `${JSON.stringify(report, null, 2)}\n`);
}, 120000);
test('dense local curve has continuous endpoint velocity and unchanged angular range; structural only', () => {
  const row = traces[1]?.rows[385]; if (!row) throw new Error('Missing fixture');
  const curve = []; let previous = 0, maxStep = 0, maxAngle = 0;
  for (let i = 0; i <= 1000; i++) {
    const deathT = i / 1000, fixture = evaluate({ ...row, deathT, speed: 0 }, candidateAnimate);
    const angle = bone(fixture.bones, 'leg1_0_knee').rotation.z;
    maxAngle = Math.max(maxAngle, angle); if (i > 0) maxStep = Math.max(maxStep, Math.abs(angle - previous)); previous = angle;
    if (i % 10 === 0) curve.push({ deathT, angle, otherLegIntersections: otherLegIntersections(fixture.bones) });
  }
  expect(maxAngle).toBeLessThanOrEqual(.70805); expect(maxStep).toBeLessThan(.01);
  report.denseCurve = { maxAngle, maxStepPerNormalizedMillisecond: maxStep, curve, limitation: 'Local structure only; no root interpolation or continuous physics/contact assertion. Surface triangle intersections detect crossing, not solid containment.' };
  writeFileSync('docs/reviews/mantis-early-knee/results.json', `${JSON.stringify(report, null, 2)}\n`);
}, 120000);
test('interpolated captured death neighborhoods are labeled geometric diagnostics, not runtime clearance', () => {
  const summaries = [];
  for (const trace of traces) {
    const early = trace.rows.filter(row => row.deathT >= 0 && row.deathT <= 1);
    const measurements = [];
    for (let i = 1; i < early.length; i++) {
      const start = early[i - 1], end = early[i]; if (!start || !end || start.deathT === 1 || end.deathT <= start.deathT) continue;
      for (let step = 0; step <= 20; step++) {
        const alpha = step / 20, input = { ...start, deathT: start.deathT + (end.deathT - start.deathT) * alpha,
          speed: start.speed + (end.speed - start.speed) * alpha, gait: start.gait + (end.gait - start.gait) * alpha };
        const before = fromSnapshot(start.bones), after = fromSnapshot(start.bones);
        for (const name of Object.keys(before.bones)) {
          const values = end.bones[name]; if (!values) throw new Error('Missing endpoint');
          for (const fixture of [before, after]) { const joint = bone(fixture.bones, name); joint.position.lerp(new Vector3().fromArray(values), alpha); joint.quaternion.slerp(new Quaternion().fromArray(values, 3), alpha); }
        }
        const oldKnees = evaluate(input), newKnees = evaluate(input, candidateAnimate);
        for (const name of Object.keys(before.bones).filter(knee)) { bone(before.bones, name).quaternion.copy(bone(oldKnees.bones, name).quaternion); bone(after.bones, name).quaternion.copy(bone(newKnees.bones, name).quaternion); }
        const ap = new Vector3(), aq = new Quaternion(), as = new Vector3(), bp = new Vector3(), bq = new Quaternion(), bs = new Vector3();
        new Matrix4().fromArray(start.world).decompose(ap, aq, as); new Matrix4().fromArray(end.world).decompose(bp, bq, bs);
        const world = new Matrix4().compose(ap.lerp(bp, alpha), aq.slerp(bq, alpha), as.lerp(bs, alpha)).toArray();
        const baseline = compact(parts(before.bones, world))[0], candidate = compact(parts(after.bones, world))[0];
        const oldIntersections = otherLegIntersections(before.bones), newIntersections = otherLegIntersections(after.bones);
        measurements.push({ from: start.frame, to: end.frame, alpha, deathT: input.deathT, baseline, candidate,
          introducedIntersections: newIntersections.filter(pair => !oldIntersections.includes(pair)) });
      }
    }
    summaries.push({ candidate: trace.candidate, minimum: Math.min(...measurements.map(m => m.candidate?.minimum ?? Infinity)),
      introducedIntersectionSamples: measurements.filter(m => m.introducedIntersections.length > 0).length, measurements });
  }
  report.interpolatedNeighborhoods = { warning: 'Synthetic linear positions/scales and quaternion slerp between nonuniform capture samples. Other joint poses are interpolated, not replayed; knee curves alone use actual numericCreaturePose. Neither this path nor scalar timing between samples is a measured simulation trajectory. No continuous runtime acceptance.', summaries };
  writeFileSync('docs/reviews/mantis-early-knee/results.json', `${JSON.stringify(report, null, 2)}\n`);
}, 120000);
test('compiled source DAGs change exactly four knee rotation outputs', () => {
  const before = mantisOnsetClips(), after = mantisEarlyKneeClips();
  expect(after.scalars).toEqual(before.scalars); expect(after.states).toEqual(before.states); expect(after.group).toBe(before.group);
  const changed = [];
  expect(after.programs.length).toBe(before.programs.length);
  for (let i = 0; i < before.programs.length; i++) {
    const original = before.programs[i], candidate = after.programs[i]; if (!original || !candidate) throw new Error('Missing program');
    const normalized = JSON.stringify(candidate).replaceAll('motion6.', 'motion5.');
    if (JSON.stringify(original) !== normalized) {
      const outputs = candidate.numeric?.outputs; expect(outputs).toHaveLength(1);
      expect(outputs?.[0]?.target).toMatch(/^joint\.leg-?1\.[01]\.knee$/u);
      expect(outputs?.[0]?.path).toEqual(['rotation', 'z']); changed.push(outputs?.[0]?.target);
    }
  }
  expect(changed).toHaveLength(4);
});
