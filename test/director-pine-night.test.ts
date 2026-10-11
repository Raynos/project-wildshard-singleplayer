import { beforeAll, expect, it } from 'vitest';
import { Rng } from '../src/engine/core/rng';
import { PineNightDirector, preparePineNightDirector, type NightActor, type NightPorts } from '../src/shards/pine-hollow/runtime/nightDirector';
import { pineNightSpec } from '../src/shards/pine-hollow/quest/nightSpec';
import { LegacyNightBrain } from './fixtures/director-pine/night';

interface Actor extends NightActor { id: string }
let create: Awaited<ReturnType<typeof preparePineNightDirector>>;
beforeAll(async () => { create = await preparePineNightDirector(); });
function owner() {
  let night = 1, errand = true, allocation = 0;
  const rng = new Rng(357), actors = new Map<string, Actor>(), effects: unknown[] = [];
  const ports: NightPorts<Actor> = {
    night: () => night, errand: () => errand, onErrandDone: () => { errand = false; effects.push('errand.done'); },
    next: () => rng.next(), height: () => 3,
    spawn: (kind, x, z, yaw) => {
      const id = String(allocation++), a: Actor = { id, position: { x, y: 3, z }, alive: true, hp: 100, maxHp: 100, lookWeight: 1,
        setMotion: (angle, speed, turn) => { effects.push([id, 'motion', angle, speed, turn]); } };
      actors.set(id, a); effects.push([id, 'spawn', kind, x, z, yaw]); return a;
    },
    shot: (name, a) => { effects.push([a.id, name]); },
    own: a => { effects.push([a.id, 'own']); }, release: a => { effects.push([a.id, 'release']); },
    retire: a => { a.alive = false; effects.push([a.id, 'retire']); }, burst: a => { effects.push([a.id, 'burst']); },
  };
  return { ports, actors, effects, rng, night: (value: number): void => { night = value; },
    errand: (value: boolean): void => { errand = value; } };
}
function population(saved: ReturnType<PineNightDirector<Actor>['snapshot']>) {
  const { director: _director, version: _version, ...state } = saved;
  return { version: 1, ...state };
}

it.each([3, 4] as const)('preserves the shipping phase, body effects, placement stream and thresholds over 10,000 variable frames (max %s)', max => {
  const old = owner(), next = owner(), spec = pineNightSpec(max);
  const shipping = new LegacyNightBrain(old.ports, spec), directed = new PineNightDirector(create(), next.ports, spec);
  const dt = [1 / 60, 1 / 30, 0, 1 / 120, 0.1, 1 / 48];
  let point = { x: spec.mill.x + 60, y: 3, z: spec.mill.z };
  for (let frame = 0; frame < 10000; frame++) {
    if (frame === 100) { point.x = -189; point.z = -134; }
    if (frame === 150) for (const state of [old, next]) for (const a of state.actors.values()) a.alive = false;
    if (frame === 300) point = { x: spec.region.x, y: 3, z: spec.region.z };
    if (frame === 900 || frame === 4000) { old.night(0); next.night(0); }
    if (frame === 1200 || frame === 5000) { old.night(1); next.night(1); }
    if (frame === 1500) point = { x: 220, y: 3, z: 220 };
    if (frame === 2000) point = { x: spec.region.x, y: 3, z: spec.region.z };
    if (frame === 6000) { shipping.force(point); directed.force(point); }
    shipping.update(dt[frame % dt.length] ?? 0, point); directed.advance(dt[frame % dt.length] ?? 0, point);
    expect(next.effects).toEqual(old.effects); expect(next.rng.snapshot()).toEqual(old.rng.snapshot());
    expect(directed.count).toBe(shipping.count);
    if (frame % 500 === 0) expect(population(directed.snapshot(a => a.id))).toEqual(shipping.snapshot(a => a.id));
    old.effects.length = 0; next.effects.length = 0;
  }
  expect(population(directed.snapshot(a => a.id))).toEqual(shipping.snapshot(a => a.id));
});

it('restores mid-flight quietly, refuses old or foreign continuations atomically, and repeats the exact AS suffix', () => {
  const state = owner(), spec = pineNightSpec(3), lane = create(), brain = new PineNightDirector(lane, state.ports, spec);
  const point = { x: spec.region.x, y: 3, z: spec.region.z };
  for (let tick = 0; tick < 120; tick++) brain.advance(1 / 60, point);
  state.night(0); for (let tick = 0; tick < 40; tick++) brain.advance(1 / 60, point);
  const saved = brain.snapshot(a => a.id), find = (id: string) => state.actors.get(id) ?? null;
  state.effects.length = 0;
  const restored = new PineNightDirector(create(), state.ports, spec);
  restored.prepareRestore(saved, find)(); expect(state.effects).toEqual([]); expect(restored.snapshot(a => a.id)).toEqual(saved);
  expect(() => restored.prepareRestore(population(saved), find)).toThrow();
  expect(() => restored.prepareRestore({ ...saved, spec: 'foreign' }, find)).toThrow('Incompatible');
  const before = restored.snapshot(a => a.id);
  expect(() => restored.prepareRestore({ ...saved, director: '{}' }, find)()).toThrow();
  expect(restored.snapshot(a => a.id)).toEqual(before);
  for (let tick = 0; tick < 80; tick++) {
    brain.advance(1 / 60, point); const effects = [...state.effects]; state.effects.length = 0;
    restored.advance(1 / 60, point); expect(state.effects).toEqual(effects); state.effects.length = 0;
  }
  expect(restored.snapshot(a => a.id)).toEqual(brain.snapshot(a => a.id));
  expect(lane.host.checkpoint().modules.map(row => [row.failures, row.disabled])).toEqual([[0, false]]);
});
