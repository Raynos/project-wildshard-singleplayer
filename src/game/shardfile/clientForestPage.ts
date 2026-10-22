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
 * Rows name product files and ids only; no shard module, callback or selector. Every installer stops when its owner
 * retires (it left, or an ancestor is retiring in slices): before any allocation and after every awaited read, and the
 * borrowed owners (the cave, the ranged page) are resolved after a read, never held across one.
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

/** The platform owners the installers drive (tests pass fakes in; E422: no module mocks). */
export const FOREST_PAGE_PORTS = {
  prepareForestPageLooks, bindPageWater, prepareForestPage, placeForestPageModels, punchPageTerrain, lendLooks, runtimeLookMaterials,
  library: (product: ShardContext['product'], name: string): ReturnType<typeof PosedDraw.library> => PosedDraw.library(product, name),
  loadCave: (rows: unknown, cap: number): Promise<CaveInterior> => CaveInterior.load(rows, cap),
  installForestWeather, installPageLife, rangedPage, entryOwner, publishEntryOwner,
};
export type ForestPagePorts = typeof FOREST_PAGE_PORTS;

/** The feature's owner retired: it left, or an ancestor is retiring in slices. */
const ended = (ctx: ShardContext): boolean => ctx.scope.disposed || ctx.scope.disposing;

/** Build the declared forest page (and its cave) in the entered world phase. */
export async function installClientForestPage(ctx: ShardContext, row: ForestPageRow, ports: ForestPagePorts = FOREST_PAGE_PORTS): Promise<void> {
  const runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null) throw new Error('Forest page requires its world');
  if (ended(ctx)) return;
  const input = await ctx.product.json<ForestPageRows>(row.file); if (ended(ctx)) return;
  await ports.prepareForestPageLooks(ctx, input); if (ended(ctx)) return;
  ports.bindPageWater(ctx, input.water);
  const wildlife = await ports.library(ctx.product, input.wildlife); if (ended(ctx)) return;
  const looks = await ports.runtimeLookMaterials(ctx, ctx.product.shardfile, true, [wildlife.name]); if (ended(ctx)) return;
  ports.lendLooks(ctx.scope, looks);
  const page = await ports.prepareForestPage(ctx, input); if (ended(ctx)) return;
  const id = page.rows.id;
  ports.publishEntryOwner(ctx.scope, 'forest', id, page);
  let cave: CaveInterior | null = null;
  if (row.cave !== undefined) {
    const rows = await ctx.product.json(row.cave.file); if (ended(ctx)) return;
    const loaded = await ports.loadCave(rows, pageModeCap(row.cave.cap, TIER_CONFIG.maxTexture)); if (ended(ctx)) return;
    const fx = new Group(); fx.name = `${id}:cave-fx`; loaded.buildFx(); fx.add(...loaded.fx);
    world.registry.add({ id: `${id}:cave-fx`, name: 'Cave lights', category: 'props', file: 'src/game/shardfile/caveInterior.ts', object: fx });
    await macrotask(); if (ended(ctx)) return;
    world.registry.add({ id: `${id}:cave`, name: 'Cave', category: 'nature', file: 'src/game/shardfile/caveInterior.ts', colliders: [...loaded.shell, ...loaded.roofPatch()], surface: 'rock' });
    ports.publishEntryOwner(ctx.scope, 'cave', id, loaded);
    await ports.punchPageTerrain(ctx, loaded.cutRows()); if (ended(ctx)) return;
    cave = loaded;
  }
  await page.finish(); if (ended(ctx)) return;
  await ports.placeForestPageModels(ctx, id); if (ended(ctx)) return;
  const previous = runtime.hooks.worldUpdate, interior = cave;
  const update = (dt: number, time: number): void => { previous?.(dt, time); page.update(dt, time); interior?.presentFrame(time, world.sky); };
  runtime.hooks.worldUpdate = update;
  ctx.scope.onDispose(() => {
    if (runtime.hooks.worldUpdate !== update) return;
    if (previous === undefined) delete runtime.hooks.worldUpdate; else runtime.hooks.worldUpdate = previous;
  });
}

/** Play stage: the cave's ambience spots on the ranged page (before the weather and life build, as they always were). */
export async function enterClientForestPage(ctx: ShardContext, row: ForestPageRow, ports: ForestPagePorts = FOREST_PAGE_PORTS): Promise<void> {
  const spots = row.cave?.spots; if (spots === undefined || ended(ctx)) return;
  const input = await ctx.product.json<ForestPageRows>(row.file); if (ended(ctx)) return;
  const cave = ports.entryOwner(ctx.scope, 'cave', input.id), ambience = ports.rangedPage(ctx.scope, spots.ranged).ambience, rows = cave.spots();
  for (let i = 0; i < Math.min(rows.length, spots.max); i++) { const spot = rows[i]; if (spot !== undefined) ambience.addSpot({ zone: spots.zone, ...spot, fade: spots.fade }); }
}

/** The page's whole weather. */
export async function installClientForestWeather(ctx: ShardContext, file: string, ports: ForestPagePorts = FOREST_PAGE_PORTS): Promise<void> {
  if (ended(ctx)) return;
  const rows = await ctx.product.json(file); if (ended(ctx)) return;
  await ports.installForestWeather(ctx, rows);
}

/** The page's ambient life, on the ranged page's compendium state and sounds: the ranged page is resolved after the read
 *  and rechecked after the build, so a replaced or retired owner publishes nothing. */
export async function installClientPageLife(ctx: ShardContext, row: PageLifeRow, ports: ForestPagePorts = FOREST_PAGE_PORTS): Promise<void> {
  const runtime = ctx.game.runtime; if (runtime === undefined) throw new Error('Page life requires its runtime');
  if (ended(ctx)) return;
  const rows = await ctx.product.json(row.file); if (ended(ctx)) return;
  const page = ports.rangedPage(ctx.scope, row.ranged);
  const life = await ports.installPageLife(ctx, rows, page.compendium?.state ?? null, page.ambience.sfx);
  if (ended(ctx) || ports.rangedPage(ctx.scope, row.ranged) !== page) return;
  if (row.object !== undefined) {
    const key = row.object; runtime.objects[key] = life;
    ctx.scope.onDispose(() => { if (runtime.objects[key] === life) delete runtime.objects[key]; });
  }
}
