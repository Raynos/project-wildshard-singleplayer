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

test('a refused perch leaves later inputs unread and binds no rows', async () => {
  const scope = new Scope('creature-refusal'), requested: string[] = [];
  const failure = new Error('perch failed');
  const json = async <T,>(name: string): Promise<T> => {
    requested.push(name);
    await Promise.resolve();
    if (name === 'actors/creature-install.json') return CREATURE_INSTALL as T;
    throw failure;
  };
  const ctx = legacyDouble<ShardContext>({ scope, product: legacyDouble<ShardContext['product']>({ json,
    section: (): never => { throw new Error('published after refusal'); } }) });
  try {
    await expect(installProductCreatures(ctx, legacyDouble<SpeciesDecisionAuthority>({}))).rejects.toBe(failure);
    expect(requested).toEqual(['actors/creature-install.json', CREATURE_INSTALL.perch]);
  } finally { scope.dispose(); }
});
