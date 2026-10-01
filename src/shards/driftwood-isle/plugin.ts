import { ShardPlugin, type ShardContext } from '#game';
import { buildDriftwoodWorld, keepDriftwoodWorld } from './world/build';
import { OCEAN_BODY } from './world/sea';

/**
 * Driftwood Isle's plugin (E357 S4.1, 08 §4). `world` registers the sea as a water body and builds the island in
 * main.ts's old `edge` order (./world/build.ts); the creatures (S4.2), the adventure, keepsakes, audio and look (S4.3)
 * still run in main.ts and read the built world through `driftwoodWorld(runtime)` until they move here.
 */
export class DriftwoodPlugin extends ShardPlugin {
  override async world(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    ctx.app.world.water.add(OCEAN_BODY, ctx.scope);
    const built = await buildDriftwoodWorld(world, shell.viewer);
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during its world build');
    keepDriftwoodWorld(shell, built);
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
