import { expect, it, vi } from 'vitest';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext, type ShardContext } from '../src/game/shard/context';
import { ShardPlugin } from '../src/game/shard/plugin';
import { emptyShardfile } from '../src/sdk/author';
import { emptyShardfileSource } from '../src/game/shardfile/loader';
import { shardEntries } from '../src/game/shard/entryMode';
import SkyPlugin from '../src/shards/far-reach/plugin';
import SignalPlugin from '../src/shards/sunscar-dunes/plugin';
import NinePlugin from '../src/shards/nine-dragon-stack/plugin';
import { SKY_REACH } from '../src/shards/far-reach/manifest';
import { SUNSCAR_DUNES } from '../src/shards/sunscar-dunes/manifest';
import { NINE_DRAGON_STACK } from '../src/shards/nine-dragon-stack/manifest';

const cases = [
  { Plugin: SkyPlugin, manifest: SKY_REACH },
  { Plugin: SignalPlugin, manifest: SUNSCAR_DUNES },
  { Plugin: NinePlugin, manifest: NINE_DRAGON_STACK },
];

it.each(cases)('$manifest.slug admits its current SHARDFILE runtime and keeps ordinary legacy stage contexts unchanged', async ({ Plugin, manifest }) => {
  expect(shardEntries(manifest)).toEqual({ legacy: true, shardfile: true, public: 'legacy' });
  for (const shardfile of [false, true]) {
    const legacy = vi.fn(), hybrid = vi.fn();
    class Legacy extends ShardPlugin {
      override world(ctx: ShardContext): void { legacy('world', ctx); }
      override kit(ctx: ShardContext): void { legacy('kit', ctx); }
      override play(ctx: ShardContext): void { legacy('play', ctx); }
    }
    class Admitted extends ShardPlugin {
      override world(ctx: ShardContext): void { hybrid('world', ctx); }
      override kit(ctx: ShardContext): void { hybrid('kit', ctx); }
      override play(ctx: ShardContext): void { hybrid('play', ctx); }
    }
    const prepare = vi.fn((_ctx: ShardContext) => Promise.resolve(new Admitted()));
    const app = new App(), scope = app.engineScope.child('entry.fixture');
    const source = emptyShardfileSource(emptyShardfile({ slug: manifest.slug, name: manifest.name, author: 'Fixture', seed: 1, revision: 1 }));
    const installation = createLevelInstallation(app, scope, { debugRow: () => { throw new Error('Entry choice is not a Debug row'); } },
      () => ({ set: () => undefined, detail: () => undefined }));
    const ctx = shardContext(installation.context, source, { shard: source, rows: new Map(), bag: {
      tab: () => () => undefined, fragment: () => () => undefined,
    } });
    try {
      const plugin = new Plugin(Legacy, prepare, () => shardfile);
      await expect(plugin.kit(ctx)).rejects.toThrow('world is not admitted');
      await expect(plugin.play(ctx)).rejects.toThrow('world is not admitted');
      await plugin.world(ctx); await plugin.kit(ctx); await plugin.play(ctx);
      expect((shardfile ? hybrid : legacy).mock.calls).toEqual([['world', ctx], ['kit', ctx], ['play', ctx]]);
      expect((shardfile ? legacy : hybrid).mock.calls).toEqual([]);
      expect(prepare).toHaveBeenCalledTimes(shardfile ? 1 : 0);
      if (shardfile) expect(prepare).toHaveBeenCalledWith(ctx);
    } finally { app.engineScope.dispose(); }
    expect(scope.census.disposers).toBe(0);
  }
});
