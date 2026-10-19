// oxlint-disable-next-line import/no-nodejs-modules -- Exact authored rig fixture, no renderer or browser.
import { readFileSync, writeFileSync } from 'node:fs';
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

const rows = v.parse(v.array(v.object({ boutTime: v.number(), frame: v.number(), gameTime: v.number(), stage: v.number(), posePhase: v.number(), poseClock: v.number(), speed: v.number(), gait: v.number(), flinch: v.number(), deathT: v.number(), alive: v.boolean(), yaw: v.number(), world: v.array(v.number()), bones: v.record(v.string(), v.array(v.number())) })), JSON.parse(readFileSync('art/driftwood-isle/lowpoly-mantis/runtime-admission/arena-candidate5/evidence/observer-render-trace.json', 'utf8')));
const report: Record<string, unknown> = {};
function evaluate(index: number, animate = newAnimate, overrides: Partial<AnimalRigContext> = {}) {
  const r = rows[index], fixture = rig(); if (r === undefined) throw new Error('Missing frame');
  Object.assign(fixture.context, { t: r.boutTime, dt: index ? r.boutTime - (rows[index - 1]?.boutTime ?? r.boutTime) : 0,
    speed: r.speed, phase: r.gait, flinch: r.flinch, deathT: r.deathT, alive: r.alive, yaw: r.yaw }, overrides);
  Object.assign(fixture.context.mem, { 'mantis-st': r.stage, 'mantis-pose-phase': r.posePhase, 'mantis-pose-clock': r.poseClock });
  animate(fixture.context); return fixture;
}
function contact(bones: Record<string, Bone>, world: number[]) {
  bone(bones, 'body').updateMatrixWorld(true);
  const worldMatrix = new Matrix4().fromArray(world), parts = [];
  for (const part of native.parts) {
    const bind = native.bones.find(row => row.name === part.name); if (bind === undefined) throw new Error('Missing bind');
    const skin = worldMatrix.clone().multiply(bone(bones, part.name).matrixWorld).multiply(new Matrix4().makeTranslation(...bind.pos).invert());
    let minimum = Infinity, below = 0;
    for (let i = 0; i < part.positions.length; i += 3) {
      const height = new Vector3().fromArray(part.positions, i).applyMatrix4(skin).y - 900;
      minimum = Math.min(minimum, height); if (height < 0) below++;
    }
    parts.push({ name: part.name, minimum, below });
  }
  return parts.sort((a, b) => a.minimum - b.minimum);
}
function error(a: Record<string, number[]>, b: Record<string, number[]>) {
  return Math.max(...Object.entries(a).flatMap(([key, values]) => values.map((value, i) => Math.abs(value - (b[key]?.[i] ?? Infinity)))));
}
test('identical captured inputs reproduce early death for both native evaluators', () => {
  const r = rows[385], old = evaluate(385, oldAnimate), fresh = evaluate(385); if (r === undefined) throw new Error('Missing failed frame');
  report.identity = { traceIndex: 385, frame: r.frame, boutTime: r.boutTime, gameTime: r.gameTime, deathT: r.deathT, flinch: r.flinch };
  report.candidate4vs5 = error(snapshot(old.bones), snapshot(fresh.bones));
  report.capturedError = error(snapshot(fresh.bones), r.bones);
  expect(report.candidate4vs5).toBe(0); expect(report.capturedError).toBeLessThan(1e-14);
  report.parts = contact(fresh.bones, r.world);
  report.wrongGameTimeError = error(snapshot(evaluate(385, newAnimate, { t: r.gameTime }).bones), r.bones);
  report.noFlinch = contact(evaluate(385, newAnimate, { flinch: 0 }).bones, r.world)[0];
  report.noDeath = contact(evaluate(385, newAnimate, { deathT: 0 }).bones, r.world)[0];
  const noRotation = new Matrix4().fromArray(r.world); noRotation.makeTranslation(r.world[12], r.world[13], r.world[14]);
  report.uprightRootSameTranslation = contact(fresh.bones, noRotation.toArray())[0];
  const next = evaluate(386), knee = 'leg-1_1_knee';
  report.kneeAngles = { current: bone(fresh.bones, knee).rotation.z, next: bone(next.bones, knee).rotation.z };
  bone(fresh.bones, knee).quaternion.copy(bone(next.bones, knee).quaternion);
  report.onlyNextKneeAtFailedWorld = contact(fresh.bones, r.world)[0];
  report.lethalFrameWithPreviousFlinchError = error(snapshot(evaluate(384, newAnimate, { flinch: rows[383]?.flinch ?? 0 }).bones), rows[384]?.bones ?? {});
  report.neighbors = [383, 384, 385, 386, 387, 394].map(index => {
    const f = evaluate(index), captured = rows[index]; if (captured === undefined) throw new Error('Missing neighbor'); return { index, frame: captured.frame, scalarReplayError: error(snapshot(f.bones), captured.bones), minimum: contact(f.bones, captured.world)[0] };
  });
  writeFileSync('docs/reviews/mantis-death-contact/evaluator-results.json', JSON.stringify(report, null, 2) + '\n');
});
