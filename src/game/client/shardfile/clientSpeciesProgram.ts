import { object, parse, pick } from 'valibot';
import { SpeciesPresentationSchema } from '@wildshard/format/speciesBookRows';
import { productSpeciesCatalogueSliced } from '../looks/speciesBook';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { entryOwner, presentEntryOwner, publishEntryOwner } from '../../shared/shardfile/entryOwners';
import { ClientSpeciesProgramSchema } from '@wildshard/format/clientNative';
import type { ShardContext } from '../plugin/context';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { bindPlayerImpulse } from '../../shared/shardfile/dataCreaturePorts';
import { pageSim, rowDecisions } from './clientMoverOwners';
import { clientNativeBook } from './clientNativeBook';
import { sceneModelSource } from './sceneSources';

/** Prepare the approved speciesBook catalogue once for world and kit consumers. */
export async function prepareClientSpeciesCatalogue(ctx: ShardContext, input: unknown): Promise<void> {
  const row = parse(ClientSpeciesProgramSchema, input), source = row.catalogue;
  if (source === undefined) throw new Error('Species catalogue source is missing');
  const scope = ctx.scope, product = ctx.product, runtime = ctx.game.runtime, world = runtime?.world;
  const live = (): void => {
    if (scope.disposed || scope.disposing || ctx.scope !== scope || ctx.product !== product || ctx.game.runtime !== runtime
      || world === undefined || world === null || runtime?.world !== world) throw new Error('Species catalogue owner changed');
  };
  live();
  if (presentEntryOwner(scope, 'species', source.owner) !== null) throw new Error('Species catalogue is already prepared');
  const actors = parse(object({species: pick(SpeciesPresentationSchema, ['lookBook'])}), await product.json<unknown>(source.actors)); live();
  const looks = await product.json<unknown>(source.looks); live();
  const catalogue = await productSpeciesCatalogueSliced(product, actors.species, looks, () => buildYield(scope)); live();
  publishEntryOwner(scope, 'species', source.owner, catalogue);
}

/** Compiled species.program feature. Registration, native policy and rendered
 * rigs are the original owners; a body's decisions are its row's. */
export async function installClientSpeciesProgram(ctx: ShardContext, input: unknown): Promise<void> {
  const row = parse(ClientSpeciesProgramSchema, input);
  if (row.catalogue !== undefined) { entryOwner(ctx.scope, 'species', row.catalogue.owner).install(ctx.rows); return; }
  if (row.library === undefined) throw new Error('Species program library is missing');
  const book = clientNativeBook(ctx), product = ctx.product;
  if (book.brains !== null) throw new Error('Species program is already installed');
  const declared = product.section('actors/species-programs');
  if (declared.program === undefined) throw new Error('Species feature needs its admitted program');
  const library = sceneModelSource(product, row.library);
  await library.preloadRigs();
  if (ctx.scope.disposed) throw new Error('Species preparation left its entered owner');
  const brains = pageSim.admitSpeciesProgram(declared.program);
  const impulse = bindPlayerImpulse(velocity => { ctx.app.player?.impulse(velocity); }).directed;
  let push: typeof impulse | null = null;
  if (row.shove) installEnteredRuntimeService(ctx, scope => { push = impulse; scope.onDispose(() => { push = null; }); });
  const catalogue = brains.catalogue(declared.page, {
    decisions: rowDecisions,
    ...(row.homes === undefined ? {} : { homes: row.homes }),
    ...(row.shove ? { held: { shove: (yaw: number, speed: number, lift: number) => { push?.(yaw, speed, lift); } } } : {}),
  });
  book.brains = brains; book.catalogue = catalogue;
  ctx.rows.species(catalogue.rows); ctx.rows.speciesLook(library.looks);
  const encounter = product.section('sim/runtime-plan').recipe.population.owner;
  ctx.rows.encounter({ id: encounter.actor, displayName: encounter.definition.name });
}
