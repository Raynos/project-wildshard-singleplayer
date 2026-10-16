// oxlint-disable-next-line import/no-nodejs-modules -- Compare the shipped admitted guest bytes to the native mechanic.
import { readFileSync } from 'node:fs';
import { expect, test, vi } from 'vitest';
import * as v from 'valibot';
import { MoverMechanic } from '@wildshard/engine/sim/moverMotion';
import { ScriptWorld, type ScriptEntity } from '@wildshard/engine/script/effects';
import { ScriptDriver } from '@wildshard/engine/script/lane';
import { DeclaredScriptWorld } from '@wildshard/engine/script/state';
import { ScriptComposition } from '@wildshard/engine/script/composition';
import { createMoverHost, MoverScriptDriver } from '@wildshard/game/plugin/mover';
import { parseMovers } from '@wildshard/format/movers';
import { MOVER_FIELD_RANGES, moverScriptEntities } from '@wildshard/game/shardfile/movers';
import sky from '../src/shards/far-reach/data/movers.generated.json' with { type: 'json' };
import island from '../src/shards/driftwood-isle/data/movers.generated.json' with { type: 'json' };

const rows = parseMovers([...sky, ...island]);
function motion(row: typeof rows[number]): ConstructorParameters<typeof MoverMechanic>[0] {
  if (row.driver === undefined || row.trigger === undefined) throw new Error('Missing motion');
  return { driver: row.driver, trigger: row.trigger, at: row.at, euler: row.euler, ...(row.track === undefined ? {} : { track: row.track }) };
}
function asset(row: typeof rows[number]): Uint8Array {
  return Uint8Array.from(readFileSync(`src/shards/${row.id.startsWith('far.') || row.id.startsWith('bridge') ? 'far-reach-legacy' : 'driftwood-isle-legacy'}/assets/${row.module}`));
}
test('all Sky and island native motion policies keep the existing guest fields and positions', async () => {
  expect(rows).toHaveLength(14);
  expect(rows.every(row => row.execution === 'native')).toBe(true);
  for (const row of rows) {
    const { execution: _execution, ...legacy } = row;
    const host = await createMoverHost([legacy], new Map([[row.module, asset(row)]]), () => []), native = new MoverMechanic(motion(row));
    let state = host.world.entity(row.entity); if (state === undefined) throw new Error('Missing entity');
    for (let tick = 1; tick <= 900; tick++) {
      const action = tick === 1 || tick === 100 || tick === 400 ? 1 : tick === 600 ? 2 : tick === 700 ? 3 : 0, permission = 3;
      const input = [tick, 1 / 60, action, row.entity, permission, row.input.length, ...[1, 2, 3, 4, 5, 6].map(id => state?.fields[id] ?? 0)];
      host.beginTick(tick); expect(host.call(row.module, row.entity, input).ok, row.id).toBe(true);
      state = native.step(state, { tick, dt: 1 / 60, action, permission }).entity;
      const expected = host.world.entity(row.entity); if (expected === undefined) throw new Error('Missing guest entity');
      for (let i = 0; i < 3; i++) expect(state.position[i], `${row.id} position ${i}`).toBeCloseTo(expected.position[i] ?? 0, 10);
      for (const key of [1, 2, 3, 4, 5, 6]) expect(state.fields[key], `${row.id} field ${key}`).toBeCloseTo(expected.fields[key] ?? 0, 10);
    }
  }
});

test('composed native motion commits at the scheduled phase without a Wasm call and loads the old role envelope', () => {
  const row = rows.find(value => value.driver?.kind === 'static'); if (row === undefined) throw new Error('Missing static row');
  const entities = moverScriptEntities([row]), rules = { fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 };
  const world = new ScriptWorld(rules, entities), bytes = asset(row);
  const savedEntities = v.array(v.strictObject({ id: v.number(), name: v.string(), position: v.tuple([v.number(), v.number(), v.number()]), fields: v.record(v.string(), v.number()), frozen: v.boolean(), interactive: v.boolean() }));
  const role = { id: 'mover', world, query: () => [], events: 'consume' as const, snapshot: () => JSON.stringify(world.state()), restore: (text: string) => { world.restore(v.parse(savedEntities, JSON.parse(text))); } };
  const program = motion(row); if ('kind' in program) throw new Error('Expected fixed row');
  const binding = { module: row.module, entity: row.entity, divisor: 1 };
  const options = { modules: [{ name: row.module, bytes, seedLo: 0, seedHi: 0 }], roles: [role], maxEntities: 32,
    schedules: [{ id: 'mover', role: 'mover', bindings: [binding], input: (_binding: typeof binding, tick: number) => [tick, 1 / 60, 0, row.entity, 0], committed: () => undefined }] };
  const old = new ScriptComposition(options), saved = old.snapshot();
  const schedule = options.schedules[0]; if (schedule === undefined) throw new Error('Missing scheduler');
  const native = new ScriptComposition({ ...options, schedules: [{ ...schedule, bindings: [{ ...binding, motion: program }] }] });
  native.restore(saved);
  const call = vi.spyOn(native.host, 'call'); native.step(1);
  expect(call).not.toHaveBeenCalled(); expect(native.host.checkpoint().used.fuel).toBe(0);
  expect(world.entity(row.entity)?.fields[4]).toBe(1);
});

test('native mover roles keep the exact existing entity and contract save envelope', () => {
  const legacyRows = parseMovers(rows.map(({ execution: _execution, ...row }) => row));
  const legacy = new MoverScriptDriver(legacyRows, () => []), native = new MoverScriptDriver(rows, () => []);
  expect(native.snapshot()).toBe(legacy.snapshot());
  native.restore(legacy.snapshot()); expect(native.snapshot()).toBe(legacy.snapshot());
});

test('surface tracks preserve both bank blends, seating, heading and return landing on the caller clock', () => {
  const row = { kind: 'transit' as const, from: [0, 2, 0] as [number, number, number], to: [20, 3, 5] as [number, number, number],
    landings: [[-1, 2, 0], [21, 3, 5]] as [[number, number, number], [number, number, number]], seconds: 9,
    water: 1.02, bankRamp: 8, seat: -0.45, yaw: Math.PI, bob: [1.9, 0.03] as [number, number], pitch: [1.3, 0.02] as [number, number], roll: [2.1, 0.035, 1] as [number, number, number] };
  const owner = new MoverMechanic(row);
  let state: ScriptEntity = { id: 1, name: 'track', position: [0, 0, 0], fields: {}, frozen: false, interactive: true };
  for (const direction of [1, -1]) {
    let elapsed = 0;
    for (let tick = 1; tick <= 541; tick++) {
      elapsed += 1 / 60; const time = 50 + tick / 60;
      const next = owner.step(state, { tick, dt: 1 / 60, action: tick === 1 ? direction === 1 ? 1 : 2 : 0, permission: 0, time });
      state = next.entity; const carry = next.carry;
      if (carry === undefined) break;
      const from = direction === 1 ? row.from : row.to, to = direction === 1 ? row.to : row.from;
      const u = Math.min(1, elapsed / 9), e = u * u * (3 - 2 * u), wet = Math.min(1, Math.min(u, 1 - u) * 8), bank = from[1] + (to[1] - from[1]) * e;
      if (carry.riding) {
        expect(carry.position[0]).toBeCloseTo(from[0] + (to[0] - from[0]) * e, 10);
        expect(carry.position[1]).toBeCloseTo(bank + (1.02 - bank) * wet + Math.sin(time * 1.9) * 0.03 * wet - 0.45, 10);
      } else { expect(carry.position).toEqual(row.landings[direction === 1 ? 1 : 0]); expect(carry.arrived).toBe(direction); break; }
    }
  }
  expect(() => new MoverMechanic({ ...row, seconds: 0 })).toThrow();
  expect(MoverMechanic.hinge(0, 1, 0.3, 0.6, 1.85)).toEqual({ progress: 0.5, angle: -0.925 });
});


test('retires only proved native mover module memory and migrates numeric and mover role contracts', () => {
  const row = rows.find(value => value.driver?.kind === 'static'); if (row === undefined) throw new Error('Missing static mover');
  const { execution: _execution, ...oldRow } = row, program = motion(row);
  if ('kind' in program) throw new Error('Expected fixed mover');
  const fixture = (native: boolean, scheduled: boolean) => {
    const modules = native ? [] : [{ name: row.module, bytes: asset(row), seedLo: 0, seedHi: 0 }];
    const numeric = new ScriptDriver({ modules, bindings: [], divisor: 1, query: () => [],
      world: new DeclaredScriptWorld({ fields: {}, archetypes: [], events: [], maxEntities: 32 }, [], { shared: [], player: [] }, new Map()) });
    const mover = new MoverScriptDriver(parseMovers([native ? row : oldRow]), () => []);
    const schedule = { id: 'mover', role: 'mover', bindings: [{ module: row.module, entity: row.entity, divisor: 1, ...(native ? { motion: program } : {}) }],
      input: (_binding: { entity: number }, tick: number) => [tick, 1 / 60, 0, row.entity, 0, row.input.length, 0, 0, 0, 0, 0, 0], committed: () => undefined };
    const lane = new ScriptComposition({ modules, roles: [numeric.role('numeric'), mover.role()],
      schedules: [numeric.schedule('numeric', 'numeric'), ...(scheduled ? [schedule] : [])], maxEntities: 32, ...(native ? { nativeMotions: [program] } : {}) });
    return { lane, mover };
  };
  for (const scheduled of [false, true]) {
    const old = fixture(false, scheduled); old.lane.step(1);
    const saved = old.lane.snapshot(), native = fixture(true, scheduled);
    expect(old.lane.host.checkpoint().modules).toHaveLength(1);
    native.lane.restore(saved);
    expect(native.lane.host.currentTick).toBe(1);
    expect(native.lane.host.checkpoint().modules).toEqual([]);
    expect(native.mover.world.state()).toEqual(old.mover.world.state());
    native.lane.step(2); expect(native.lane.host.failureCount).toBe(0);
    const before = native.lane.snapshot();
    expect(() => native.lane.restore(saved.replaceAll(row.module, 'f'.repeat(64)))).toThrow();
    expect(native.lane.snapshot()).toBe(before);
  }
});

test('native mover admission allocates no guest and still fences its exact motion identity', async () => {
  const host = await createMoverHost(rows, new Map(), () => []);
  expect(host.checkpoint().modules).toEqual([]);
  const row = rows[0]; if (row === undefined) throw new Error('Missing native mover');
  const program = motion(row); if ('kind' in program) throw new Error('Expected fixed mover');
  const world = new ScriptWorld({ fields: MOVER_FIELD_RANGES, archetypes: [], events: [], maxEntities: 32 }, moverScriptEntities([row]));
  const role = { id: 'mover', world, events: 'consume' as const, query: () => [], snapshot: () => '', restore: (_text: string) => undefined };
  expect(() => new ScriptComposition({ modules: [], roles: [role], maxEntities: 32, schedules: [{ id: 'mover', role: 'mover',
    bindings: [{ module: 'f'.repeat(64), entity: row.entity, divisor: 1, motion: program }], input: () => [], committed: () => undefined }] })).toThrow('identity');
});
