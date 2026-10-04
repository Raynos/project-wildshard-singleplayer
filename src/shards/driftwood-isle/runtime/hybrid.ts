import type { ShardContext } from '@wildshard/game/shard/context';
import { installDeclaredMovers } from '@wildshard/game/shardfile/moverRuntime';
import RuntimePlugin from './index';
import { buildDriftwoodWorld } from '../world/build';
import { driftwoodMoverViews } from './movers';

/** SF30 activation is confined to SF46's default-off hybrid path; the ordinary entry keeps the exact legacy world. */
class DriftwoodMoverPlugin extends RuntimePlugin {
  private readonly binding: { context?: ShardContext };
  constructor() {
    const binding: { context?: ShardContext } = {};
    super(async (world, viewer) => {
      const built = await buildDriftwoodWorld(world, viewer);
      const context = binding.context;
      if (context === undefined) throw new Error('Declared Driftwood movers require their scoped world hook');
      const options = driftwoodMoverViews(built);
      if (options === null) throw new Error('Declared Driftwood movers require the bridge and moored boat');
      await installDeclaredMovers(context, world, options);
      return built;
    });
    this.binding = binding;
  }
  override async world(context: ShardContext): Promise<void> {
    this.binding.context = context;
    await super.world(context);
  }
}

// oxlint-disable-next-line import/no-default-export -- The declared trusted runtime loader consumes a constructor.
export default DriftwoodMoverPlugin;
