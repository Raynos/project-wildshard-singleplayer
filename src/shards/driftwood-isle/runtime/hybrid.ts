import type { ShardContext } from '@wildshard/game/shard/context';
import { installDeclaredMovers } from '@wildshard/sdk/runtime/movers';
import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import { withGeometryBake } from '@wildshard/engine/world/geometryBake';
import { withVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import RuntimePlugin from './index';
import { buildDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { driftwoodMoverViews } from './movers';
import { installDriftwoodCreatures } from '../creatures/install';
import { declaredCreatureRows } from './brains';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import source from '../shard.config';
import { CASCADE_LOOKS } from '../data/waterfallLook';
import { setWaterfallLooks } from '../world/Waterfall';
import { SMOKE_LOOK } from '../data/smokeLook';
import { setSmokeLook } from './looks/smokeColumn';

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
      // SF46 (G164): the resident's world is built lowered as one, the sea at road level; its kits' voxel AO and its rocks'
      // painted pieces are read from the build-time bakes (SF67, scripts/bake-voxel-ao.mjs, scripts/bake-geometry.mjs),
      // built in code only on a miss
      // the look.materials graphs the runtime's own meshes wear (data/waterfallLook.ts, data/smokeLook.ts), owned by the resident
      const built = await residentWorld.load(context, async (owner) => {
        const { materials } = await runtimeLookMaterials({ scope: owner, game: context.game }, source, true, [...Object.values(CASCADE_LOOKS), SMOKE_LOOK]);
        setWaterfallLooks(materials); setSmokeLook(materials);
        return withGeometryBake('/assets/models/driftwood-blender/geometry.bin',
        () => withVoxelAOBake('/assets/models/driftwood-blender/voxel-ao.bin', () => buildDriftwoodWorld(world, viewer, progress))); });
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
