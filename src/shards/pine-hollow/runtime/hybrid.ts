/** Counted custom view binding around data-only native page contracts. */
import { ShardPlugin, type ShardContext } from '@wildshard/game/plugin/context';
import { prepareForestPage, prepareForestPageLooks, placeForestPageModels } from '@wildshard/game/shardfile/forestPage';
import { preparePageScripts, punchPageTerrain } from '@wildshard/game/shardfile/pagePreparation';
import { bindPageWater } from '@wildshard/game/shardfile/pageWater';
import { prepareRangedPage } from '@wildshard/game/loadout/rangedPage';
import type { ForestPageRows } from '@wildshard/format/forestPage';
import type { RangedPageRows } from '@wildshard/format/rangedPage';
import { runtimeLookMaterials } from '@wildshard/game/shardfile/runtimeProduct';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { registerPackedGeometrySource } from '@wildshard/sdk/models/geometrySources';
import { PosedDraw } from '@wildshard/sdk/looks/posedInstances';
import { preparePineModelViews } from './models/antlerKing';
import { admitPineView } from './world/context';
import { installPineLandmarks, type PineLandmarks } from './world/landmarks';

export class PineHollow extends ShardPlugin {
  private landmarks: PineLandmarks | null = null;
  override async world(ctx: ShardContext): Promise<void> {
    const rows = await ctx.product.json<RangedPageRows>('client/ranged-page.json'), finish = ctx.product.section('held/finishes').source;
    if (finish === undefined) throw new Error('Missing declared finish geometry');
    registerPackedGeometrySource(ctx.scope, rows.finishSource, { ...finish, label: 'held finishes' });
    registerPackedGeometrySource(ctx.scope, rows.collection.source, { url: ctx.product.url(rows.collection.pack.url), rows: rows.collection.pack.rows, label: 'trophy-wall' });
    await Promise.all([prepareRangedPage(ctx, rows), admitPineView(ctx.product)]);
    const input = await ctx.product.json<ForestPageRows>('world/forest-page.json'), world = ctx.game.runtime?.world;
    if (world === undefined || world === null) throw new Error('Missing forest world');
    await prepareForestPageLooks(ctx, input); bindPageWater(ctx, input.water);
    const wildlife = await PosedDraw.library(ctx.product, input.wildlife);
    lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [wildlife.name]));
    const floor = await prepareForestPage(ctx, input);
    const landmarks = this.landmarks = await installPineLandmarks({ sky: world.sky, registry: world.registry, cabins: floor.cabins, scenes: floor.resources });
    const cave = landmarks.crags?.cave; if (cave !== undefined) await punchPageTerrain(ctx, cave.cutRows());
    await floor.finish(); await placeForestPageModels(ctx, floor.rows.id);
    const runtime = ctx.game.runtime; if (runtime === undefined) throw new Error('Missing forest runtime'); runtime.hooks.worldUpdate = (dt, time) => { floor.update(dt, time); landmarks.update(dt, time); };
  }
  override async kit(ctx: ShardContext): Promise<void> { await preparePineModelViews(ctx); }
  override async play(ctx: ShardContext): Promise<void> {
    const release = await preparePageScripts(ctx, { modules: ['behaviour/director.wasm'], yield: 'frame' });
    try {
      if (this.landmarks === null) throw new Error('Missing landmark views');
      await this.landmarks.installChapter(ctx, await ctx.product.json<RangedPageRows>('client/ranged-page.json'));
    } finally { release(); }
  }
}
// oxlint-disable-next-line import/no-default-export -- The trusted loader consumes the counted view constructor.
export default PineHollow;
