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
function host(retained = false): { ctx: ShardContext; trace: unknown[]; tick: () => void } {
  const scope = new Scope('home-pacing'), trace: unknown[] = [], random = new Rng(51), ticks: (() => void)[] = [];
  const animals = legacyDouble<Animals>({
    spawn: (kind, x, z, yaw, look, placement) => {
      const entityId = `body.${String(trace.length)}`;
      trace.push({ kind, x, z, yaw, look, placement, random: random.next(), entityId });
      return legacyDouble<Animal>({ entityId, alive: true });
    }, retire: animal => { trace.push({ retire: animal.entityId }); },
  });
  const play = legacyDouble<Play>({ animals }), runtime = legacyDouble<Runtime>({ play });
  const game = legacyDouble<ShardContext['game']>({ runtime });
  const ctx = legacyDouble<ShardContext>({ scope, game, on: () => undefined,
    system: spec => { if (spec.phase === 'fixed.post') ticks.push(() => spec.run(1 / 60, 1)); } });
  return { ctx: retained ? new RetainedRuntimeHooks(ctx, { deferActivation: true }).context : ctx, trace, tick: () => { for (const tick of ticks) tick(); } };
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
