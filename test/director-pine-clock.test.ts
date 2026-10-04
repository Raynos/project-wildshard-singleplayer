import { describe, expect, it } from 'vitest';
import { LegacyPineClock, type PineClockEvent } from '../src/shards/pine-hollow/runtime/questClock';

function fixture() {
  const events: { tick: number; key: PineClockEvent; value: number }[] = [];
  let tick = 0, seen = false, hasClock = true, night = 0;
  const clock = new LegacyPineClock({ seen: () => seen, hasClock: () => hasClock, night: () => night,
    publish: (key, value) => { events.push({ tick, key, value }); if (key === 'dawn.finish') seen = true; } });
  return { clock, events, tick: (value: number) => { tick = value; }, seen: (value: boolean) => { seen = value; }, sky: (has: boolean, brightness: number) => { hasClock = has; night = brightness; } };
}
describe('actual shipping Pine night/dawn decisions', () => {
  it('consumes night requests and fast-forwards only a daytime clock', () => {
    const h = fixture(); h.clock.night(); expect(h.events.map((event) => [event.key, event.value])).toEqual([['night.consume', 0], ['night.start', 6]]);
    h.sky(true, 0.5); h.clock.night(); h.sky(false, 0); h.clock.night(); expect(h.events.filter((event) => event.key === 'night.start')).toHaveLength(1);
  });
  it('plays sunrise, lanterns, caption and reward once at the exact floating-point shipping thresholds', () => {
    const h = fixture(); h.clock.dawn(); h.clock.dawn();
    for (let tick = 1; tick <= 10000; tick++) { h.tick(tick); h.clock.tick(1 / 60); }
    expect(h.events).toEqual([{ tick: 0, key: 'dawn.start', value: 0 }, { tick: 151, key: 'dawn.sunrise', value: 7 },
      { tick: 241, key: 'dawn.lanterns', value: 0 }, { tick: 301, key: 'dawn.caption', value: 0 }, { tick: 720, key: 'dawn.finish', value: 0 }]);
    h.clock.dawn(); h.clock.tick(20); expect(h.events).toHaveLength(5);
  });
  it('does not replay a saved dawn or require a sky clock for the other rewards', () => {
    const h = fixture(); h.seen(true); h.clock.dawn(); h.clock.tick(20); expect(h.events).toEqual([]);
    h.seen(false); h.sky(false, 0); h.clock.dawn(); h.clock.tick(20); expect(h.events.map((event) => event.key)).toEqual(['dawn.start', 'dawn.lanterns', 'dawn.caption', 'dawn.finish']);
  });
});
