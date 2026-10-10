// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual browser init function in isolated page globals.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { GameClock } from '../../../src/engine/core/clock';
import { installNalatiPhysicsCapture } from '../../../src/shards/nalati-grasslands/generators/physicsCapture.mjs';

function page() {
  const queue: ((time: number) => void)[] = [];
  const horse = { entityId: 'creature:21', position: { x: 10, y: 2, z: 11 }, yaw: -2.498531545425934,
    mem: { _graze: 0.0004400006294250488, custom: 1.000000000000001 } };
  const globals = { __wildshardHarness: { seed: 0, capture: 0 }, __nalatiSpawns: new Map<string, unknown>(),
    __wildshard: { world: { animals: { animals: [horse] } } },
    requestAnimationFrame: (onFrame: (time: number) => void): number => queue.push(onFrame) };
  runInNewContext(`(${installNalatiPhysicsCapture.toString()})()`, { window: globals });
  return { globals, horse, frame(time: number): void { const next = queue.shift(); if (next === undefined) throw new Error('Missing capture frame'); next(time); } };
}

it('pins bootstrap to the fixed boot capture clock independent of the first RAF interval', () => {
  const deltas = [0.0000999999, 0.0001000001, 0.017, 0.1].map(liveDelta => {
    const p = page(), clock = new GameClock(); clock.setCapture(p.globals.__wildshardHarness.capture);
    expect(p.globals.__wildshardHarness.seed).toBe(0x4a1a);
    return clock.tick(liveDelta);
  });
  expect(deltas).toEqual([0.0001, 0.0001, 0.0001, 0.0001]);
});

it('observes first sight before the next updater and retains every exact actor field', () => {
  const p = page();
  p.globals.requestAnimationFrame(() => { p.horse.mem._graze = 2; p.horse.yaw = 3; p.horse.position.x = 99; });
  p.frame(0.123456789);
  expect(p.globals.__nalatiSpawns.get('creature:21')).toEqual({ id: 'creature:21', at: [10, 2, 11],
    yaw: -2.498531545425934, mem: { _graze: 0.0004400006294250488, custom: 1.000000000000001 } });
  p.globals.requestAnimationFrame(() => undefined); p.frame(98765.4321);
  expect(p.globals.__nalatiSpawns.size).toBe(1);
  expect(p.globals.__nalatiSpawns.get('creature:21')).toMatchObject({ yaw: -2.498531545425934, mem: { _graze: 0.0004400006294250488 } });
});
