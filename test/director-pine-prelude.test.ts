import * as v from 'valibot';
import { expect, it } from 'vitest';
import { PineElitePrelude } from '../src/shards/pine-hollow/runtime/elitePrelude';

function rig() {
  const state = { alive: true, dt: 1 / 60, elapsed: 0 };
  const effects: string[] = [];
  const owner = new PineElitePrelude({
    alive: () => state.alive,
    clock: () => { state.elapsed += state.dt; effects.push('clock'); },
    clear: () => { effects.push('clear'); },
    home: () => { effects.push('home'); },
    fight: () => { effects.push('fight'); },
    idle: () => { effects.push('idle'); },
  });
  return { owner, state, effects };
}

it('preserves absent-first and leash-before-engagement priority on every real frame', () => {
  const actual = rig();
  let expectedClock = 0;
  for (let i = 0; i < 10_000; i++) {
    actual.state.alive = i % 7 !== 0;
    actual.state.dt = i % 3 === 0 ? 1 / 30 : 1 / 60;
    const engaged = i % 5 !== 0, leashing = i % 11 < 3;
    const expected = !actual.state.alive ? ['clear']
      : leashing ? ['clock', 'clear', 'home'] : engaged ? ['clock', 'fight'] : ['clock', 'idle'];
    if (actual.state.alive) expectedClock += actual.state.dt;
    actual.owner.advance(engaged, leashing);
    expect(actual.effects).toEqual(expected);
    expect(actual.state.elapsed).toBe(expectedClock);
    actual.effects.length = 0;
  }
});

it('restores the cursor without actions and keeps the same mixed-frame suffix', () => {
  const a = rig(), b = rig();
  a.owner.advance(true, false);
  a.owner.advance(true, true);
  b.state.elapsed = a.state.elapsed;
  b.owner.restore(a.owner.snapshot());
  expect(b.effects).toEqual([]);
  expect(b.owner.snapshot()).toBe(a.owner.snapshot());
  a.effects.length = 0;
  for (let i = 0; i < 100; i++) {
    a.state.alive = b.state.alive = i % 3 !== 0;
    a.state.dt = b.state.dt = i % 2 === 0 ? 1 / 30 : 1 / 60;
    a.owner.advance(i % 2 === 0, i % 5 === 0);
    b.owner.advance(i % 2 === 0, i % 5 === 0);
    expect(b.effects).toEqual(a.effects);
    expect(b.state.elapsed).toBe(a.state.elapsed);
    expect(b.owner.snapshot()).toBe(a.owner.snapshot());
    a.effects.length = b.effects.length = 0;
  }
});

it('refuses edited rows, stale versions and malformed cursors without mutation or native effects', () => {
  const actual = rig();
  actual.owner.advance(true, false);
  actual.effects.length = 0;
  const before = actual.owner.snapshot();
  const raw = v.parse(v.strictObject({ version: v.number(), contract: v.looseObject({ id: v.string() }), state: v.strictObject({ tick: v.number(), stage: v.number() }) }), JSON.parse(before));
  const foreign = structuredClone(raw); foreign.contract.id = 'pine.foreign';
  const stale = structuredClone(raw); stale.version = 1;
  const malformed = structuredClone(raw); malformed.state.stage = 63;
  for (const saved of [foreign, stale, malformed]) {
    expect(() => actual.owner.restore(JSON.stringify(saved))).toThrow();
    expect(() => actual.owner.validate(JSON.stringify(saved))).toThrow();
    expect(actual.owner.snapshot()).toBe(before);
    expect(actual.effects).toEqual([]);
  }
});
