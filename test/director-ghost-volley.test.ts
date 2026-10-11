import { expect, it } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { GhostVolleyDirector, prepareGhostVolleyDirector } from '../src/shards/nalati-grasslands/runtime/ghostVolleyDirector';

interface Member { id: number; quiet: boolean; fireT: number }
async function fixture(seed: number) {
  const create = await prepareGhostVolleyDirector(), rng = new Rng(seed), events: number[][] = [];
  const members: Member[] = [{ id: 0, quiet: false, fireT: 0 }, { id: 1, quiet: true, fireT: -100_000 }, { id: 2, quiet: false, fireT: 99 }];
  const shoot = (r: Member): void => { events.push([r.id, rng.next(), rng.next()]); };
  const director = new GhostVolleyDirector<Member>(create(seed), () => rng.next(), shoot);
  return { rng, events, members, shoot, director };
}
const rates = [1 / 60, 1 / 30, 1 / 20, 0, 0.3, 1 / 120];
const distances = [6, 6.001, 61.999, 62, 100_000, 35];

it('keeps reverse native shots, boundary decisions and all three RNG draws exact at mixed shipping frame rates', async () => {
  for (const seed of [1, 19001, 2719]) {
    const a = await fixture(seed), b = await fixture(seed);
    for (let tick = 0; tick < 10_000; tick++) {
      const dt = rates[tick % rates.length] ?? 1 / 60;
      for (let i = a.members.length - 1; i >= 0; i--) {
        const current = a.members[i], old = b.members[i];
        if (current === undefined || old === undefined) throw new Error('Missing timer oracle');
        current.quiet = old.quiet = (tick + i) % 101 < 20;
        if (tick % 331 === 0) current.fireT = old.fireT = 99; // the shipping freeze phase precedes firing
        const distance = distances[(tick + i) % distances.length] ?? 35, engaged = (tick + i) % 31 < 20;
        a.director.advance(current, dt, distance, engaged);
        // The frozen page expression, before director rows: decrement, shoot, then draw the retry timer.
        old.fireT -= dt;
        if (!old.quiet && old.fireT <= 0 && distance < 62 && distance > 6 && engaged) {
          b.shoot(old); old.fireT = 3 + b.rng.next() * 1.8;
        }
      }
      expect(a.members).toEqual(b.members);
      expect(a.events).toEqual(b.events); a.events.length = 0; b.events.length = 0;
    }
    expect(a.rng.snapshot()).toEqual(b.rng.snapshot());
  }
});

it('restores the complete firing cursor quietly beside native timers and refuses a pre-row contract atomically', async () => {
  const a = await fixture(193), b = await fixture(193);
  for (const f of [a, b]) for (const member of f.members) f.director.advance(member, 1 / 60, 25, true);
  const saved = a.director.snapshot(), beforeRng = b.rng.snapshot(); b.events.length = 0;
  b.director.restore(saved);
  expect(b.events).toEqual([]); expect(b.rng.snapshot()).toEqual(beforeRng); expect(b.director.snapshot()).toBe(saved);
  const old: unknown = { version: 1, fireT: 3 };
  expect(() => { b.director.restore(JSON.stringify(old)); }).toThrow();
  expect(b.director.snapshot()).toBe(saved);
  a.events.length = 0;
  for (let tick = 0; tick < 500; tick++) {
    const dt = rates[tick % rates.length] ?? 1 / 60;
    for (const f of [a, b]) for (let i = f.members.length - 1; i >= 0; i--) {
      const member = f.members[i]; if (member !== undefined) f.director.advance(member, dt, 35, true);
    }
    expect(b.members).toEqual(a.members); expect(b.events).toEqual(a.events);
    a.events.length = 0; b.events.length = 0;
  }
  expect(b.director.snapshot()).toBe(a.director.snapshot()); expect(b.rng.snapshot()).toEqual(a.rng.snapshot());
});

it('retains long negative native timers and refuses non-finite observations before any shot', async () => {
  const f = await fixture(2), member = f.members[1];
  if (member === undefined) throw new Error('Missing long timer');
  const before = member.fireT;
  f.director.advance(member, 1 / 60, 100_000, false);
  expect(member.fireT).toBe(before - 1 / 60); expect(f.events).toEqual([]);
  const saved = f.director.snapshot();
  expect(() => { f.director.advance(member, 1 / 60, Infinity, true); }).toThrow();
  expect(f.director.snapshot()).toBe(saved); expect(f.events).toEqual([]);
});
