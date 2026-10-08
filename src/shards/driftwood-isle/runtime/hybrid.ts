import type { ShardContext } from '@wildshard/game/shard/context';
import { installDeclaredMovers } from '@wildshard/game/shardfile/moverRuntime';
import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import RuntimePlugin from './index';
import { buildDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { driftwoodMoverViews } from './movers';
import { installDriftwoodCreatures } from '../creatures/install';
import { declaredCreatureRows } from './brains';

// The static transitional world belongs to the resident, not a single entered play scope.
const residentWorld = new HybridResidentWorld<DriftwoodWorld>();

/** Driftwood's only boot (SF46 hybrid, G172): the admitted shardfile's declared movers and brains over the lowered world. */
class DriftwoodMoverPlugin extends RuntimePlugin {
  private readonly binding: { context?: ShardContext };
  constructor() {
    const binding: { context?: ShardContext } = {};
    super(async (world, viewer, progress) => {
      const context = binding.context;
      if (context === undefined) throw new Error('Declared Driftwood movers require their scoped world hook');
      // SF46 (G164): the resident's world is built lowered as one, the sea at road level
      const built = await residentWorld.load(context, () => buildDriftwoodWorld(world, viewer, progress));
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
  protected override installCreatures(context: ShardContext): void { installDriftwoodCreatures(context, declaredCreatureRows()); }
}

// oxlint-disable-next-line import/no-default-export -- The declared trusted runtime loader consumes a constructor.
export default DriftwoodMoverPlugin;
