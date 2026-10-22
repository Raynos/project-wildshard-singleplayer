/**
 * G571 client features over a shard's declared forest page (Pine Hollow first; client-only):
 *
 * - `world.forest-page` (world): the page's looks, water, posed wildlife looks, the page itself, its optional cave
 *   (interior at the page-mode texture cap, fx, shell colliders, the cave's cut through the page terrain), the page's
 *   landmarks and props, and both updates on the world update. Lends `forest` and `cave` under the page's own id.
 *   Its play stage adds the cave's ambience spots to the ranged page before weather and life build (their old order).
 * - `weather.forest` (play): the page's whole weather (game/weather/forest).
 * - `page.life` (play): the page's ambient life on the ranged page's compendium and sounds (game/population/pageLife).
 *
 * Rows name product files and ids only; no shard module, callback or selector.
 */
import { Group } from 'three';
import { macrotask } from '@wildshard/engine/boot/plan';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ForestPageRows } from '@wildshard/format/forestPage';
import type { ShardContext } from '../plugin/context';
import { pageModeCap } from '../shard/pagePolicy';
import { PosedDraw } from '../looks/posedInstances';
import { rangedPage } from '../loadout/rangedPage';
import { installForestWeather } from '../weather/forest';
import { installPageLife } from '../population/pageLife';
import { CaveInterior } from './caveInterior';
import { entryOwner, publishEntryOwner } from './entryOwners';
import { placeForestPageModels, prepareForestPage, prepareForestPageLooks } from './forestPage';
import { lendLooks } from './lentLooks';
import { punchPageTerrain } from './pagePreparation';
import { bindPageWater } from './pageWater';
import { runtimeLookMaterials } from './runtimeProduct';

type ForestPageRow = Extract<ClientFeatureRow, { kind: 'world.forest-page' }>;
type PageLifeRow = Extract<ClientFeatureRow, { kind: 'page.life' }>;

/** Build the declared forest page (and its cave) in the entered world phase. */
export async function installClientForestPage(ctx: ShardContext, row: ForestPageRow): Promise<void> {
  const runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null) throw new Error('Forest page requires its world');
  const input = await ctx.product.json<ForestPageRows>(row.file);
  await prepareForestPageLooks(ctx, input); bindPageWater(ctx, input.water);
  const wildlife = await PosedDraw.library(ctx.product, input.wildlife);
  lendLooks(ctx.scope, await runtimeLookMaterials(ctx, ctx.product.shardfile, true, [wildlife.name]));
  const page = await prepareForestPage(ctx, input), id = page.rows.id;
  publishEntryOwner(ctx.scope, 'forest', id, page);
  let cave: CaveInterior | null = null;
  if (row.cave !== undefined) {
    cave = await CaveInterior.load(await ctx.product.json(row.cave.file), pageModeCap(row.cave.cap, TIER_CONFIG.maxTexture));
    const fx = new Group(); fx.name = `${id}:cave-fx`; cave.buildFx(); fx.add(...cave.fx);
    world.registry.add({ id: `${id}:cave-fx`, name: 'Cave lights', category: 'props', file: 'src/game/shardfile/caveInterior.ts', object: fx });
    await macrotask();
    world.registry.add({ id: `${id}:cave`, name: 'Cave', category: 'nature', file: 'src/game/shardfile/caveInterior.ts', colliders: [...cave.shell, ...cave.roofPatch()], surface: 'rock' });
    publishEntryOwner(ctx.scope, 'cave', id, cave);
    await punchPageTerrain(ctx, cave.cutRows());
  }
  await page.finish(); await placeForestPageModels(ctx, id);
  const previous = runtime.hooks.worldUpdate, interior = cave;
  const update = (dt: number, time: number): void => { previous?.(dt, time); page.update(dt, time); interior?.presentFrame(time, world.sky); };
  runtime.hooks.worldUpdate = update;
  ctx.scope.onDispose(() => {
    if (runtime.hooks.worldUpdate !== update) return;
    if (previous === undefined) delete runtime.hooks.worldUpdate; else runtime.hooks.worldUpdate = previous;
  });
}

/** Play stage: the cave's ambience spots on the ranged page (before the weather and life build, as they always were). */
export async function enterClientForestPage(ctx: ShardContext, row: ForestPageRow): Promise<void> {
  const spots = row.cave?.spots; if (spots === undefined) return;
  const input = await ctx.product.json<ForestPageRows>(row.file), cave = entryOwner(ctx.scope, 'cave', input.id);
  const ambience = rangedPage(ctx.scope, spots.ranged).ambience, rows = cave.spots();
  for (let i = 0; i < Math.min(rows.length, spots.max); i++) { const spot = rows[i]; if (spot !== undefined) ambience.addSpot({ zone: spots.zone, ...spot, fade: spots.fade }); }
}

/** The page's whole weather. */
export async function installClientForestWeather(ctx: ShardContext, file: string): Promise<void> {
  await installForestWeather(ctx, await ctx.product.json(file));
}

/** The page's ambient life, on the ranged page's compendium state and sounds. */
export async function installClientPageLife(ctx: ShardContext, row: PageLifeRow): Promise<void> {
  const runtime = ctx.game.runtime; if (runtime === undefined) throw new Error('Page life requires its runtime');
  const page = rangedPage(ctx.scope, row.ranged);
  const life = await installPageLife(ctx, await ctx.product.json(row.file), page.compendium?.state ?? null, page.ambience.sfx);
  if (row.object !== undefined) {
    const key = row.object; runtime.objects[key] = life;
    ctx.scope.onDispose(() => { if (runtime.objects[key] === life) delete runtime.objects[key]; });
  }
}
