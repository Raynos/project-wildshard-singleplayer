import { expect, test } from 'vitest';
import { ReturnProgram } from '../src/game/population/returnProgram';
import program from '../src/shards/nalati-grasslands/behaviour/admission.generated.json' with {type:'json'};

const author = () => ReturnProgram.page(program);
test('native alarm decisions retain strict radii and capped awareness', () => {
  const a = author();
  expect(a.project('whistle', { x: 0, z: 0, px: 29, pz: 0, awareness: .9 })).toEqual({ accept: 1, awareness: 1 });
  expect(a.project('whistle', { x: 0, z: 0, px: 30, pz: 0, awareness: 0 })['accept']).toBe(0);
  expect(a.project('scare', { x: 5, z: 5, px: 8, pz: 9, radius: 5 })['accept']).toBe(0);
  expect(a.project('scare', { x: 5, z: 5, px: 8, pz: 9, radius: 6 })['accept']).toBe(1);
});
test('wild speed projection caps teleports and handles a stationary clock', () => {
  const a = author(), row = { x: 100, z: 0, px: 0, pz: 0, dt: .1, speed: 0 };
  expect(a.project('speed', row)['speed']).toBeCloseTo(8.4);
  expect(a.project('speed', { ...row, dt: 0, speed: 3 })['speed']).toBe(3);
  expect(a.project('speed', { ...row, dt: 1 })['speed']).toBe(14);
});
