import { expect, test } from 'vitest';
import { numericCreaturePose } from '../../../src/game/plugin/channelPrograms';
import { numericChannelPrograms } from '../../../src/sdk/clientChannels';
import { mantisPrecontactClips } from '../../../src/shards/driftwood-isle/generators/mantisPrecontactClips';
import { fixture, locals, poseContext } from '../../../test/mantis-complete-fixture';
import { snapshotSimHost } from '../../../src/engine/sim/snapshot';
const ids = ['strike.splinter-mantis.first', 'strike.splinter-mantis.second'];
const row = () => ({ group: 'creature.pose', strikeIds: ids, programs: numericChannelPrograms('independent-proof', 'creature.pose', [
  { target: 'joint.body', path: ['rotation', 'x'], expr: (_b, r) => r('strike', ['elapsed']) },
  { target: 'joint.body', path: ['rotation', 'y'], expr: (_b, r) => r('strike', ['phase']) },
  { target: 'joint.body', path: ['rotation', 'z'], expr: (_b, r) => r('strike', ['index']) },
]) });
for (const group of [false, true]) test(`${group ? 'group' : 'single'} independently refuses invalid phase/time before writes after rig cache exists`, async () => {
  const f = await fixture(group), animate = numericCreaturePose(row());
  try {
    animate(f.context);
    for (const [key, values] of [['strikeState', ['unknown', 'constructor', '__proto__', undefined]], ['strikeTime', [1e12 + 1, -Infinity, NaN, -.001]]]) {
      const original = Object.getOwnPropertyDescriptor(f.control, key);
      try {
        for (const value of values) {
          const before = locals(f.context), saved = f.control.snapshot(), world = snapshotSimHost(f.host);
          Object.defineProperty(f.control, key, { configurable: true, get: () => value });
          expect(() => animate(f.context)).toThrow();
          expect(locals(f.context)).toEqual(before);
          expect(f.control.snapshot()).toEqual(saved);
          expect(snapshotSimHost(f.host)).toEqual(world);
        }
      } finally { Object.defineProperty(f.control, key, original); }
    }
    const before = f.control.snapshot(), world = snapshotSimHost(f.host), damage = [...f.damage];
    for (let i = 0; i < 100; i++) { f.context.t = i * 37; f.context.dt = .9; animate(f.context); }
    expect(f.control.snapshot()).toEqual(before); expect(snapshotSimHost(f.host)).toEqual(world); expect(f.damage).toEqual(damage);
  } finally { f.host.dispose(); }
});
test('public candidate7 stays an authority-free old pose caller', () => {
  const c = poseContext(), animate = numericCreaturePose(mantisPrecontactClips());
  expect(mantisPrecontactClips().strikeIds).toBeUndefined();
  for (const phase of [0, .2, .5, .9]) for (const deathT of [-1, 0, .5, 1]) {
    Object.assign(c, { phase, deathT, alive: deathT < 0 }); expect(() => animate(c)).not.toThrow();
  }
});
test('independent exact recovery witness still exceeds the unchanged strict motion gate', async () => {
  const { mantisCompleteMotionClips } = await import('../../../src/shards/driftwood-isle/generators/mantisCompleteMotionClips');
  const { motionSourceGate, requireMotionSourceGate } = await import('../mantis-complete-motion-plan/gate.mjs');
  const f = await fixture(), animate = numericCreaturePose(mantisCompleteMotionClips());
  try {
    const saved = JSON.parse(f.control.snapshot());
    const pose = elapsed => {
      f.control.restore(JSON.stringify({ ...saved, strike: { ...saved.strike, phase: 'recover', currentId: ids[0], elapsed } }));
      Object.assign(f.context, { t: 2.5, speed: 0, phase: .2, deathT: -1, alive: true, flinch: 0 });
      animate(f.context); return f.context.bones['raptor-1'].quaternion.clone();
    };
    const delta = pose(3 / 60).angleTo(pose(4 / 60));
    expect(delta).toBeCloseTo(.13444144375857628, 12); expect(delta).toBeGreaterThan(.10);
    const motion = { envelope: { minimum: .003553957620891182, maxStep: delta } };
    const idealStance = { perFoot: Object.fromEntries(['a', 'b', 'c', 'd'].map(id => [id, { footRootRatio: 0, medianFootSpeed: 0 }])) };
    expect(motionSourceGate(motion, idealStance)).toBe(false);
    expect(() => requireMotionSourceGate(motion, idealStance)).toThrow('Rejected Mantis source motion');
  } finally { f.host.dispose(); }
});
