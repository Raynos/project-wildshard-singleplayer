import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import { App } from '../src/engine/app/app';
import { createLevelInstallation } from '../src/engine/level/installation';
import { levelSequenceDriver, type LevelSequence } from '../src/game/shard/sequence';
import { shardContext, type ShardContext } from '../src/game/shard/context';
import { ShardPlugin } from '../src/game/shard/plugin';
import type { ShardRuntime } from '../src/game/shard/runtime';
import { toLevelSpec } from '../src/game/shard/spec';
import { GridCellEvents } from '../src/game/grid/boot';
import { HybridShardPlugin } from '../src/game/shardfile/hybrid';
import manifest from '../src/shards/_template/manifest';

const noop = (): void => undefined;
it.each([false, true])('finishes hybrid play before recovery leaves its home (retained=%s)', async retainHomeRuntime => {
  const app = new App(), scope = app.engineScope.child('recovery.home'), cells = new GridCellEvents(), calls: string[] = [];
  cells.enter({ instance: 'template-1', slug: 'template' });
  const parent: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
  const base = createLevelInstallation(app, scope, {}, () => ({ set: noop, detail: noop }));
  const context = shardContext(base.context, manifest, { runtime: parent, shard: manifest, rows: new Map(), bag: { tab: () => noop, fragment: () => noop } });
  class Runtime extends ShardPlugin {
    override kit(ctx: ShardContext): void { ctx.scope.onDispose(() => { calls.push('kit.disposed'); }); }
    override async play(ctx: ShardContext): Promise<void> {
      expect(ctx.scope.disposed).toBe(false); expect(cells.cell?.instance).toBe('template-1');
      await Promise.resolve(); ctx.system({ id: 'fixture.entered', phase: 'update', run: noop }); calls.push('trusted.play');
    }
  }
  class Data extends ShardPlugin {}
  const plugin = new HybridShardPlugin(new Data(), Runtime, { instance: 'template-1', cells, retainHomeRuntime });
  async function* sequence(): LevelSequence<void> {
    await Promise.resolve();
    yield 'world'; yield 'kit'; yield 'loadout'; yield 'play';
    calls.push('shell.play'); yield 'finish';
    // Production recovery is in finish, after the loader's awaited trusted play hook and before its first frame.
    expect(calls).toEqual(['shell.play', 'trusted.play']);
    cells.leave(); calls.push('road');
  }
  const staged = levelSequenceDriver(sequence(), scope, () => ({ set: noop, detail: noop }), noop);
  app.levelDriver = staged.driver;
  try {
    await app.loadLevel(toLevelSpec(manifest), { world: () => plugin.world(context), kit: () => plugin.kit(context), play: () => plugin.play(context) });
    staged.result(); expect(cells.cell).toBeNull(); expect(app.systemIds(scope)).toEqual([]);
    await app.unloadLevel(); expect(calls.filter(call => call === 'kit.disposed')).toHaveLength(1);
    expect(scope.census.disposers).toBe(0);
  } finally { await app.unloadLevel(); app.engineScope.dispose(); }
});
