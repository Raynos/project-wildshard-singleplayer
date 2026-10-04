import { describe, expect, it } from 'vitest';
import { legacyRaidTick, type RaidClockPorts } from '../src/shards/nalati-grasslands/creatures/raidClock';

function fixture(first = 150) {
  const events: string[] = [];
  const raid: RaidClockPorts = { raiding: false, pendingT: 0, raidT: first, present: true, tracking: false, broken: false, preyAlive: true, cracked: false,
    start: () => { events.push('try'); return false; }, next: () => { events.push('roll'); return 360; }, taken: () => { events.push('taken'); }, drivenOff: () => { events.push('driven-off'); } };
  return { raid, events };
}
describe('actual shipping Nalati raid clock', () => {
  it('waits the first interval, then retries a failed start after 30 seconds', () => {
    const { raid, events } = fixture(2 / 60);
    legacyRaidTick(raid, 1 / 60); expect(events).toEqual([]);
    legacyRaidTick(raid, 1 / 60); expect(events).toEqual(['try']); expect(raid.raidT).toBe(30);
    for (let tick = 0; tick < 1799; tick++) legacyRaidTick(raid, 1 / 60);
    expect(events).toEqual(['try']);
    legacyRaidTick(raid, 1 / 60); legacyRaidTick(raid, 1 / 60); expect(events).toEqual(['try', 'try']);
  });
  it('allows two seconds for pack pickup, then rolls next before publishing the hunt outcome', () => {
    const { raid, events } = fixture(); raid.raiding = true; raid.pendingT = 2;
    for (let tick = 0; tick < 120; tick++) legacyRaidTick(raid, 1 / 60);
    expect(events).toEqual([]);
    legacyRaidTick(raid, 1 / 60); expect(events).toEqual(['roll']); expect(raid.raiding).toBe(false); expect(raid.raidT).toBe(360);
    raid.raiding = true; raid.pendingT = 2; Object.assign(raid, { tracking: true, broken: true, preyAlive: false });
    legacyRaidTick(raid, 1 / 60); expect(events).toEqual(['roll', 'roll', 'taken']);
  });
  it('keeps a live hunt, reports a break, and abandons missing native references without drawing rng', () => {
    const { raid, events } = fixture(); raid.raiding = true; raid.pendingT = 2; Object.assign(raid, { tracking: true });
    legacyRaidTick(raid, 1 / 60); expect(raid.pendingT).toBe(0); expect(events).toEqual([]);
    Object.assign(raid, { broken: true }); legacyRaidTick(raid, 1 / 60); expect(events).toEqual(['roll', 'driven-off']);
    raid.raiding = true; Object.assign(raid, { present: false }); legacyRaidTick(raid, 1 / 60); expect(events).toEqual(['roll', 'driven-off']);
  });
});
