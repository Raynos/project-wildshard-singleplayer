// oxlint-disable-next-line import/no-nodejs-modules -- Exact oracle comparisons include Float32 signs and buffer bits.
import assert from 'node:assert/strict';
// oxlint-disable-next-line import/no-nodejs-modules -- Fence the frozen production expression bodies, not a rewritten legacy model.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed source-hashed shipping oracle only.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { AnimalPoseLaw, type AnimalPoseRecipe } from '../../src/engine/entities/animalPose';
import { ShippingAnimalPoseOracle } from '../fixtures/animal-pose/shipping';

const finite = v.pipe(v.number(), v.finite());
const rows = v.parse(v.array(v.object({ kind: v.string(), custom: v.boolean(), seed: finite, scale: finite,
  dims: v.object({ bodyY: finite, bodyHalfLen: finite, bodyRadius: finite, headRadius: finite, legLen: finite, halfWidth: finite,
    feet: v.array(v.tuple([finite, finite])), capsuleAxis: v.exactOptional(v.picklist(['y', 'z'])) }) })),
JSON.parse(readFileSync(new URL('../fixtures/animal-pose/actors.json', import.meta.url), 'utf8')));
const bufferFields = ['pose', 'tmp', 'gaitW', 'gaitTarget', 'lastFootPhase', 'footDelta', 'footDeltaT'] as const;
const scalarFields = ['phase', 'lookAmt', 'tiltPitch', 'tiltRoll', 'tiltPitchT', 'poseFrozen'] as const;
const heightAt = (x: number, z: number): number => Math.sin(x * .3) * .2 + Math.cos(z * .5) * .1;
function checkedFrame(actual: AnimalPoseLaw, expected: ShippingAnimalPoseOracle): void {
  const state: unknown = JSON.parse(actual.snapshot()), saved = v.parse(v.record(v.string(), v.unknown()), state);
  for (const field of bufferFields) assert.deepStrictEqual(saved[field], Array.from(new Uint32Array(expected[field].buffer, expected[field].byteOffset, expected[field].length)), field);
  for (const field of scalarFields) assert.deepStrictEqual(actual[field], expected[field], field);
  assert.deepStrictEqual(actual.input, expected.input, 'sampled actor clocks');
}
it('fences the captured shipping source and every frozen expression section', () => {
  const source = v.parse(v.object({ source: v.string(), sha256: v.string(), revision: v.string(), oracleSha256: v.string(),
    sections: v.record(v.string(), v.string()), sectionHashes: v.record(v.string(), v.string()) }),
  JSON.parse(readFileSync(new URL('../fixtures/animal-pose/shipping.json', import.meta.url), 'utf8')));
  expect(source.source).toBe('src/engine/entities/AnimalView.ts'); expect(source.sha256).toMatch(/^[a-f0-9]{64}$/u);
  expect(source.revision).toMatch(/^[a-f0-9]{40}$/u);
  expect(createHash('sha256').update(readFileSync(new URL('../fixtures/animal-pose/shipping.ts', import.meta.url))).digest('hex')).toBe(source.oracleSha256);
  for (const [name, body] of Object.entries(source.sections)) expect(createHash('sha256').update(body).digest('hex')).toBe(source.sectionHashes[name]);
});
for (const row of rows) it(`${row.kind}: 10k exact shipping blends, clocks, terrain and footfalls with an exact restore suffix`, () => {
  const recipe: AnimalPoseRecipe = { dims: row.dims, custom: row.custom, pose: { grazeNeck: .3, gallopTail: .5 } };
  const expected = new ShippingAnimalPoseOracle(recipe), actual = new AnimalPoseLaw(recipe), resumed = new AnimalPoseLaw(recipe);
  const expectedEvents: number[] = [], actualEvents: number[] = [], resumedEvents: number[] = [];
  expected.onFootfall = (_owner, strength) => { expectedEvents.push(strength); };
  actual.onFootfall = strength => { actualEvents.push(strength); }; resumed.onFootfall = strength => { resumedEvents.push(strength); };
  let t = 0, resumeEventAt = 0;
  for (let tick = 0; tick < 10_000; tick++) {
    const cycle = tick % 1000, dt = [1 / 60, 1 / 30, 0, 1 / 20][tick % 4];
    if (dt === undefined) throw new Error('Missing authored scheduler sample'); t += dt;
    const input = { speed: cycle < 200 ? 0 : cycle < 400 ? .4 : cycle < 600 ? 3 : 6, desiredSpeed: 4, strafe: Math.sin(t) * .1,
      scale: row.scale, seed: row.seed, state: cycle < 200 ? 'graze' : 'wander', alive: cycle < 900,
      position: { x: Math.sin(t) * 4, y: 1, z: Math.cos(t) * 8 }, lookTarget: { x: 5, y: 2, z: 8 },
      yaw: Math.sin(t * .2), lookWeight: Math.max(0, Math.sin(t * .3)), attackT: cycle < 30 ? cycle / 60 : -1, attackDur: .6,
      stunT: cycle < 70 ? 1 : 0, deathT: cycle === 0 ? -1 : cycle === 900 ? 0 : expected.input.deathT, deathSide: -1,
      flinch: cycle === 0 ? 1 : expected.input.flinch, brace: cycle === 0 ? 1 : expected.input.brace,
      flinchRoll: .12, flinchPitch: -.08, groundY: 1, levelGround: tick % 33 === 0, flying: tick % 34 === 0,
      advanceAttack: tick % 35 !== 0, debugGait: tick % 500 === 0 ? { gait: 'gallop', phase: .5 } : undefined };
    Object.assign(expected.input, input); Object.assign(actual.input, input);
    if (tick >= 5000) Object.assign(resumed.input, input);
    if (tick % 6 === 0) {
      expected.sampleTerrain(heightAt); actual.sampleTerrain(heightAt); if (tick >= 5000) resumed.sampleTerrain(heightAt);
    }
    const near = tick % 70 < 63; expected.advance(dt, t, near); actual.advance(dt, t, near); checkedFrame(actual, expected);
    if (tick === 4999) {
      const eventsBefore = resumedEvents.length, continuation = actual.snapshot(); resumed.restore(continuation); Object.assign(resumed.input, actual.input);
      assert.equal(resumed.snapshot(), continuation); assert.equal(resumedEvents.length, eventsBefore); resumeEventAt = expectedEvents.length;
    } else if (tick >= 5000) { resumed.advance(dt, t, near); checkedFrame(resumed, expected); }
  }
  assert.deepStrictEqual(actualEvents, expectedEvents); assert.deepStrictEqual(resumedEvents, expectedEvents.slice(resumeEventAt));
});
it('preserves signed-zero bits and refuses malformed or nonfinite history atomically without events', () => {
  const row = rows[0]; if (row === undefined) throw new Error('Missing shipping actor');
  const pose = new AnimalPoseLaw({ dims: row.dims, custom: false }); let events = 0;
  pose.onFootfall = () => { events++; }; pose.pose[0] = -0; pose.tiltPitchT = -0; const saved = pose.snapshot();
  pose.pose[0] = 1; pose.tiltPitchT = 1; pose.restore(saved);
  expect(Object.is(pose.pose[0], -0)).toBe(true); expect(Object.is(pose.tiltPitchT, -0)).toBe(true);
  const invalid = v.parse(v.record(v.string(), v.unknown()), JSON.parse(saved)); invalid['scalars'] = [0x7ff00000, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  expect(() => pose.restore(JSON.stringify(invalid))).toThrow('Invalid animal pose continuation'); expect(pose.snapshot()).toBe(saved);
  invalid['scalars'] = []; expect(() => pose.restore(JSON.stringify(invalid))).toThrow(); expect(pose.snapshot()).toBe(saved);
  expect(events).toBe(0);
});
