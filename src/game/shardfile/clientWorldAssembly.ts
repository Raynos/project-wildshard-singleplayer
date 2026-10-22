/** Enter the declared book through the existing native construction authorities. */
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import { WorldEntry } from './worldEntry';
import type { SceneHandles } from './sceneHandles';
import { publishClientSceneHandles } from './clientSceneHandles';
import type { IslandLibrary } from '../models/islandLibrary';
import type { ShardProduct } from './shardProduct';
import { buildProgress, type ShardContext } from '../plugin/context';
import { admittedIslandBook, preflightIslandBook } from './islandBook';
import { WorldAssembly } from './worldAssembly';
import { HybridResidentWorld } from './hybrid';
import { boundResidentWorldScope } from './hybridPresentation';
import { runtimeLookMaterials } from './runtimeProduct';
import { lendLooks } from './lentLooks';
import { installWorldScenes } from './worldScenes';
import { residentBakedTiles } from './bakedTiles';
import { publishEntryOwner, lendEntryOwner, entryOwner } from './entryOwners';

const enteredScopes = new WeakSet<ShardContext['scope']>();
const residents = new WeakMap<IslandLibrary<unknown> | ShardProduct, {
  readonly recipe: string; readonly scenes: unknown; readonly world: HybridResidentWorld<SceneHandles>;
}>();
/** Construction remains on its original bound owner; entered reads borrow only
 * after it completes. Leaving an entry never cancels a still-live resident. */
export async function installClientWorldAssembly(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'world.assembly' }>): Promise<void> {
  const { product, scope } = ctx, runtime = ctx.game.runtime, resident = boundResidentWorldScope(scope);
  if (runtime?.world === undefined || runtime.world === null) throw new Error('Island assembly needs its native world');
  const world = runtime.world, progress = buildProgress(ctx), source = product.shardfile, sceneRows = product.section('world/scenes'), cube = ctx.cube;
  const read = product.file, json = product.json, piece = row.entered === undefined ? undefined : ctx.piece;
  const { game, registry, sky, physics } = world;
  const live = (): void => {
    if (scope.disposed || scope.disposing || boundResidentWorldScope(scope) !== resident || resident?.disposed === true || resident?.disposing === true
      || piece !== undefined && ctx.piece !== piece || ctx.product !== product || product.shardfile !== source || product.file !== read || product.json !== json || product.section('world/scenes') !== sceneRows || ctx.cube !== cube || ctx.game.runtime !== runtime || runtime.world !== world || world.game !== game || world.registry !== registry || world.sky !== sky || world.physics !== physics) throw new Error('Island entry owner left or changed');
  };
  live(); preflightIslandBook(product, row);
  if (row.entered !== undefined && enteredScopes.has(scope)) throw new Error('World assembly pieces already entered');
  const libraryId = row.library;
  const book = libraryId === undefined ? undefined : await scope.run(() => admittedIslandBook(product, libraryId)); live();
  const construction = row.rows.construction;
  if (construction?.looks === undefined) throw new Error('World construction metadata missing');
  const { looks, publish } = construction;
  const build = async (owner: ShardContext['scope'], bound: boolean): Promise<SceneHandles> => {
    const check = (): void => {
      if (owner.disposed || owner.disposing || product.shardfile !== source || product.file !== read || product.json !== json || product.section('world/scenes') !== sceneRows || runtime.world !== world || ctx.game.runtime !== runtime || ctx.product !== product || world.game !== game || world.registry !== registry || world.sky !== sky || world.physics !== physics) throw new Error('Island construction owner left or changed');
    };
    check();
    const materials = await runtimeLookMaterials({ scope: owner, game: ctx.game }, product.shardfile, true, bound ? looks.bound : looks.unbound); check();
    lendLooks(owner, materials);
    const scenes = await installWorldScenes(ctx, sceneRows, owner); check();
    const baked = book === undefined ? new Map() : await residentBakedTiles(ctx, owner); check();
    const variant = construction.variant?.[cube === null ? 'standalone' : 'cell'];
    await WorldAssembly.construct(row.rows, { runtime, product, scope: owner, scenes, baked, progress,
      ...(book === undefined ? {} : { library: book.library, sites: book.sites }), ...(variant === undefined ? {} : { variant }) }); check();
    if (book !== undefined && publish !== undefined) {
      publishEntryOwner(owner, 'collection', publish.collection, book.library.collections);
      publishEntryOwner(owner, 'fixed-draws', publish.draws, book.library.loaded());
    }
    return scenes;
  };
  let scenes: SceneHandles;
  if (resident === undefined) scenes = await build(scope, false);
  else {
    const key = book?.library ?? product, recipe = JSON.stringify(row);
    let cached = residents.get(key);
    if (cached !== undefined && (cached.recipe !== recipe || cached.scenes !== sceneRows)) throw new Error('World assembly declaration changed');
    if (cached === undefined) { cached = { recipe, scenes: sceneRows, world: new HybridResidentWorld<SceneHandles>() }; residents.set(key, cached); }
    scenes = await cached.world.load(ctx, owner => build(owner, true));
  }
  live(); publishClientSceneHandles(product, resident ?? scope, scenes); WorldAssembly.lend(row.rows, resident ?? scope, scope);
  if (row.entered !== undefined) {
    const entryRows = sceneRows.entry;
    if (entryRows === undefined || piece === undefined) throw new Error('World assembly entered pieces missing');
    const root = entryOwner(scope, 'object', row.entered.root), variant = construction.variant?.[cube === null ? 'standalone' : 'cell'];
    const entry = WorldEntry.admit(entryRows, { root, scope, tier: game.tier, ...(variant === undefined ? {} : { variant }), piece: value => { ctx.piece(value); }, fence: live });
    enteredScopes.add(scope); scope.onDispose(() => { enteredScopes.delete(scope); });
    for (const block of row.entered.blocks) { live(); await entry.run(block); live(); }
  }
  if (resident !== undefined && publish !== undefined) {
    lendEntryOwner(scope, resident, 'fixed-draws', publish.draws);
    lendEntryOwner(scope, resident, 'collection', publish.collection);
  }
}
