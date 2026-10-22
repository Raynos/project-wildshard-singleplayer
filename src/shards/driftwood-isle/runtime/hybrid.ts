import { COLLECTIONS, fixedDrawLibrary } from './boot/blobAssets';
import { WorldAssembly } from '@wildshard/game/shardfile/worldAssembly';
import { publishEntryOwner, lendEntryOwner } from '@wildshard/game/shardfile/entryOwners';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentBakedTiles } from '@wildshard/game/shardfile/bakedTiles';
import { buildProgress, type ShardContext, ShardPlugin } from '@wildshard/game/plugin/context';

import { buildDriftwoodWorld, MOOR_LOOK } from '../world/build';

import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import { boundResidentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { admitDriftwoodRows, driftwoodRows } from './boot/rows';

const residents = new WeakMap<ShardContext['product'], HybridResidentWorld<void>>();

/** Driftwood owns its world, creatures, loadout, adventure and audio through scoped hooks. */
export class DriftwoodPlugin extends ShardPlugin {
  override async world(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    const viewer = shell.viewer, progress = buildProgress(ctx);
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    const resident = boundResidentWorldScope(ctx.scope);
    if (resident === undefined) {
      lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [MOOR_LOOK]));
      await buildDriftwoodWorld(world, viewer, progress, await installWorldScenes(ctx, ctx.product.section('world/scenes')), await residentBakedTiles(ctx, ctx.scope), ctx.scope);
      if (ctx.scope.disposed || ctx.scope.disposing) throw new Error('Driftwood entry ended during build');
      publishEntryOwner(ctx.scope, 'collection', 'driftwood.collections', COLLECTIONS);
      publishEntryOwner(ctx.scope, 'fixed-draws', 'driftwood.fixed-draws', fixedDrawLibrary());
    } else {
      admitDriftwoodRows(ctx.product);
      let construction = residents.get(ctx.product);
      if (construction === undefined) {
        construction = new HybridResidentWorld<void>();
        residents.set(ctx.product, construction);
      }
      await construction.load(ctx, async owner => {
        lendLooks(owner, await runtimeLookMaterials({ scope: owner, game: ctx.game }, ctx.product.shardfile, true, [...Object.values(driftwoodRows('custom/fixedLayouts').nativeView.CASCADE_LOOKS), driftwoodRows('custom/fixedLayouts').nativeView.SMOKE_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.FIREFLY_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.REEF_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.POOL_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.SHRINE_POOL_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.OCEAN_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.GULL_GRAPH_LOOK, ...driftwoodRows('custom/fixedLayouts').nativeView.COVER_LOOKS, ...Object.values(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS), MOOR_LOOK]));
        await buildDriftwoodWorld(world, viewer, progress, await installWorldScenes(ctx, ctx.product.section('world/scenes'), owner), await residentBakedTiles(ctx, owner), owner);
        if (owner.disposed || owner.disposing) throw new Error('Driftwood construction ended during build');
        publishEntryOwner(owner, 'collection', 'driftwood.collections', COLLECTIONS);
        publishEntryOwner(owner, 'fixed-draws', 'driftwood.fixed-draws', fixedDrawLibrary());
      });
    }
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during its world build');
    WorldAssembly.lend(ctx.product.section('custom/worldStages'), resident ?? ctx.scope, ctx.scope);
    if (resident !== undefined) {
      lendEntryOwner(ctx.scope, resident, 'fixed-draws', 'driftwood.fixed-draws');
    }
    if (resident !== undefined) lendEntryOwner(ctx.scope, resident, 'collection', 'driftwood.collections');
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
