import type { ShardContext } from '@wildshard/game/shard/context';
import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import { withGeometryBake } from '@wildshard/engine/world/geometryBake';
import { withVoxelAOBake } from '@wildshard/engine/world/voxelAO';
import RuntimePlugin from './index';
import { buildDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { CASCADE_LOOKS, SMOKE_LOOK, FIREFLY_LOOK, REEF_LOOK, POOL_LOOK, SHRINE_POOL_LOOK, OCEAN_LOOK, CREATURE_LOOKS, COVER_LOOKS, ISLAND_LOOKS, GULL_GRAPH_LOOK } from './const';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { admitDriftwoodRows } from './boot/rows';

// The static transitional world belongs to the resident, not a single entered play scope; its motion binds the admitted
// product's boat and bridge movers to their real rendered/native owners (one resident per admitted product).
const residents = new WeakMap<ShardContext['product'], HybridResidentWorld<DriftwoodWorld>>();
function residentWorld(context: ShardContext): HybridResidentWorld<DriftwoodWorld> {
  let resident = residents.get(context.product);
  if (resident === undefined) {
    resident = new HybridResidentWorld<DriftwoodWorld>({ motion: { source: { ...context.product.shardfile, ...context.product.section('world/movers') }, systemId: 'shard.driftwood.movers', rows: [
      { id: 'driftwood.boat', target: 'boat', group: 'group', afterPose: 'refreshPose' },
      { id: 'driftwood.bridge', target: 'bridgeDeck', chain: true },
    ] } });
    residents.set(context.product, resident);
  }
  return resident;
}

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
      // the look.materials graphs the runtime's own meshes wear (data/waterfallLook.ts, data/smokeLook.ts, data/fireflyLook.ts, data/reefLook.ts,
      // data/poolLook.ts, data/oceanLook.ts, data/gullGraphLook.ts, data/creatureLook.ts, data/islandLook.ts), lent to the world's modules for the resident's scope; the toon graphs follow the
      // day clock's toon tunables once a frame
      admitDriftwoodRows(context.product); // the client rows the world's models read (custom sections, W2b)
      const built = await residentWorld(context).load(context, async (owner) => {
        lendLooks(owner, await runtimeLookMaterials({ scope: owner, game: context.game }, context.product.shardfile, true, [...Object.values(CASCADE_LOOKS), SMOKE_LOOK, FIREFLY_LOOK, REEF_LOOK, POOL_LOOK, SHRINE_POOL_LOOK, OCEAN_LOOK, GULL_GRAPH_LOOK, ...COVER_LOOKS, ...Object.values(CREATURE_LOOKS), ...Object.values(ISLAND_LOOKS)]));
        return withGeometryBake('/assets/models/driftwood-blender/geometry.bin',
        () => withVoxelAOBake('/assets/models/driftwood-blender/voxel-ao.bin', () => buildDriftwoodWorld(world, viewer, progress))); });
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
