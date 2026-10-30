import { expect, onTestFinished, test, vi } from 'vitest';
import { ReturnProgram } from '../src/game/population/returnProgram';
import { DecisionModule } from '../src/engine/script/decisionModule';
import { Rng } from '../src/engine/core/rng';
import { PINE_SHELTER_ORIGINAL as program } from './fixtures/pine-shelter';
import look from '../src/shards/pine-hollow/data/populationShelter.json' with { type: 'json' };

// A field-only return guest answers a repeated request from its last result without running (Pine's shelter clock);
// every answer still equals a fresh program's, and anything that could change it runs the guest.
test('a repeated pure return request answers as a fresh guest without running it', () => {
  const runs = vi.spyOn(DecisionModule.prototype, 'invoke'); onTestFinished(() => { runs.mockRestore(); });
  const guest = ReturnProgram.page(program);
  const ran = (call: () => unknown): number => { const before = runs.mock.calls.length; call(); return runs.mock.calls.length - before; };
  const fresh = (signal: string, frame: Readonly<Record<string, number>>): Readonly<Record<string, number>> => ReturnProgram.page(program).project(signal, frame);
  let seed = 3;
  const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const step = (): Record<string, number> => ({ present: Number(rnd() < .5), hold: rnd() < .7 ? 0 : Math.floor(rnd() * look.homeHold), rain: rnd() < .6 ? 0 : 1,
    wet: look.wet, dry: look.dry, homeHold: look.homeHold, dt: .1 });
  let previous = step(), hits = 0;
  for (let i = 0; i < 300; i++) {
    const frame = rnd() < .7 ? { ...previous } : step(), signal = rnd() < .9 ? 'shelterStep' : 'shelterGoal';
    const input = signal === 'shelterStep' ? frame : { ...frame, spot: 0, homeX: 1, homeZ: 2, spotX: 0, spotZ: 0, spotR: look.spotR, homeR: look.homeR };
    let out: Readonly<Record<string, number>> = {};
    if (ran(() => { out = guest.project(signal, input); }) === 0) hits++;
    expect(out).toEqual(fresh(signal, input));
    previous = frame;
  }
  expect(hits).toBeGreaterThan(100);

  const frame = step(), first = guest.project('shelterStep', frame);
  // a returned record is the caller's: changing it cannot change a later answer
  Object.assign(first, { keep: 7, hold: -1 });
  expect(guest.project('shelterStep', { ...frame })).toEqual(fresh('shelterStep', frame));
  // a changed value, -0, a key added, dropped or reordered, another signal, a random stream or candidates run the guest
  expect(ran(() => guest.project('shelterStep', { ...frame }))).toBe(0);
  expect(ran(() => guest.project('shelterStep', { ...frame, hold: frame['hold'] === 0 ? -0 : 0 }))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', frame))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', { ...frame, rain: 0.5 }))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', frame))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', { ...frame, spot: 0 }))).toBeGreaterThan(0);
  const { dt, ...rest } = frame;
  expect(ran(() => guest.project('shelterStep', { dt: dt ?? .1, ...rest }))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', frame))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', frame, new Rng(1)))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', frame, undefined, [{ x: 1 }]))).toBeGreaterThan(0);
  // an inherited or accessor field could change unseen: such a record always runs the guest
  const inherited: Record<string, number> = { ...frame }; Object.setPrototypeOf(inherited, { rain: frame['rain'] ?? 0 });
  expect(ran(() => guest.project('shelterStep', inherited))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', inherited))).toBeGreaterThan(0);
  const read = { ...frame }; Object.defineProperty(read, 'hold', { get: () => frame['hold'] ?? 0, enumerable: true });
  expect(ran(() => guest.project('shelterStep', read))).toBeGreaterThan(0);
  expect(ran(() => guest.project('shelterStep', read))).toBeGreaterThan(0);
  // every request is still checked before the memo answers, and a refusal stores nothing
  expect(() => guest.project('shelterStep', { ...frame, hold: Number.NaN })).toThrow('Invalid return request');
  expect(() => guest.project('noSuchSignal', frame)).toThrow('Invalid return request');
  expect(() => guest.project('shelterStep', { present: 0 })).toThrow();
  const oracle = fresh('shelterStep', frame);
  expect(ran(() => { expect(guest.project('shelterStep', frame)).toEqual(oracle); })).toBe(0);
});
