// oxlint-disable-next-line import/no-nodejs-modules -- Native replay reads the authored AssemblyScript source and records its witness.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileScript } from '../scripts/compile-script.mjs';
import { parseDirector, type DirectorData } from '../src/game/shardfile/director';
import { DirectorLane, createDirectorLane } from '../src/game/shardfile/directorRuntime';
import declaration from '../src/shards/driftwood-isle/data/director.json';

const hash = 'a'.repeat(64);
const finale: DirectorData = {
  id: 'driftwood.finale', entity: 9000, module: hash, parameters: [7, 7],
  inputs: ['altar', 'dead', 'seen', 'player-x', 'player-z', 'reward-x', 'reward-z'].map((key) => ({ key, min: -250, max: 250 })),
  events: [9001, 9002, 9003, 9004, 9005].map((id, i) => ({ id, key: ['captain.restore', 'captain.wake', 'captain.dead', 'reward.start', 'reward.finish'][i] ?? 'invalid', direction: 'output', type: 'none', min: 0, max: 0 })),
  subscriptions: [{ event: 'world.dawn', scope: 'grid' }],
};
let bytes: Uint8Array;
beforeAll(async () => { bytes = await compileScript(readFileSync('src/shards/driftwood-isle/behaviour/director.as', 'utf8'), { maximumPages: 1 }); });
function observation(tick: number) { return { altar: Number(tick >= 10), dead: Number(tick >= 200), seen: 0, 'player-x': tick >= 220 ? 0 : 20, 'player-z': 0, 'reward-x': 0, 'reward-z': 0 }; }
describe('SF24 typed, bounded shard director', () => {
  it('admits the shipped module by hash, copies bytes and rejects replacement bytes before publication', async () => {
    const data = parseDirector(declaration);
    const lane = await createDirectorLane(data, bytes, 357);
    const corrupted = Uint8Array.from(bytes); corrupted[0] = 1;
    await expect(createDirectorLane(data, corrupted, 357)).rejects.toThrow('hash mismatch');
    expect(lane.step(0, observation(1000))).toEqual([]);
    const events = lane.step(1, observation(1000));
    expect(events.map((event) => event.key)).toEqual(['reward.start']);
    const reloaded = await createDirectorLane(data, bytes, 357);
    expect(reloaded.step(0, observation(100)).map((event) => event.key)).toEqual(['captain.restore']);
    expect(reloaded.step(1, observation(100))).toEqual([]);
  });
  it('rejects duplicate ids, unbounded payloads and invalid shard subscriptions; reserves grid declarations without delivery', () => {
    expect(parseDirector(finale)).toEqual(finale);
    expect(() => parseDirector({ ...finale, events: [...finale.events, finale.events[0]] })).toThrow();
    expect(() => parseDirector({ ...finale, inputs: [{ key: 'bad', min: 2, max: 1 }] })).toThrow();
    expect(() => parseDirector({ ...finale, subscriptions: [{ event: 'missing', scope: 'shard' }] })).toThrow();
    const lane = new DirectorLane(finale, bytes, 357);
    expect(() => lane.enqueue('world.dawn', 0, 'grid')).toThrow('reserved');
    expect(() => lane.enqueue('captain.wake')).toThrow('subscribed');
  });
  it('runs the declared event tape over 10,000 fixed steps without exceeding its allowances', () => {
    const lane = new DirectorLane(finale, bytes, 357), events: { tick: number; key: string }[] = [];
    for (let tick = 1; tick <= 10000; tick++) {
      const emitted = lane.step(tick, observation(tick));
      expect(emitted.every((event) => event.value === 0 && event.type === 'none')).toBe(true);
      events.push(...emitted.map((event) => ({ tick: event.tick, key: event.key })));
      expect(lane.host.world.entity(9000)?.frozen).toBe(false);
    }
    expect(events).toEqual([{ tick: 10, key: 'captain.wake' }, { tick: 200, key: 'captain.dead' }, { tick: 220, key: 'reward.start' }, { tick: 640, key: 'reward.finish' }]);
  }, 60000);
  it('restores a saved altar captain quietly and never re-awards a seen reward', () => {
    const lane = new DirectorLane(finale, bytes, 357);
    expect(lane.step(1, { ...observation(100), altar: 1 }).map((event) => event.key)).toEqual(['captain.restore']);
    const completed = new DirectorLane(finale, bytes, 357);
    for (let tick = 1; tick < 600; tick++) expect(completed.step(tick, { ...observation(1000), seen: 1 })).toEqual([]);
  });
  it('bounds typed inputs and restores the next-tick queue without replaying callbacks', () => {
    const data = { ...finale, events: [...finale.events, { id: 9010, key: 'entity.hit', direction: 'input' as const, type: 'boolean' as const, min: 0, max: 1 }], subscriptions: [{ event: 'entity.hit', scope: 'shard' as const }] };
    const lane = new DirectorLane(data, bytes, 357);
    expect(() => lane.enqueue('entity.hit', 0.5)).toThrow();
    for (let i = 0; i < 32; i++) lane.enqueue('entity.hit', 1);
    expect(() => lane.enqueue('entity.hit', 1)).toThrow('allowance');
    const restored = new DirectorLane(data, bytes, 357); restored.restore(lane.snapshot());
    expect(restored.step(1, observation(1))).toEqual(lane.step(1, observation(1)));
    expect(restored.snapshot()).toBe(lane.snapshot());
    const saved = restored.snapshot(); expect(() => restored.step(2, { ...observation(2), dead: Infinity })).toThrow('observation'); expect(restored.snapshot()).toBe(saved);
  });
  it('rejects a wrongly typed output batch before publication and rolls author state back', async () => {
    const source = readFileSync('src/shards/driftwood-isle/behaviour/director.as', 'utf8').replace('store<f64>(o+24,0)', 'store<f64>(o+24,1)');
    const bad = await compileScript(source, { maximumPages: 1 }), lane = new DirectorLane(finale, bad, 357), before = lane.host.snapshot(hash);
    expect(lane.step(1, { ...observation(100), altar: 1 })).toEqual([]);
    expect(lane.host.checkpoint().pending).toEqual([]); expect(lane.host.world.entity(9000)?.frozen).toBe(true);
    expect(lane.host.snapshot(hash)).toEqual(before);
  });
  it('restores full memory/globals, budgets and pending inputs for an exact mid-reward suffix', () => {
    const lane = new DirectorLane(finale, bytes, 357);
    for (let tick = 1; tick <= 300; tick++) lane.step(tick, observation(tick));
    const saved = lane.snapshot(), restored = new DirectorLane(finale, bytes, 357); restored.restore(saved);
    expect(restored.snapshot()).toBe(saved);
    for (let tick = 301; tick <= 1000; tick++) { expect(restored.step(tick, observation(tick))).toEqual(lane.step(tick, observation(tick))); expect(restored.snapshot()).toBe(lane.snapshot()); }
    expect(() => restored.restore(JSON.stringify({ ...JSON.parse(saved), pending: [{ type: 9001, value: 0 }] }))).toThrow();
    expect(restored.snapshot()).toBe(lane.snapshot());
  });
});
