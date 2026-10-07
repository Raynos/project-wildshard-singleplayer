// oxlint-disable-next-line import/no-nodejs-modules -- The same-engine oracle executes the immutable authored module.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDev, setDev } from '../src/engine/core/devMode';
import { Scope } from '../src/engine/app/scope';
import type { DebugRowSpec } from '../src/engine/level/context';
import type { SystemSpec } from '../src/engine/app/systems';
import { parseDirector } from '../src/game/shardfile/director';
import { createDirectorLane } from '../src/game/shardfile/directorRuntime';
import { LegacyPineClock, type PineClockPorts, type PineClockEvent } from '../src/shards/pine-hollow/runtime/questClock';
import { pineDirectorRecipe, installPineClock } from '../src/shards/pine-hollow/runtime/questDirector';
import declaration from '../src/shards/pine-hollow/data/director.json';

const data = parseDirector(declaration), bytes = readFileSync(`src/shards/pine-hollow/assets/${data.module}`);
function fixture(hasClock: boolean, savedSeen = false) {
  let tick = 0, night = 0, seen = savedSeen;
  const events: { tick: number; key: PineClockEvent; value: number }[] = [];
  const ports: PineClockPorts = { seen: () => seen, hasClock: () => hasClock, night: () => night,
    publish: (key, value) => { events.push({ tick, key, value }); if (key === 'dawn.finish') seen = true; } };
  return { ports, events, tick: (value: number) => { tick = value; }, night: (value: number) => { night = value; } };
}
afterEach(() => { vi.restoreAllMocks(); });
describe('SF24 Pine script against the actual shipping night/dawn clock', () => {
  it.each([true, false])('keeps every event tick through 10,000 fixed steps, with sky clock=%s', async (hasClock) => {
    const legacy = fixture(hasClock), directed = fixture(hasClock), clock = new LegacyPineClock(legacy.ports), recipe = pineDirectorRecipe(directed.ports), lane = await createDirectorLane(data, bytes, 357);
    lane.step(0, recipe.observe()); recipe.bind((key) => { lane.enqueue(key); });
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
  it('snapshots pending typed requests and rejects undeclared input events', async () => {
    const native = fixture(true), recipe = pineDirectorRecipe(native.ports), lane = await createDirectorLane(data, bytes, 357);
    lane.step(0, recipe.observe()); recipe.bind((key) => { lane.enqueue(key); }); recipe.night(); recipe.dawn();
    const saved = lane.snapshot(), restored = await createDirectorLane(data, bytes, 357); restored.restore(saved);
    expect(restored.step(1, recipe.observe())).toEqual(lane.step(1, recipe.observe())); expect(restored.snapshot()).toBe(lane.snapshot());
    expect(() => lane.enqueue('arbitrary.call')).toThrow('subscribed');
  });
  it('installs the saved shared setting, with no script fetch on the legacy path and fixed next-tick requests on Script', async () => {
    const previous = isDev(); setDev(false);
    const native = fixture(true), systems: SystemSpec[] = [], scope = new Scope('pine.clock.fixture');
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response(Uint8Array.from(bytes))));
    try {
      const base = { scope, system: (value: SystemSpec) => { systems.push(value); }, debugRow: () => { /* Default-off shared row. */ } };
      const legacy = await installPineClock(base, native.ports, false); legacy.night();
      expect(fetch).not.toHaveBeenCalled(); expect(systems).toEqual([]);
      native.events.length = 0;
      const selected = { ...base, debugRow: (row: DebugRowSpec) => { row.change('on'); } };
      await installPineClock(selected, native.ports, false);
      expect(fetch).not.toHaveBeenCalled(); expect(systems).toEqual([]);
      setDev(true);
      const scripted = await installPineClock(selected, native.ports, false);
      expect(fetch).toHaveBeenCalledTimes(1); expect(systems[0]?.phase).toBe('fixed.post');
      scripted.night(); scripted.dawn(); expect(native.events).toEqual([]);
      native.tick(1); systems[0]?.run(1 / 60, 1 / 60);
      expect(native.events.map((event) => event.key)).toEqual(['night.consume', 'night.start', 'dawn.start']);
      scope.dispose(); native.events.length = 0; systems[0]?.run(1 / 60, 2 / 60); expect(native.events).toEqual([]);
    } finally { scope.dispose(); setDev(previous); }
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
