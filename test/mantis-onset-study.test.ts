// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { Bone, Vector3, Matrix4 } from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import type { AnimalRigContext } from '../src/engine/entities/animalRig';
import { numericCreaturePose } from '../src/game/plugin/channelPrograms';
import { mantisFoldedClips } from '../src/shards/driftwood-isle/generators/mantisFoldedClips';
import { mantisOnsetClips } from '../src/shards/driftwood-isle/generators/mantisOnsetClips';

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
test.each([[1, -1], [3, 1]])('stage %s cuts on first observed active at zero and epsilon, and holds without duration offsets', (stage, side) => {
  for (const clock of [0, Number.EPSILON, 1e-6, .05, .1, 3, 60]) {
    const { context, bones } = rig();
    Object.assign(context.mem, { 'mantis-st': stage, 'mantis-pose-phase': 2, 'mantis-pose-clock': clock });
    newAnimate(context);
    expect(bone(bones, `raptor${side}`).rotation.x).toBeCloseTo(.65, 12);
    expect(bone(bones, `raptor${side}_elbow`).rotation.x).toBeCloseTo(-.65, 12);
    expect(bone(bones, `raptor${side}_hook`).rotation.y).toBeCloseTo(-side * .32, 12);
    expect(bone(bones, `raptor${-side}`).rotation.x).toBe(0);
    expect(bone(bones, 'body').rotation.x).toBeCloseTo(.06, 12);
    expect(bone(bones, `wing${side}_0`).rotation.z).toBeCloseTo(0, 12);
    if (clock === 0) {
      oldAnimate(context);
      expect(bone(bones, `raptor${side}`).rotation.x).toBeCloseTo(-.45, 12);
      expect(bone(bones, `raptor${side}_elbow`).rotation.x).toBeCloseTo(.35, 12);
      expect(bone(bones, `raptor${side}_hook`).rotation.y).toBeCloseTo(0, 12);
    }
  }
});
test('non-active living, windup, recovery, gait, flinch, interruption and death remain exact', () => {
  const a = rig(), b = rig();
  for (const stage of [0, 1, 2, 3, 5]) for (const phase of [0, 1, 3]) for (const deathT of [-1, 0, .25, .5, 1]) for (const clock of [0, .01, .12, .45, .75, 1.1, 3]) {
    for (const r of [a, b]) {
      Object.assign(r.context, { t: clock, phase: clock / 3, speed: .8, flinch: .3, deathT, alive: deathT < 0 });
      Object.assign(r.context.mem, { 'mantis-st': stage, 'mantis-pose-phase': phase, 'mantis-pose-clock': clock });
    }
    oldAnimate(a.context); newAnimate(b.context); expect(snapshot(b.bones)).toEqual(snapshot(a.bones));
  }
  for (const stage of [0, 1, 2, 3, 5]) {
    for (const r of [a, b]) { r.context.deathT = 1; r.context.mem['mantis-st'] = stage; r.context.mem['mantis-pose-phase'] = 2; r.context.mem['mantis-pose-clock'] = 0; }
    oldAnimate(a.context); newAnimate(b.context); expect(snapshot(b.bones)).toEqual(snapshot(a.bones));
  }
});
const tracePath = 'art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate4/evidence/observer-render-trace.json';
const trace = v.parse(v.array(v.object({ frame: v.number(), gameTime: v.number(), stage: v.number(), posePhase: v.number(), poseClock: v.number(), speed: v.number(), gait: v.number(), flinch: v.number(), deathT: v.number(), alive: v.boolean(),
  strike: v.object({ phase: v.string(), elapsed: v.number() }), world: v.pipe(v.array(v.number()), v.length(16)), bones: v.record(v.string(), v.pipe(v.array(v.number()), v.length(7))) })), JSON.parse(readFileSync(tracePath, 'utf8')));
function vertices(bones: Record<string, Bone>, world: number[], partPrefix = '') {
  bone(bones, 'body').updateMatrixWorld(true);
  const points: Vector3[] = [], worldMatrix = new Matrix4().fromArray(world);
  for (const part of native.parts) {
    if (!part.name.startsWith(partPrefix)) continue;
    const bind = native.bones.find(row => row.name === part.name); if (bind === undefined) throw new Error('Missing rigid bind');
    const skin = worldMatrix.clone().multiply(bone(bones, part.name).matrixWorld).multiply(new Matrix4().makeTranslation(...bind.pos).invert());
    for (let i = 0; i < part.positions.length; i += 3) points.push(new Vector3().fromArray(part.positions, i).applyMatrix4(skin));
  }
  return points;
}
function maxDistance(a: Vector3[], b: Vector3[]) {
  return Math.max(...a.map((point, i) => { const other = b[i]; if (other === undefined) throw new Error('Missing paired vertex'); return point.distanceTo(other); }));
}
test('replay both exact boundary windows and apply active-only deltas to all 469 captured poses/world transforms', () => {
  const a = rig(), b = rig(), capturedRig = rig(), revisedRig = rig();
  let maxBoundaryBaselineError = 0, maxChangedBaselineError = 0;
  let maxBaselineAt = {}, maxBaselineError = 0, oldMinimum = Infinity, newMinimum = Infinity, deadMinimum = Infinity;
  let oldPrevious: Vector3[] | undefined, newPrevious: Vector3[] | undefined;
  const changedInputMismatches: { frame: number; name: string; component: number; evaluated: number; captured: number; error: number }[] = [];
  const rows = [];
  let previousAngles: { old: number[]; revised: number[] } | undefined;
  const previousBlades = new Map<number, { old: Vector3[]; revised: Vector3[] }>();
  for (const row of trace) {
    for (const r of [a, b]) {
      Object.assign(r.context, { t: row.gameTime, phase: row.gait, speed: row.speed, flinch: row.flinch, deathT: row.deathT, alive: row.alive });
      Object.assign(r.context.mem, { 'mantis-st': row.stage, 'mantis-pose-phase': row.posePhase, 'mantis-pose-clock': row.poseClock });
    }
    oldAnimate(a.context); newAnimate(b.context);
    const changed = row.alive && (row.stage === 1 || row.stage === 3) && row.posePhase === 2 && row.poseClock < .1;
    for (const [name, values] of Object.entries(snapshot(a.bones))) {
      const captured = row.bones[name]; if (captured === undefined) throw new Error('Missing captured bone');
      values.forEach((value, i) => { const error = Math.abs(value - (captured[i] ?? Infinity)); if (row.frame >= 69 && row.frame <= 130) maxBoundaryBaselineError = Math.max(maxBoundaryBaselineError, error); if (changed) { maxChangedBaselineError = Math.max(maxChangedBaselineError, error); if (error > 1e-10) changedInputMismatches.push({ frame: row.frame, name, component: i, evaluated: value, captured: captured[i] ?? Infinity, error }); } if (error > maxBaselineError) { maxBaselineError = error; maxBaselineAt = { frame: row.frame, name, i, value, captured: captured[i], gameTime: row.gameTime }; } });
    }
    // Render trace contains post-hit scalars and interpolated corpse poses that are not always evaluator inputs.
    // Preserve those captured poses exactly outside the changed active term; never invent missing inputs.
    for (const [name, values] of Object.entries(row.bones)) {
      const joint = bone(capturedRig.bones, name); joint.position.fromArray(values); joint.quaternion.fromArray(values, 3);
      const revised = bone(revisedRig.bones, name); revised.position.copy(joint.position); revised.quaternion.copy(joint.quaternion);
      if (changed) {
        const before = bone(a.bones, name), after = bone(b.bones, name);
        expect(row.deathT).toBeLessThan(0);
        const x = Math.min(1, Math.max(0, row.poseClock / .1)), delta = 1 - x * x * (3 - 2 * x);
        const side = name.includes('-1') ? -1 : 1, selected = (row.stage === 1 ? -1 : 1) === side;
        const expectedX = name === 'body' ? .10 : name === 'neck' ? .22 : /^raptor-?1$/u.test(name) && selected ? 1.1 : name.endsWith('_elbow') && selected ? -1 : 0;
        const expectedY = name.endsWith('_hook') && selected ? -side * .32 : 0;
        const expectedZ = name.startsWith('wing') ? -side * .07 : /^raptor-?1$/u.test(name) ? -side * .08 : 0;
        expect(after.rotation.x - before.rotation.x).toBeCloseTo(expectedX * delta, 12);
        expect(after.rotation.y - before.rotation.y).toBeCloseTo(expectedY * delta, 12);
        expect(after.rotation.z - before.rotation.z).toBeCloseTo(expectedZ * delta, 12);
        expect(after.position.toArray()).toEqual(before.position.toArray());
        revised.rotation.set(joint.rotation.x + after.rotation.x - before.rotation.x, joint.rotation.y + after.rotation.y - before.rotation.y, joint.rotation.z + after.rotation.z - before.rotation.z);
      }
    }
    const av = vertices(capturedRig.bones, row.world), bv = changed ? vertices(revisedRig.bones, row.world) : av;
    const oldFloor = Math.min(...av.map(p => p.y - 900)), newFloor = Math.min(...bv.map(p => p.y - 900));
    oldMinimum = Math.min(oldMinimum, oldFloor); newMinimum = Math.min(newMinimum, newFloor);
    if (!row.alive) { deadMinimum = Math.min(deadMinimum, newFloor); expect(snapshot(b.bones)).toEqual(snapshot(a.bones)); }
    if (row.posePhase !== 2 || row.poseClock >= .1) expect(snapshot(b.bones)).toEqual(snapshot(a.bones));
    const revisedBones = changed ? revisedRig.bones : capturedRig.bones;
    const angles = { old: [-1, 1].flatMap(side => ['','_elbow','_hook'].map(suffix => { const joint = bone(capturedRig.bones, `raptor${side}${suffix}`); return suffix === '_hook' ? joint.rotation.y : joint.rotation.x; })),
      revised: [-1, 1].flatMap(side => ['','_elbow','_hook'].map(suffix => { const joint = bone(revisedBones, `raptor${side}${suffix}`); return suffix === '_hook' ? joint.rotation.y : joint.rotation.x; })) };
    const angularJump = previousAngles === undefined ? { old: 0, revised: 0 } : {
      old: Math.max(...angles.old.map((value, i) => Math.abs(value - (previousAngles?.old[i] ?? value)))),
      revised: Math.max(...angles.revised.map((value, i) => Math.abs(value - (previousAngles?.revised[i] ?? value)))) };
    const blades = [-1, 1].map(side => {
      const old = vertices(capturedRig.bones, row.world, `raptor${side}_hook`), revised = vertices(revisedBones, row.world, `raptor${side}_hook`), previous = previousBlades.get(side);
      previousBlades.set(side, { old, revised });
      return { side, oldTravel: previous === undefined ? 0 : maxDistance(old, previous.old), revisedTravel: previous === undefined ? 0 : maxDistance(revised, previous.revised), sameFrameDelta: maxDistance(old, revised) };
    });
    previousAngles = angles;
    rows.push({ frame: row.frame, angles, angularJump, blades, stage: row.stage, actualPhase: row.strike.phase, actualElapsed: row.strike.elapsed, observedPhase: row.posePhase, observedClock: row.poseClock, oldFloor, newFloor,
      sameFrameMaxVertexDelta: maxDistance(av, bv), oldFrameMaxVertexTravel: oldPrevious === undefined ? 0 : maxDistance(av, oldPrevious), newFrameMaxVertexTravel: newPrevious === undefined ? 0 : maxDistance(bv, newPrevious) });
    oldPrevious = av; newPrevious = bv;
  }
  expect(trace.length).toBe(469); expect(maxBoundaryBaselineError).toBeLessThan(1e-10);
  expect(oldMinimum).toBeGreaterThan(0); expect(newMinimum).toBeGreaterThan(0); expect(deadMinimum).toBeGreaterThan(.013);
  const windows = rows.filter(row => (row.frame >= 69 && row.frame <= 99) || (row.frame >= 100 && row.frame <= 130));
  expect(windows.length).toBe(62);
  mkdirSync('tmp/mantis-onset-study', { recursive: true });
  writeFileSync('tmp/mantis-onset-study/replay.json', JSON.stringify({ tracePath, count: trace.length, changedInputMismatches, maxBaselineError, maxBaselineAt, maxBoundaryBaselineError, maxChangedBaselineError, oldMinimum, newMinimum, deadMinimum,
    scope: 'Renderer-free exact-input replay for the two complete attacks (62 frames), plus active-only Euler deltas applied to all 469 captured local poses with exact recorded world matrices. Unchanged transforms retained verbatim. Full-trace scalar recomputation is NOT exact at post-hit and interpolated-corpse frames (errors reported). Not fresh gameplay, visual acceptance, collision proof or continuous-time clearance. Frame travel includes unchanged recorded root motion. One observer tick of latency remains.', windows,
    changedFrames: rows.filter(row => row.sameFrameMaxVertexDelta > 1e-10) }, null, 2));
});
