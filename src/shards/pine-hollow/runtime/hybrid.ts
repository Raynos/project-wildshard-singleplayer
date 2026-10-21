/** Counted custom view binding around data-only native page contracts. */
import { ShardPlugin, type ShardContext } from '@wildshard/game/plugin/context';
import { prepareForestPage, prepareForestPageLooks, placeForestPageModels } from '@wildshard/game/shardfile/forestPage';
import { punchPageTerrain } from '@wildshard/game/shardfile/pagePreparation';
import { bindPageWater } from '@wildshard/game/shardfile/pageWater';
import type { ForestPageRows } from '@wildshard/format/forestPage';
import type { RangedPageRows } from '@wildshard/format/rangedPage';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { PosedDraw } from '@wildshard/sdk/looks/posedInstances';
import { preparePineModelViews } from './models/antlerKing';
import { installPineLandmarks, type PineLandmarks } from './world/landmarks';

export class PineHollow extends ShardPlugin {
  private landmarks: PineLandmarks | null = null;
  override async world(ctx: ShardContext): Promise<void> {
    const input = await ctx.product.json<ForestPageRows>('world/forest-page.json'), world = ctx.game.runtime?.world;
    if (world === undefined || world === null) throw new Error('Missing forest world');
    await prepareForestPageLooks(ctx, input); bindPageWater(ctx, input.water);
    const wildlife = await PosedDraw.library(ctx.product, input.wildlife);
    lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [wildlife.name]));
    const floor = await prepareForestPage(ctx, input);
    const landmarks = this.landmarks = await installPineLandmarks({ sky: world.sky, registry: world.registry });
    const cave = landmarks.crags?.cave; if (cave !== undefined) await punchPageTerrain(ctx, cave.cutRows());
    await floor.finish(); await placeForestPageModels(ctx, floor.rows.id);
    const runtime = ctx.game.runtime; if (runtime === undefined) throw new Error('Missing forest runtime'); runtime.hooks.worldUpdate = (dt, time) => { floor.update(dt, time); landmarks.update(dt, time); };
  }
  override async kit(ctx: ShardContext): Promise<void> { await preparePineModelViews(ctx); }
  override async play(ctx: ShardContext): Promise<void> {
    if (this.landmarks === null) throw new Error('Missing landmark views');
    await this.landmarks.installChapter(ctx, await ctx.product.json<RangedPageRows>('client/ranged-page.json'));
  }
}
// oxlint-disable-next-line import/no-default-export -- The trusted loader consumes the counted view constructor.
export default PineHollow;
