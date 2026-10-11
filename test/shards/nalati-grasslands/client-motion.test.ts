import { expect, it } from 'vitest';
import { Rng } from '../../../src/engine/core/rng';
import { createClientChannels } from '../../../src/game/plugin/ui';
import { NALATI_FAR_HERD_CHANNELS } from '../../../src/shards/nalati-grasslands/data/clientMotion';

// The original page drift equations are the independent oracle. Quarter-second cadence, culling and RNG ownership stay native.
it('keeps every private horse scalar and RNG continuation exact over 10k admitted drift/blocked steps', () => {
  const proposal = NALATI_FAR_HERD_CHANNELS[0], acceptance = NALATI_FAR_HERD_CHANNELS[1];
  if (proposal === undefined || acceptance === undefined) throw new Error('Missing declared horse programs');
  const drift = createClientChannels(proposal), commit = createClientChannels(acceptance);
  expect(drift.reads).toEqual(['x', 'z', 'yaw', 'turn', 'speed', 'herdX', 'herdZ', 'radius', 'random']);
  expect(commit.reads).toEqual(['x', 'z', 'yaw', 'nextX', 'nextZ', 'turn', 'blocked']);
  const referenceRng = new Rng(0x4e4d), declaredRng = new Rng(0x4e4d);
  let expected = { x: 10, z: -20, yaw: 100, turn: -0.15 }, actual = { ...expected };
  for (let n = 0; n < 10000; n++) {
    const step = n === 0 ? 1 + 1 / 60 : 0.25 + (n % 7) / 59.94, speed = 0.05 + (n % 19) / 100;
    const herdX = 20, herdZ = -15, radius = 30, blocked = n % 13 === 0;
    const turn = Math.max(-0.2, Math.min(0.2, expected.turn + (referenceRng.next() - 0.5) * 0.08 * step));
    const toC = Math.atan2(herdX - expected.x, herdZ - expected.z), off = Math.hypot(expected.x - herdX, expected.z - herdZ);
    const dy = off > radius * 0.9 ? Math.atan2(Math.sin(toC - expected.yaw), Math.cos(toC - expected.yaw)) * 0.3 : 0;
    let yaw = expected.yaw + (turn + dy) * step;
    const nx = expected.x + Math.sin(yaw) * speed * step, nz = expected.z + Math.cos(yaw) * speed * step;
    if (blocked) yaw += 1.5;
    expected = { x: blocked ? expected.x : nx, z: blocked ? expected.z : nz, yaw, turn };
    drift.evaluate({ time: n * step, delta: step, values: [actual.x, actual.z, actual.yaw, actual.turn, speed, herdX, herdZ, radius, declaredRng.next()] });
    const posed = drift.frame;
    if (posed.x === undefined || posed.z === undefined || posed.yaw === undefined || posed.turn === undefined) throw new Error('Missing proposed visual pose');
    commit.evaluate({ time: n * step, delta: step, values: [actual.x, actual.z, posed.yaw, posed.x, posed.z, posed.turn, Number(blocked)] });
    const frame = commit.frame;
    if (frame.x === undefined || frame.z === undefined || frame.yaw === undefined || frame.turn === undefined) throw new Error('Missing committed visual pose');
    actual = { x: frame.x, z: frame.z, yaw: frame.yaw, turn: frame.turn };
    for (const property of ['x', 'z', 'yaw', 'turn'] as const) expect(Object.is(actual[property], expected[property]), `${n}:${property}`).toBe(true);
  }
  expect(declaredRng.next()).toBe(referenceRng.next());
});
