// oxlint-disable-next-line import/no-nodejs-modules -- Replay executes the actual immutable author bytes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { parseDirector } from '../src/game/shardfile/director';
import { createDirectorLane } from '../src/game/shardfile/directorRuntime';
import { legacyRaidTick, type RaidClockPorts } from '../src/shards/nalati-grasslands/creatures/raidClock';
import { raidObservation, publishRaidEvent } from '../src/shards/nalati-grasslands/creatures/raidDirector';
import declaration from '../src/shards/nalati-grasslands/data/director.json';

const data = parseDirector(declaration), bytes = readFileSync(`src/shards/nalati-grasslands/assets/${data.module}`);
function fixture(seed: number) {
  const rng = new Rng(seed), events: { tick: number; key: string }[] = [];
  let tick = 0, tries = 0, age = 0, hunts = 0;
  const record = (key: string): void => { events.push({ tick, key }); };
  const raid: RaidClockPorts = { raiding: false, pendingT: 0, raidT: 150 + rng.next() * 90, present: true, tracking: false, broken: false, preyAlive: true, cracked: false,
    start: () => { record('try'); if (++tries < 3) return false; raid.raiding = true; raid.pendingT = 2; hunts++; age = 0; Object.assign(raid, { tracking: false, broken: false, preyAlive: true, cracked: false }); return true; },
    next: () => { record('roll'); return 360 + rng.next() * 180; }, taken: () => { record('taken'); }, drivenOff: () => { record('driven-off'); } };
  return { raid, rng, events, tick: (value: number) => {
    tick = value;
    if (raid.raiding) { age++; Object.assign(raid, { tracking: age >= 30, broken: age >= 180, preyAlive: !(age >= 180 && hunts % 2 === 0) }); }
    // The native shepherd and pack also draw this same stream between director calls.
    if (value % 71 === 0) rng.next();
  } };
}
describe('SF24 Nalati director against the actual shipping raid clock', () => {
  it.each([357, 182, 999])('preserves event ticks and shared RNG order through 65,000 fixed ticks (seed %i)', async (seed) => {
    const legacy = fixture(seed), directed = fixture(seed), lane = await createDirectorLane(data, bytes, seed);
    expect(lane.step(0, raidObservation(directed.raid))).toEqual([]);
    for (let tick = 1; tick <= 65000; tick++) {
      legacy.tick(tick); directed.tick(tick);
      legacyRaidTick(legacy.raid, 1 / 60);
      for (const event of lane.step(tick, raidObservation(directed.raid))) publishRaidEvent(directed.raid, event.key, event.value);
      expect(directed.raid.raiding).toBe(legacy.raid.raiding);
    }
    expect(directed.events).toEqual(legacy.events); expect(directed.rng.snapshot()).toEqual(legacy.rng.snapshot());
    const tries = legacy.events.filter((event) => event.key === 'try');
    expect(tries[0]?.tick).toBeGreaterThanOrEqual(150 * 60); expect(tries[0]?.tick).toBeLessThanOrEqual(240 * 60);
    expect(tries[1]?.tick).toBe((tries[0]?.tick ?? 0) + 1801); expect(tries[2]?.tick).toBe((tries[1]?.tick ?? 0) + 1801);
    expect(legacy.events.some((event) => event.key === 'taken')).toBe(true); expect(legacy.events.some((event) => event.key === 'driven-off')).toBe(true);
    expect(lane.host.checkpoint().modules.map((module) => [module.failures, module.disabled])).toEqual([[0, false]]);
  }, 60000);
  it('restores the complete author continuation across a 10,000-tick suffix', async () => {
    const lane = await createDirectorLane(data, bytes, 357), native = fixture(357);
    lane.step(0, raidObservation(native.raid));
    for (let tick = 1; tick <= 10000; tick++) { native.tick(tick); for (const event of lane.step(tick, raidObservation(native.raid))) publishRaidEvent(native.raid, event.key, event.value); }
    const checkpoint = lane.snapshot(), observations: Readonly<Record<string, number>>[] = [], tape: unknown[] = [];
    for (let tick = 10001; tick <= 20000; tick++) { native.tick(tick); const observation = raidObservation(native.raid); observations.push(observation); const events = lane.step(tick, observation); tape.push(events); for (const event of events) publishRaidEvent(native.raid, event.key, event.value); }
    const final = lane.snapshot(); lane.restore(checkpoint);
    expect(observations.map((observation, index) => lane.step(10001 + index, observation))).toEqual(tape); expect(lane.snapshot()).toBe(final);
  }, 60000);
});
