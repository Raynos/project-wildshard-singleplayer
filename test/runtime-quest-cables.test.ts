// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { Flags } from '../src/engine/world/interact/flags';
import { bindRuntimeQuest } from '../src/game/plugin/headless';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { PINE_MODES } from '../src/shards/pine-hollow/generators/zipline';

test('page quests bind admitted cable rows when authoring config has no modes', () => {
  const source = emptyShardfile({ slug: 'cable-quest', name: 'Cable quest', author: 'Test', revision: 1, seed: 1 });
  source.runtime = { entry: 'runtime/index.ts', binds: ['quests', 'modes'] };
  source.quests = { flags: ['done', 'arrived'], quests: [{ id: 'cross', title: 'Cross', completeFlag: 'done',
    steps: [{ id: 'arrive', objective: 'Arrive', done: { all: ['arrived'] } }] }], triggers: [], dialogue: [] };
  const built = { ...source, modes: PINE_MODES }, scope = new Scope('cable-quest');
  const product = createShardProduct({ slug: source.identity.slug, revision: 1, shardfile: built,
    sections: new Map([['state/modes', { modes: PINE_MODES }]]), files: new Map(),
    read: () => Promise.reject(new Error('Cable rows require no blob read')) });
  try {
    expect(source.modes?.traverse ?? []).toEqual([]);
    const bound = bindRuntimeQuest({ app: new App(), scope, product }, source, 'cross', { flags: new Flags('cable-quest', false) });
    expect(bound.cables.state('pine.zipline')).toEqual({ riding: false, atEnd: false });
    bound.cables.start('pine.zipline');
    expect(bound.cables.state('pine.zipline').riding).toBe(true);
    expect(() => bound.cables.state('missing')).toThrow('Unknown cable mode');
    const legacyScope = new Scope('unbound-legacy-quest');
    try {
      const legacy: typeof source = { ...source, runtime: { entry: 'runtime/index.ts', binds: ['quests'] } };
      expect(() => bindRuntimeQuest({ app: new App(), scope: legacyScope }, source, 'cross',
        { flags: new Flags('missing-product', false) })).toThrow('Runtime-bound modes require an admitted product');
      expect(() => bindRuntimeQuest({ app: new App(), scope: legacyScope },
        legacy, 'cross', { flags: new Flags('legacy-quest', false) })).not.toThrow();
    } finally { legacyScope.dispose(); }
  } finally { scope.dispose(); }
});
