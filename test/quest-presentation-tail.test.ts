// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import type { ShardContext } from '../src/game/plugin/context';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { installQuestHintFile } from '../src/game/quest/hints';
import { requireQuestPageOwners } from '../src/game/quest/pageComposition';
import { legacyDouble } from './fake/FakeGame';
import hintsRows from '../src/shards/driftwood-isle/data/questHints.json' with { type: 'json' };

type Runtime = NonNullable<ShardContext['game']['runtime']>;
function fixture(parent?: Scope) {
  const scope = parent?.child('presentation-tail') ?? new Scope('presentation-tail');
  const feed = vi.fn<NonNullable<NonNullable<Runtime['play']>['firstHints']>['feed']>(), events: string[] = [], systems: string[] = [];
  const on: ShardContext['on'] = name => { events.push(name); };
  const player = legacyDouble<NonNullable<Runtime['world']>['player']>({});
  const world = legacyDouble<NonNullable<Runtime['world']>>({ player });
  const play = legacyDouble<NonNullable<Runtime['play']>>({ firstHints: legacyDouble<NonNullable<NonNullable<Runtime['play']>['firstHints']>>({ feed }),
    animals: legacyDouble<NonNullable<Runtime['play']>['animals']>({ animals: [] }) });
  const shell = legacyDouble<Runtime>({ world, play, hooks: {} });
  let settle: (value: unknown) => void = () => { throw new Error('Read not initialized'); };
  const read = new Promise<unknown>(resolve => { settle = resolve; });
  const reads = vi.fn<(name: string) => void>();
  const source = emptyShardfile({ slug: 'presentation-tail', name: 'Presentation fixture', author: 'Fixture', revision: 1, seed: 1 });
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: source, sections: new Map(),
    files: new Map([['quests/hints.json', { hash: 'hints', url: 'hints' }]]), read: async () => {
      reads('quests/hints.json'); return new TextEncoder().encode(JSON.stringify(await read));
    } });
  const ctx = legacyDouble<ShardContext>({ scope, product, game: legacyDouble<ShardContext['game']>({ runtime: shell }),
    app: legacyDouble<ShardContext['app']>({ ui: legacyDouble<ShardContext['app']['ui']>({}) }),
    system: row => { systems.push(row.id); }, on });
  const page = { scope, product, shell, world, h: play };
  return { ctx, page, feed, events, systems, reads, settle };
}

test('the actual preparation guard refuses replaced owners before map or flags publication', () => {
  for (const owner of ['runtime', 'world', 'play', 'product']) {
    const f = fixture();
    try {
      requireQuestPageOwners(f.ctx, f.page);
      if (owner === 'runtime') Object.assign(f.ctx.game, { runtime: legacyDouble<Runtime>({ ...f.page.shell }) });
      else if (owner === 'world') Object.assign(f.page.shell, { world: legacyDouble<NonNullable<Runtime['world']>>({ ...f.page.world }) });
      else if (owner === 'play') Object.assign(f.page.shell, { play: legacyDouble<NonNullable<Runtime['play']>>({ ...f.page.h }) });
      else Object.assign(f.ctx, { product: legacyDouble<ShardContext['product']>({ ...f.page.product }) });
      expect(() => requireQuestPageOwners(f.ctx, f.page)).toThrow('before presentation');
      expect(f.page.shell.hooks.adventureFlags).toBeUndefined(); expect(f.reads).not.toHaveBeenCalled();
    } finally { f.page.scope.dispose(); }
  }
});

test('held hint reads refuse every replaced native owner before any feed, listener or system', async () => {
  for (const owner of ['runtime', 'world', 'play', 'product', 'hints', 'animals', 'player', 'ui']) {
    const f = fixture();
    try {
      const installed = installQuestHintFile(f.ctx, 'quests/hints.json');
      expect(f.reads).toHaveBeenCalledExactlyOnceWith('quests/hints.json');
      if (owner === 'runtime') Object.assign(f.ctx.game, { runtime: legacyDouble<Runtime>({ ...f.page.shell }) });
      else if (owner === 'world') Object.assign(f.page.shell, { world: legacyDouble<NonNullable<Runtime['world']>>({ ...f.page.world }) });
      else if (owner === 'play') Object.assign(f.page.shell, { play: legacyDouble<NonNullable<Runtime['play']>>({ ...f.page.h }) });
      else if (owner === 'product') Object.assign(f.ctx, { product: legacyDouble<ShardContext['product']>({ ...f.page.product }) });
      else if (owner === 'hints') Object.assign(f.page.h, { firstHints: legacyDouble<NonNullable<NonNullable<Runtime['play']>['firstHints']>>({}) });
      else if (owner === 'animals') Object.assign(f.page.h, { animals: legacyDouble<NonNullable<Runtime['play']>['animals']>({}) });
      else if (owner === 'player') Object.assign(f.page.world, { player: legacyDouble<NonNullable<Runtime['world']>['player']>({}) });
      else Object.assign(f.ctx.app, { ui: legacyDouble<ShardContext['app']['ui']>({}) });
      f.settle(hintsRows); await expect(installed).rejects.toThrow('during admission');
      expect(f.feed).not.toHaveBeenCalled(); expect(f.events).toEqual([]); expect(f.systems).toEqual([]);
    } finally { f.page.scope.dispose(); }
  }
});

test('ancestor retirement fences the real held read and preparation before effects', async () => {
  const parent = new Scope('presentation-parent'), f = fixture(parent);
  try {
    const installed = installQuestHintFile(f.ctx, 'quests/hints.json');
    parent.onDispose(() => undefined); const retirement = parent.disposeSteps(); retirement.next();
    try {
      expect(f.page.scope.disposed).toBe(false); expect(f.page.scope.disposing).toBe(true);
      expect(() => requireQuestPageOwners(f.ctx, f.page)).toThrow('before presentation');
      f.settle(hintsRows); await expect(installed).rejects.toThrow('during admission');
      expect(f.feed).not.toHaveBeenCalled(); expect(f.events).toEqual([]); expect(f.systems).toEqual([]);
    } finally { for (const step of retirement) void step; }
  } finally { parent.dispose(); }
});


test('the real product hint read installs the original feed, event and system exactly once', async () => {
  const f = fixture();
  try {
    const installed = installQuestHintFile(f.ctx, 'quests/hints.json');
    f.settle(hintsRows); await installed;
    expect(f.reads).toHaveBeenCalledExactlyOnceWith('quests/hints.json');
    expect(f.feed).toHaveBeenCalledOnce(); expect(f.events).toEqual(['ai.windup']); expect(f.systems).toEqual([hintsRows.system.id]);
  } finally { f.page.scope.dispose(); }
});
