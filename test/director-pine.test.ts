import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- The same-engine oracle executes the immutable authored module.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { parseDirector } from '@wildshard/format/director';
import { createDirectorLane, prepareDirectorModule } from '../src/game/plugin/director';
import { LegacyPineClock, type PineClockPorts, type PineClockEvent } from './fixtures/director-pine/clock';
import { pineDirectorRecipe } from './fixtures/director-pine/recipe';
import { installPineClock } from '../src/shards/pine-hollow/runtime/directorClock';
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
  it('dispatches at zero elapsed time without resetting tick fuel or query allowances', async () => {
    const native = fixture(true), recipe = pineDirectorRecipe(native.ports), lane = await createDirectorLane(data, bytes, 357);
    expect(() => lane.dispatch(recipe.observe())).toThrow('initialized');
    lane.step(0, recipe.observe());
    lane.enqueue('night.request');
    expect(lane.dispatch(recipe.observe()).map(event => event.key)).toEqual(['night.consume', 'night.start']);
    expect(lane.tick).toBe(0);
    const used = lane.host.checkpoint().used;
    expect(used.queries).toBe(2); expect(used.fuel).toBeGreaterThan(0);
    for (let i = used.queries; i < lane.host.limits.queries; i++) lane.dispatch(recipe.observe());
    lane.dispatch(recipe.observe());
    expect(lane.host.checkpoint().modules[0]?.failures).toBe(1);
    lane.step(1, recipe.observe());
    expect(lane.host.checkpoint().used.queries).toBe(0); // Exhaustion freezes; advancing time must not bypass quarantine.
    lane.host.resume(data.module, data.entity);
    lane.step(2, recipe.observe());
    expect(lane.host.checkpoint().used.queries).toBe(1);
    const before = lane.snapshot();
    expect(() => lane.step(3, recipe.observe(), Infinity)).toThrow('delta');
    expect(lane.snapshot()).toBe(before);
  });
  it('hash-admits a reusable factory with independent author states and immutable input bytes', async () => {
    const input = Uint8Array.from(bytes), contract = parseDirector(declaration), create = await prepareDirectorModule(contract, input);
    input.fill(0); contract.parameters[0] = 99;
    const left = create(357), right = create(357), recipe = pineDirectorRecipe(fixture(true).ports);
    left.step(0, recipe.observe()); right.step(0, recipe.observe());
    left.enqueue('dawn.request'); expect(left.dispatch(recipe.observe()).map(event => event.key)).toEqual(['dawn.start']);
    expect(right.dispatch(recipe.observe())).toEqual([]);
    expect(left.data.parameters[0]).toBe(2.5);
  });
  it('snapshots pending typed requests and rejects undeclared input events', async () => {
    const native = fixture(true), recipe = pineDirectorRecipe(native.ports), lane = await createDirectorLane(data, bytes, 357);
    lane.step(0, recipe.observe()); recipe.bind((key) => { lane.enqueue(key); }); recipe.night(); recipe.dawn();
    const saved = lane.snapshot(), restored = await createDirectorLane(data, bytes, 357); restored.restore(saved);
    expect(restored.step(1, recipe.observe())).toEqual(lane.step(1, recipe.observe())); expect(restored.snapshot()).toBe(lane.snapshot());
    expect(() => lane.enqueue('arbitrary.call')).toThrow('subscribed');
  });
  it('installs the real row clock without a Debug fork, duplicate update or publication after disposal', async () => {
    const native = fixture(true), scope = new Scope('pine.clock.fixture');
    try {
      const clock = await installPineClock({ scope }, native.ports, false);
      clock.night(); clock.dawn();
      expect(native.events.map(event => event.key)).toEqual(['night.consume', 'night.start', 'dawn.start']);
      const saved = clock.save(); expect(v.parse(v.looseObject({ version: v.literal(3) }), JSON.parse(saved)).version).toBe(3);
      scope.dispose(); native.events.length = 0;
      clock.night(); clock.dawn(); clock.tick(1 / 60); expect(native.events).toEqual([]);
    } finally { scope.dispose(); }
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
