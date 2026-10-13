import { expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { Rng } from '../src/engine/core/rng';
import { bindRuntimeHomes, type RuntimeHomePorts } from '../src/game/plugin/headless';
import type { ShardContext } from '../src/game/plugin/context';
import type { Shardfile } from '../src/format/shardSchema';
import { legacyDouble } from './fake/FakeGame';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';

type Runtime = NonNullable<ShardContext['game']['runtime']>;
type Play = NonNullable<Runtime['play']>;
type Animals = Play['animals'];
type Animal = ReturnType<Animals['spawn']>;
const source: Pick<Shardfile, 'runtime'> = { runtime: { entry: 'runtime/index.ts', binds: ['spawns'], spawns: {
  homes: [{ id: 'test.home', kind: 'test', look: 'test.look', at: [1, 2], yaw: 0.3, respawn: 9 }],
  bosses: [{ id: 'test.boss', kind: 'boss', look: 'test.look', at: [3, 4], yaw: 0.4 }],
  actors: [{ id: 'test.early', kind: 'early', look: 'test.look', at: [5, 6], yaw: 0.5 },
    { id: 'test.late', kind: 'late', look: 'test.look', at: [7, 8], yaw: 0.6 }],
} } };
function host(retained = false): { ctx: ShardContext; trace: unknown[]; tick: () => void; update: () => void } {
  const scope = new Scope('home-pacing'), trace: unknown[] = [], random = new Rng(51), ticks: (() => void)[] = [], updates: (() => void)[] = [];
  const animals = legacyDouble<Animals>({
    spawn: (kind, x, z, yaw, look, placement) => {
      const entityId = `body.${String(trace.length)}`;
      trace.push({ kind, x, z, yaw, look, placement, random: random.next(), entityId });
      return legacyDouble<Animal>({ entityId, kind, alive: true, mem: {} });
    }, retire: animal => { trace.push({ retire: animal.entityId }); },
  });
  const play = legacyDouble<Play>({ animals }), runtime = legacyDouble<Runtime>({ play });
  const game = legacyDouble<ShardContext['game']>({ runtime });
  const ctx = legacyDouble<ShardContext>({ scope, game, on: () => undefined,
    system: spec => {
      if (spec.phase === 'fixed.post') ticks.push(() => spec.run(1 / 60, 1));
      if (spec.phase === 'update') updates.push(() => spec.run(1 / 60, 1));
    } });
  return { ctx: retained ? new RetainedRuntimeHooks(ctx, { deferActivation: true }).context : ctx, trace,
    tick: () => { for (const tick of ticks) tick(); }, update: () => { for (const update of updates) update(); } };
}
const ports: RuntimeHomePorts = { system: 'test.homes', held: { order: ['test.early', 'test.boss', 'test.late'], settle: 'test.land',
  late: id => id === 'test.late' ? { fromY: 12, y: 3 } : undefined } };
it.each([false, true])('keeps body order, RNG, landing and disposal exact (retained=%s)', async retained => {
  const plain = host(retained), paced = host(retained), seen: number[] = [];
  const expected = bindRuntimeHomes(plain.ctx, source, ports);
  const actual = await bindRuntimeHomes(paced.ctx, source, ports, () => { seen.push(paced.trace.length); return Promise.resolve(); });
  expect(seen).toEqual(retained ? [1, 2, 3, 4] : [1, 2, 3]);
  expect(paced.trace).toEqual(plain.trace);
  plain.tick(); paced.tick();
  expect(paced.trace).toEqual(plain.trace);
  expect(actual.homes.map(row => row.id)).toEqual(expected.homes.map(row => row.id));
  expect(actual.held('test.late')?.entityId).toBe(expected.held('test.late')?.entityId);
  plain.ctx.scope.dispose(); paced.ctx.scope.dispose();
  expect(paced.trace).toEqual(plain.trace);
});
it('retires a partial roster and refuses another body after its owner closes between slices', async () => {
  const paced = host();
  await expect(bindRuntimeHomes(paced.ctx, source, ports, () => { paced.ctx.scope.dispose(); return Promise.resolve(); }))
    .rejects.toThrow('Runtime home preparation left its owner');
  expect(paced.trace).toHaveLength(2);
  expect(paced.trace[1]).toEqual({ retire: 'body.0' });
});

it.each([false, true])('actual-home and landing rows preserve callback allocation/RNG/phase order (retained=%s)', async retained => {
  const before = host(retained), after = host(retained), home = { x: 1, y: 3, z: 2, r: 9 };
  const rows = ['test.early', 'test.boss', 'test.late'].map(id => ({ id, home }));
  const original = bindRuntimeHomes(before.ctx, source, { ...ports, held: { order: ['test.early', 'test.boss', 'test.late'], settle: 'test.land',
    late: id => id === 'test.late' ? { fromY: 12, y: 3 } : undefined,
    dress: (actor, id) => { const row = rows.find(value => value.id === id); if (row) before.trace.push({ body: actor.entityId, kind: actor.kind, home: row.home }); } } });
  const actual = await bindRuntimeHomes(after.ctx, source, { system: ports.system,
    held: { order: ['test.early', 'test.boss', 'test.late'], settle: 'test.land', placements: [{ id: 'test.late', fromY: 12, y: 3 }] },
    bodyHomes: { rows, authority: { home: (kind, actor, at) => { after.trace.push({ body: actor.entityId, kind, home: at }); } } },
  }, () => Promise.resolve());
  expect(after.trace).toEqual(before.trace);
  before.tick(); after.tick(); expect(after.trace).toEqual(before.trace);
  expect(actual.held('test.late')?.entityId).toBe(original.held('test.late')?.entityId);
  before.ctx.scope.dispose(); after.ctx.scope.dispose(); expect(after.trace).toEqual(before.trace);
});

it('memory hold rows retain the original flag-read and page update phase', () => {
  const before = host(), after = host(); let met = false;
  const original = bindRuntimeHomes(before.ctx, source, { system: ports.system });
  before.ctx.system({ id: 'test.ray', phase: 'update', run: () => { const actor = original.homes[0]?.animal; if (actor) actor.mem['held'] = met ? 0 : 1; } });
  const actual = bindRuntimeHomes(after.ctx, source, { system: ports.system,
    holds: { system: 'test.ray', rows: [{ home: 0, field: 'held', until: 'test.met' }], flags: { has: name => name === 'test.met' && met } } });
  try {
    expect(actual.homes[0]?.animal?.mem).toEqual(original.homes[0]?.animal?.mem);
    for (const value of [false, true, false]) {
      met = value; before.update(); after.update();
      expect(actual.homes[0]?.animal?.mem).toEqual(original.homes[0]?.animal?.mem);
      expect(after.trace).toEqual(before.trace);
    }
  } finally { before.ctx.scope.dispose(); after.ctx.scope.dispose(); }
});

it('foreign/duplicate homes, conflicting floor authority and invalid holds refuse before allocation', () => {
  const run = host(), home = { x: 0, y: 0, z: 0, r: 1 }, authority = { home: () => undefined };
  try {
    expect(() => bindRuntimeHomes(run.ctx, source, { system: ports.system, bodyHomes: { rows: [{ id: 'foreign', home }], authority } })).toThrow('runtime body homes');
    expect(() => bindRuntimeHomes(run.ctx, source, { system: ports.system, bodyHomes: { rows: [{ id: 'test.home', home }, { id: 'test.home', home }], authority } })).toThrow('runtime body homes');
    expect(() => bindRuntimeHomes(run.ctx, source, { ...ports, held: { order: [], settle: 'test.land', late: () => undefined, placements: [] } })).toThrow('runtime late placements');
    expect(() => bindRuntimeHomes(run.ctx, source, { system: ports.system, holds: { system: 'test.ray', flags: { has: () => false }, rows: [{ home: 9, field: 'held', until: 'test.met' }] } })).toThrow('runtime memory holds');
    expect(run.trace).toEqual([]);
  } finally { run.ctx.scope.dispose(); }
});

it('an absent flag owner keeps the original unheld state', () => {
  const run = host();
  try {
    const kept = bindRuntimeHomes(run.ctx, source, { system: ports.system,
      holds: { system: 'test.ray', rows: [{ home: 0, field: 'held', until: 'test.met' }], flags: null } });
    run.update(); expect(kept.homes[0]?.animal?.mem['held']).toBe(0);
  } finally { run.ctx.scope.dispose(); }
});
