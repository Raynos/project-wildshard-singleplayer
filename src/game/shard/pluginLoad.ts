import type { App } from '@wildshard/engine/app/app';
import type { LevelContext } from '@wildshard/engine/level/context';
import { LevelLoadError } from '@wildshard/engine/level/load';
import { shardContext, type GameServices, type ShardContext } from "../plugin/context";
import { runShardLoad, ShardLoadError, type ShardLoadServices } from './load';
import type { ShardManifest } from './manifest';
import { toLevelSpec } from './spec';
import { loadManifestProduct } from '../shardfile/runtimeProduct';

/** Runtime adapter is separate from load.ts, which build-time asset tools import without a browser. */
export function loadShardPlugin(app: App, manifest: ShardManifest, game: GameServices, services: ShardLoadServices): Promise<void> {
  return runShardLoad(manifest, async (stage) => {
    const load = manifest.load;
    if (load === undefined) throw new ShardLoadError('manifest.load', new Error('This manifest has no plugin loader'));
    const product = await stage('product', () => loadManifestProduct(manifest, app.engineScope));
    const { default: Plugin } = await stage('manifest.load', load);
    const plugin = new Plugin();
    let context: ShardContext | undefined;
    const ctx = (level: LevelContext): ShardContext => { context ??= shardContext(level, manifest, game, product); return context; };
    try {
      await app.loadLevel(toLevelSpec(manifest, product), {
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
