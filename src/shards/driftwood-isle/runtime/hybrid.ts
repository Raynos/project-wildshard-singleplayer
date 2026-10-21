import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';
import { residentBakedTiles } from '@wildshard/game/shardfile/bakedTiles';
import { pageDecisionAuthority } from '@wildshard/game/shardfile/borrowedDecisions';
import { buildProgress, type ShardContext, ShardPlugin } from '@wildshard/game/plugin/context';

import { buildDriftwoodWorld, keepDriftwoodWorld, type DriftwoodWorld } from '../world/build';
import { islandSystems } from './world/systems';
import { installPageLife } from '@wildshard/sdk/looks/pageLife';
import { withPreparedScriptMemories } from '@wildshard/engine/script/host';
import { readDirectorProduct } from '@wildshard/game/plugin/director';
import { installDriftwoodAdventure } from '../quest/install';
import type { QuestPageComposition as Adventure } from '@wildshard/game/quest/pageComposition';
import { installDriftwoodCreatures } from '../creatures/install';
import { HeldClaims } from '@wildshard/game/loadout/claims';

import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import { boundResidentWorldScope } from '@wildshard/game/shardfile/hybridPresentation';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { admitDriftwoodRows, driftwoodRows } from './boot/rows';

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

/** Driftwood owns its world, creatures, loadout, adventure and audio through scoped hooks. */
export class DriftwoodPlugin extends ShardPlugin {
  private readonly adventure: { value: Adventure | null } = { value: null };
  override async world(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood plugin requires its world host');
    const world = shell.world;
    const viewer = shell.viewer, progress = buildProgress(ctx);
    if (world === null) throw new Error('Driftwood world requires the bootstrapped world');
    const resident = boundResidentWorldScope(ctx.scope);
    let built: DriftwoodWorld;
    if (resident === undefined) {
      const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'));
      built = await buildDriftwoodWorld(world, viewer, progress, scenes, await residentBakedTiles(ctx, ctx.scope));
    } else {
      admitDriftwoodRows(ctx.product);
      built = await residentWorld(ctx).load(ctx, async owner => {
        lendLooks(owner, await runtimeLookMaterials({ scope: owner, game: ctx.game }, ctx.product.shardfile, true, [...Object.values(driftwoodRows('custom/fixedLayouts').nativeView.CASCADE_LOOKS), driftwoodRows('custom/fixedLayouts').nativeView.SMOKE_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.FIREFLY_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.REEF_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.POOL_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.SHRINE_POOL_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.OCEAN_LOOK, driftwoodRows('custom/fixedLayouts').nativeView.GULL_GRAPH_LOOK, ...driftwoodRows('custom/fixedLayouts').nativeView.COVER_LOOKS, ...Object.values(driftwoodRows('custom/fixedLayouts').nativeView.CREATURE_LOOKS)]));
        const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), owner), baked = await residentBakedTiles(ctx, owner);
        return buildDriftwoodWorld(world, viewer, progress, scenes, baked);
      });
    }
    if (ctx.scope.disposed) throw new Error('Driftwood Isle was unloaded during its world build');
    keepDriftwoodWorld(shell, built);
    shell.hooks.meleeSilent = true;
    const { pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove, palmSpecs } = built;
    Object.assign(shell.objects, { pier, jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove, palmSpecs });
    shell.hooks.spawnFloor = (x, z) => pier.floorHeightAt(x, z);
    shell.overhead.push(gulls.group, built.cover.group);
    shell.hooks.places = () => this.adventure.value?.places?.points ?? [];
    islandSystems<DriftwoodWorld['bridgeDeck']>(ctx, world, built); // the island's per-frame work (./world/systems.ts)
    await installPageLife(ctx, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await ctx.product.file('actors/page-life.json'))), null, null, new Map([['gulls', gulls]]));
  }

  override async kit(ctx: ShardContext): Promise<void> {
    const shell = ctx.game.runtime;
    if (shell === undefined) throw new Error('Driftwood kit requires its world host');
    if (shell.world === null) throw new Error('Driftwood kit requires its world host');
    const held = await HeldClaims.prepare(ctx);
    await installDriftwoodCreatures(ctx,await pageDecisionAuthority(ctx));
    held.install();
  }


  override async play(ctx: ShardContext): Promise<void> {
    // Warm the actual finale memory after audio, then install the same adventure in its owner.
    const director = await readDirectorProduct(ctx.product, ctx.scope);
    ctx.scope.expose(this.adventure, 'value', await withPreparedScriptMemories([director.bytes], ctx.scope,
      null, () => installDriftwoodAdventure(ctx)));
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default DriftwoodPlugin;
