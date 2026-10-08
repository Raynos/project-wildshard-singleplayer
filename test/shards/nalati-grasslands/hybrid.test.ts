import { expect, it, vi } from 'vitest';
import { App } from '../../../src/engine/app/app';
import { createLevelInstallation } from '../../../src/engine/level/installation';
import { shardContext, type ShardContext } from '../../../src/game/shard/context';
import { emptyShardfile } from '../../../src/sdk/author';
import { emptyShardfileSource } from '../../../src/game/shardfile/loader';
import source from '../../../src/shards/nalati-grasslands/shard.config';
import { ShardPlugin } from '../../../src/game/shard/plugin';
import Plugin from '../../../src/shards/nalati-grasslands/plugin';
import { NALATI_RUNTIME_COST } from '../../../src/shards/nalati-grasslands/data/runtimeCost';

it.each(['legacy', 'shardfile'])('enters Nalati as %s from SHARD SELECT (SF65), with identical LEGACY stage contexts and no data admission', async (choice) => {
  const legacy = vi.fn(), hybrid = vi.fn();
  class Legacy extends ShardPlugin {
    override world(context: ShardContext): void { legacy('world', context); }
    override kit(context: ShardContext): void { legacy('kit', context); }
    override play(context: ShardContext): void { legacy('play', context); }
  }
  class Admitted extends ShardPlugin {
    override world(context: ShardContext): void { hybrid('world', context); }
    override kit(context: ShardContext): void { hybrid('kit', context); }
    override play(context: ShardContext): void { hybrid('play', context); }
  }
  const prepare = vi.fn((_context: ShardContext) => Promise.resolve(new Admitted()));
  const app = new App(), manifest = emptyShardfileSource(emptyShardfile({ slug: source.identity.slug, name: source.identity.name, author: 'Fixture', seed: 357, revision: 1 })), scope = app.engineScope.child('nalati.boot');
  const installation = createLevelInstallation(app, scope, { debugRow: () => { throw new Error('SF65: the hybrid boot has no Debug row'); } }, () => ({ set: () => undefined, detail: () => undefined }));
  const context = shardContext(installation.context, manifest, { shard: manifest, rows: new Map(), bag: {
    tab: () => () => undefined, fragment: () => () => undefined,
  } });
  try {
    const plugin = new Plugin(Legacy, prepare, () => choice === 'shardfile'); await plugin.world(context); await plugin.kit(context); await plugin.play(context);
    const selected = choice === 'legacy' ? legacy : hybrid;
    expect(selected.mock.calls).toEqual([['world', context], ['kit', context], ['play', context]]);
    expect((choice === 'legacy' ? hybrid : legacy).mock.calls).toEqual([]);
    if (choice === 'legacy') expect(prepare).not.toHaveBeenCalled();
    else {
      expect(prepare).toHaveBeenCalledTimes(1);
      expect(prepare).toHaveBeenCalledWith(context);
    }
    expect(source.runtime).toEqual({ entry: 'runtime/index.ts', cost: NALATI_RUNTIME_COST });
  } finally { app.engineScope.dispose(); }
  expect(scope.census.disposers).toBe(0);
});
