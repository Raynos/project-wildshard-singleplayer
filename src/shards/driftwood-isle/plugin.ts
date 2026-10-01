import { ShardPlugin, type ShardContext } from '#game';
import { buildDriftwoodWorld, keepDriftwoodWorld, type DriftwoodWorld } from './world/build';
import type { World } from '#engine';
import type { Vector3 } from 'three';

type WorldBuilder = (world: World, viewer: () => Vector3) => Promise<DriftwoodWorld>;

/**
 * Driftwood Isle's plugin (E357 S4.1, 08 §4). The sea is the manifest's `ground.water` (registered at level.data); `world` builds the island in
 * main.ts's old `edge` order (./world/build.ts); the creatures (S4.2), the adventure, keepsakes, audio and look (S4.3)
 * still run in main.ts and read the built world through `driftwoodWorld(runtime)` until they move here.
 */
export class DriftwoodPlugin extends ShardPlugin {
  private readonly build: WorldBuilder;
  /** `build` is injectable so the hook runs with a stub world in a node test (test/shards/driftwood-isle/plugin.test.ts) */
  constructor(build: WorldBuilder = buildDriftwoodWorld) {
    super();
    this.build = build;
  }

  override async world(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    const built = await this.build(world, shell.viewer);
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during its world build');
    keepDriftwoodWorld(shell, built);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
