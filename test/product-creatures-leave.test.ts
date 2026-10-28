import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { installProductCreatures } from '../src/game/population/productCreatures';
import type { ShardContext } from '../src/game/plugin/context';
import type { SpeciesDecisionAuthority } from '../src/game/plugin/brain';
import { CREATURE_INSTALL } from '../src/shards/driftwood-isle/generators/creatureLook';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';

/** A page whose scope is disposed while its `leaveAt`-th product read is awaited. */
function leavingPage(leaveAt: number): { ctx: ShardContext; bound: string[] } {
  const scope = new Scope('leaving-page'), bound: string[] = [];
  const row = (kind: string) => (): void => { bound.push(kind); };
  let reads = 0;
  const json = async <T,>(name: string): Promise<T> => {
    const readIndex = ++reads;
    await Promise.resolve();
    if (readIndex === leaveAt) scope.dispose();
    const read: object = name === 'actors/creature-install.json' ? CREATURE_INSTALL : {};
    return read as T;
  };
  const section = (): never => { bound.push('section'); throw new Error('read a section after leaving'); };
  const ctx = legacyDouble<ShardContext>({ scope, product: legacyDouble<ShardContext['product']>({ json, section }),
    rows: legacyDouble<ShardContext['rows']>({ species: row('species'), speciesLook: row('look'), spawnTable: row('spawn'), lootTable: row('loot') }) });
  return { ctx, bound };
}

test('a page left during any awaited install read binds no creature rows', async () => {
  for (const leaveAt of [1, 2, 3]) {
    const { ctx, bound } = leavingPage(leaveAt);
    await installProductCreatures(ctx, legacyDouble<SpeciesDecisionAuthority>({}));
    expect(bound, `left at read ${String(leaveAt)}`).toEqual([]);
  }
});

test('independent creature inputs start together and a failed perch drains later reads', async () => {
  const scope = new Scope('creature-read-drain'), requested: string[] = [], bound: string[] = [];
  const firstError = new Error('perch failed'), laterError = new Error('look failed');
  let finishProjection: (value: object) => void = () => { throw new Error('projection was not started'); };
  const projection = new Promise<object>(resolve => { finishProjection = resolve; });
  const json = async <T,>(name: string): Promise<T> => {
    requested.push(name);
    if (name === 'actors/creature-install.json') return CREATURE_INSTALL as T;
    if (name === CREATURE_INSTALL.perch) throw firstError;
    if (name === CREATURE_INSTALL.packed.file) throw laterError;
    if (name === CREATURE_INSTALL.projection) return await projection as T;
    throw new Error('undeclared read');
  };
  const ctx = legacyDouble<ShardContext>({ scope, product: legacyDouble<ShardContext['product']>({ json,
    section: (): never => { bound.push('section'); throw new Error('published before inputs'); } }) });
  let completed = false;
  const result = (async (): Promise<unknown> => {
    try { await installProductCreatures(ctx, legacyDouble<SpeciesDecisionAuthority>({})); return undefined; }
    catch (error: unknown) { return error; }
    finally { completed = true; }
  })();
  try {
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(requested).toEqual(['actors/creature-install.json', CREATURE_INSTALL.perch, CREATURE_INSTALL.packed.file, CREATURE_INSTALL.projection]);
    expect(completed).toBe(false);
    expect(bound).toEqual([]);
    finishProjection({});
    expect(await result).toBe(firstError);
  } finally { finishProjection({}); await result; scope.dispose(); }
});
