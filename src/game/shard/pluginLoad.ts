import { LevelLoadError, type App, type LevelContext } from '@wildshard/engine';
import { shardContext, type GameServices, type ShardContext } from './context';
import { runShardLoad, ShardLoadError, type ShardLoadServices } from './load';
import type { ShardManifest } from './manifest';
import { toLevelSpec } from './spec';

/** Runtime adapter is separate from load.ts, which build-time asset tools import without a browser. */
export function loadShardPlugin(app: App, manifest: ShardManifest, game: GameServices, services: ShardLoadServices): Promise<void> {
  return runShardLoad(manifest, async (stage) => {
    const load = manifest.load;
    if (load === undefined) throw new ShardLoadError('manifest.load', new Error('This manifest has no plugin loader'));
    const { default: Plugin } = await stage('manifest.load', load);
    const plugin = new Plugin();
    let context: ShardContext | undefined;
    const ctx = (level: LevelContext): ShardContext => { context ??= shardContext(level, manifest, game); return context; };
    try {
      await app.loadLevel(toLevelSpec(manifest), {
        world: (level) => plugin.world?.(ctx(level)),
        kit: (level) => plugin.kit?.(ctx(level)),
        play: (level) => plugin.play?.(ctx(level)),
      });
    } catch (error) {
      if (error instanceof LevelLoadError) throw new ShardLoadError(error.stage, error);
      throw error;
    }
  }, services);
}
