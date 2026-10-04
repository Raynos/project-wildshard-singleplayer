// oxlint-disable-next-line import/no-nodejs-modules -- The same-engine oracle executes the immutable authored module.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDirector } from '../src/game/shardfile/director';
import { createDirectorLane } from '../src/game/shardfile/directorRuntime';
import { LegacyPineClock, type PineClockPorts, type PineClockEvent } from '../src/shards/pine-hollow/runtime/questClock';
import { pineDirectorRecipe } from '../src/shards/pine-hollow/runtime/questDirector';
import declaration from '../src/shards/pine-hollow/data/director.json';

const data = parseDirector(declaration), bytes = readFileSync(`src/shards/pine-hollow/assets/${data.module}`);
function fixture(hasClock: boolean, savedSeen = false) {
  let tick = 0, night = 0, seen = savedSeen;
  const events: { tick: number; key: PineClockEvent; value: number }[] = [];
  const ports: PineClockPorts = { seen: () => seen, hasClock: () => hasClock, night: () => night,
    publish: (key, value) => { events.push({ tick, key, value }); if (key === 'dawn.finish') seen = true; } };
  return { ports, events, tick: (value: number) => { tick = value; }, night: (value: number) => { night = value; } };
}
describe('SF24 Pine script against the actual shipping night/dawn clock', () => {
  it.each([true, false])('keeps every event tick through 10,000 fixed steps, with sky clock=%s', async (hasClock) => {
    const legacy = fixture(hasClock), directed = fixture(hasClock), clock = new LegacyPineClock(legacy.ports), recipe = pineDirectorRecipe(directed.ports), lane = await createDirectorLane(data, bytes, 357);
    lane.step(0, recipe.observe());
    for (let tick = 1; tick <= 10000; tick++) {
      legacy.tick(tick); directed.tick(tick);
      if (tick === 100 || tick === 300) { if (tick === 300) { legacy.night(1); directed.night(1); } clock.night(); recipe.night(); }
      if (tick === 1000 || tick === 1100 || tick === 5000) { clock.dawn(); recipe.dawn(); }
      clock.tick(1 / 60);
      for (const event of lane.step(tick, recipe.observe())) recipe.publish(event.key, event.value);
    }
    expect(directed.events).toEqual(legacy.events);
    expect(directed.events.filter((event) => event.key === 'dawn.finish')).toEqual([{ tick: 1719, key: 'dawn.finish', value: 0 }]);
    expect(lane.host.checkpoint().modules.map((module) => [module.failures, module.disabled])).toEqual([[0, false]]);
  });
  it.each([false, true])('restores saved dawn facts quietly; seen=%s', async (seen) => {
    const legacy = fixture(true, seen), directed = fixture(true, seen), clock = new LegacyPineClock(legacy.ports), recipe = pineDirectorRecipe(directed.ports, true), lane = await createDirectorLane(data, bytes, 357);
    clock.dawn(); for (const event of lane.step(0, recipe.observe())) recipe.publish(event.key, event.value);
    for (let tick = 1; tick <= 10000; tick++) { legacy.tick(tick); directed.tick(tick); clock.tick(1 / 60); for (const event of lane.step(tick, recipe.observe())) recipe.publish(event.key, event.value); }
    expect(directed.events).toEqual(legacy.events);
  });
  it('restores full author state in the middle of dawn and exactly repeats a 10,000-tick suffix', async () => {
    const native = fixture(true), recipe = pineDirectorRecipe(native.ports, true), lane = await createDirectorLane(data, bytes, 357);
    for (const event of lane.step(0, recipe.observe())) recipe.publish(event.key, event.value);
    for (let tick = 1; tick <= 250; tick++) { native.tick(tick); for (const event of lane.step(tick, recipe.observe())) recipe.publish(event.key, event.value); }
    const saved = lane.snapshot(), tape: unknown[] = [], inputs: Readonly<Record<string, number>>[] = [];
    for (let tick = 251; tick <= 10250; tick++) { native.tick(tick); const input = recipe.observe(); inputs.push(input); const events = lane.step(tick, input); tape.push(events); for (const event of events) recipe.publish(event.key, event.value); }
    const final = lane.snapshot(); lane.restore(saved);
    expect(inputs.map((input, index) => lane.step(251 + index, input))).toEqual(tape); expect(lane.snapshot()).toBe(final);
  });
});
