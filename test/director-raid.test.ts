import * as v from 'valibot';
import { beforeAll, describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import type { RaidClockPorts } from '../src/shards/nalati-grasslands/creatures/raidClock';
import { NalatiRaidDirector, prepareNalatiRaidDirector } from '../src/shards/nalati-grasslands/runtime/raidDirector';
import { legacyRaidTick } from './fixtures/director-nalati/raid';

let create: Awaited<ReturnType<typeof prepareNalatiRaidDirector>>;
beforeAll(async () => { create = await prepareNalatiRaidDirector(); });
function fixture(seed: number) {
  const rng = new Rng(seed), events: { tick: number; key: string }[] = [];
  const counters = { tick: 0, tries: 0, age: 0, hunts: 0 };
  const record = (key: string): void => { events.push({ tick: counters.tick, key }); };
  const raid: RaidClockPorts = {
    raiding: false, pendingT: 0, raidT: 150 + rng.next() * 90,
    present: true, tracking: false, broken: false, preyAlive: true, cracked: false,
    start: () => {
      record('try'); if (++counters.tries < 3) return false;
      raid.raiding = true; raid.pendingT = 2; counters.hunts++; counters.age = 0;
      Object.assign(raid, { present: true, tracking: false, broken: false, preyAlive: true, cracked: false }); return true;
    },
    next: () => { record('roll'); return 360 + rng.next() * 180; },
    taken: () => { record('taken'); }, drivenOff: () => { record('driven-off'); },
  };
  const state = () => ({ raiding: raid.raiding, pendingT: raid.pendingT, raidT: raid.raidT,
    present: raid.present, tracking: raid.tracking, broken: raid.broken, preyAlive: raid.preyAlive, cracked: raid.cracked });
  const snapshot = () => ({ raid: state(), counters: { ...counters }, rng: rng.snapshot() });
  const restore = (saved: ReturnType<typeof snapshot>): void => {
    Object.assign(raid, saved.raid); Object.assign(counters, saved.counters); rng.restore(saved.rng);
  };
  return { raid, rng, events, state, snapshot, restore, tick: (value: number): void => {
    counters.tick = value;
    if (raid.raiding) {
      counters.age++;
      Object.assign(raid, { tracking: counters.age >= 3, broken: counters.age >= 18,
        preyAlive: !(counters.age >= 18 && counters.hunts % 2 === 0) });
    }
    // The real shepherd and pack consume this same stream between calls.
    if (value % 71 === 0) rng.next();
  } };
}

describe('SF81 Nalati raid rows against the unchanged shipping clock', () => {
  it.each([357, 182, 999])('preserves every timer, native event and shared RNG draw over 10k variable frames (seed %i)', seed => {
    const old = fixture(seed), next = fixture(seed), lane = create(seed), director = new NalatiRaidDirector(lane, next.raid);
    const deltas = [1 / 60, 1 / 30, 0, 0.1, 0.5, 1 / 120];
    for (let frame = 1; frame <= 10000; frame++) {
      old.tick(frame); next.tick(frame);
      const dt = deltas[frame % deltas.length] ?? 0;
      legacyRaidTick(old.raid, dt); director.advance(dt);
      expect(next.state()).toEqual(old.state());
      expect(next.rng.snapshot()).toEqual(old.rng.snapshot());
    }
    expect(next.events).toEqual(old.events);
    expect(old.events.some(event => event.key === 'taken')).toBe(true);
    expect(old.events.some(event => event.key === 'driven-off')).toBe(true);
    expect(lane.host.checkpoint().modules.map(row => [row.failures, row.disabled])).toEqual([[0, false]]);
  }, 60000);

  it('retains failed admission, pending pickup, tracking, broken prey and missing-reference priority exactly', () => {
    const old = fixture(357), next = fixture(357), director = new NalatiRaidDirector(create(357), next.raid);
    const cases = [
      { raiding: false, raidT: 0, pendingT: 0, present: true, tracking: false, broken: false, preyAlive: true, cracked: false },
      { raiding: false, raidT: 0.01, pendingT: 0, present: true, tracking: false, broken: false, preyAlive: true, cracked: false },
      { raiding: false, raidT: 0, pendingT: 0, present: true, tracking: false, broken: false, preyAlive: true, cracked: false },
      { raiding: true, raidT: -0.05, pendingT: 0.01, present: false, tracking: false, broken: true, preyAlive: false, cracked: true },
      { raiding: true, raidT: 180, pendingT: 2, present: true, tracking: false, broken: false, preyAlive: true, cracked: false },
      { raiding: true, raidT: 180, pendingT: 2, present: true, tracking: true, broken: false, preyAlive: true, cracked: true },
      { raiding: true, raidT: 180, pendingT: 2, present: true, tracking: true, broken: true, preyAlive: false, cracked: true },
      { raiding: true, raidT: 180, pendingT: 0.01, present: true, tracking: false, broken: false, preyAlive: true, cracked: true },
    ];
    for (const row of cases) {
      Object.assign(old.raid, row); Object.assign(next.raid, row);
      legacyRaidTick(old.raid, 0.1); director.advance(0.1);
      expect(next.state()).toEqual(old.state()); expect(next.events).toEqual(old.events); expect(next.rng.snapshot()).toEqual(old.rng.snapshot());
    }
  });

  it('restores complete rows and AS memory quietly, refuses old contracts atomically, and repeats the exact native suffix', () => {
    const first = fixture(357), next = fixture(357), director = new NalatiRaidDirector(create(357), first.raid);
    for (let tick = 1; tick <= 1200; tick++) { first.tick(tick); director.advance(0.25); }
    next.restore(first.snapshot()); const saved = director.snapshot();
    const restored = new NalatiRaidDirector(create(357), next.raid); restored.restore(saved);
    expect(next.events).toEqual([]); expect(restored.snapshot()).toBe(saved);
    const parsed = v.parse(v.looseObject({ version: v.number(), contract: v.looseObject({ id: v.string() }) }), JSON.parse(saved));
    for (const invalid of ['{}', JSON.stringify({ ...parsed, version: 2 }), JSON.stringify({ ...parsed, contract: { ...parsed.contract, id: 'foreign' } })]) {
      expect(() => restored.restore(invalid)).toThrow(); expect(restored.snapshot()).toBe(saved); expect(next.events).toEqual([]);
    }
    first.events.length = 0;
    for (let tick = 1201; tick <= 1400; tick++) {
      first.tick(tick); next.tick(tick); director.advance(0.25); restored.advance(0.25);
      expect(next.snapshot()).toEqual(first.snapshot()); expect(next.events).toEqual(first.events);
    }
    expect(restored.snapshot()).toBe(director.snapshot());
  });
});
