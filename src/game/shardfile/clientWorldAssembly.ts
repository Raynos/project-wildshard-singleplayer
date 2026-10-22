/** Enter the declared book through the existing native construction authorities. */
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { IslandLibrary } from '../models/islandLibrary';
import { buildProgress, type ShardContext } from '../plugin/context';
import { admittedIslandBook, preflightIslandBook } from './islandBook';
import { WorldAssembly } from './worldAssembly';
import { HybridResidentWorld } from './hybrid';
import { boundResidentWorldScope } from './hybridPresentation';
import { runtimeLookMaterials } from './runtimeProduct';
import { lendLooks } from './lentLooks';
import { installWorldScenes } from './worldScenes';
import { residentBakedTiles } from './bakedTiles';
import { publishEntryOwner, lendEntryOwner } from './entryOwners';

const residents = new WeakMap<IslandLibrary<unknown>, HybridResidentWorld<void>>();
/** Construction remains on its original bound owner; entered reads borrow only
 * after it completes. Leaving an entry never cancels a still-live resident. */
export async function installClientWorldAssembly(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: 'world.assembly' }>): Promise<void> {
  const { product, scope } = ctx, runtime = ctx.game.runtime, resident = boundResidentWorldScope(scope);
  if (runtime?.world === undefined || runtime.world === null) throw new Error('Island assembly needs its native world');
  const world = runtime.world, progress = buildProgress(ctx);
  const { game, registry, sky, physics } = world;
  const live = (): void => {
    if (scope.disposed || scope.disposing || boundResidentWorldScope(scope) !== resident || resident?.disposed === true || resident?.disposing === true
      || ctx.product !== product || ctx.game.runtime !== runtime || runtime.world !== world || world.game !== game || world.registry !== registry || world.sky !== sky || world.physics !== physics) throw new Error('Island entry owner left or changed');
  };
  live(); preflightIslandBook(product, row);
  const book = await scope.run(() => admittedIslandBook(product, row.library)); live();
  const construction = row.rows.construction;
  if (construction?.looks === undefined || construction.publish === undefined) throw new Error('Island construction metadata missing');
  const { looks, publish } = construction;
  const build = async (owner: ShardContext['scope'], bound: boolean): Promise<void> => {
    const check = (): void => {
      if (owner.disposed || owner.disposing || runtime.world !== world || ctx.game.runtime !== runtime || ctx.product !== product || world.game !== game || world.registry !== registry || world.sky !== sky || world.physics !== physics) throw new Error('Island construction owner left or changed');
    };
    check();
    const materials = await runtimeLookMaterials({ scope: owner, game: ctx.game }, product.shardfile, true, bound ? looks.bound : looks.unbound); check();
    lendLooks(owner, materials);
    const scenes = await installWorldScenes(ctx, product.section('world/scenes'), owner); check();
    const baked = await residentBakedTiles(ctx, owner); check();
    await WorldAssembly.construct(row.rows, { runtime, product, scope: owner, scenes, baked, library: book.library, sites: book.sites, progress }); check();
    publishEntryOwner(owner, 'collection', publish.collection, book.library.collections);
    publishEntryOwner(owner, 'fixed-draws', publish.draws, book.library.loaded());
  };
  if (resident === undefined) await build(scope, false);
  else {
    let cached = residents.get(book.library);
    if (cached === undefined) { cached = new HybridResidentWorld<void>(); residents.set(book.library, cached); }
    await cached.load(ctx, owner => build(owner, true));
  }
  live(); WorldAssembly.lend(row.rows, resident ?? scope, scope);
  if (resident !== undefined) {
    lendEntryOwner(scope, resident, 'fixed-draws', publish.draws);
    lendEntryOwner(scope, resident, 'collection', publish.collection);
  }
}
