import { parse } from 'valibot';
import { ClientSpeciesProgramSchema } from '@wildshard/format/clientNative';
import { parseDecisionScripts } from '@wildshard/format/decisionScripts';
import { floorBelow } from '@wildshard/engine/physics/query';
import { admitSpeciesProgram } from '../plugin/brain';
import type { ShardContext } from '../plugin/context';
import { installEnteredRuntimeService } from '../shard/retainedHooks';
import { bindPlayerImpulse } from './dataCreaturePorts';
import { borrowedDecisionAuthority } from './borrowedDecisions';
import { clientNativeBook } from './clientNativeBook';
import { outputDescriptor } from './outputDescriptor';
import { sceneModelSource } from './sceneSources';

/** Compiled species.program feature. Registration, native policy and rendered
 * rigs are the original owners; decisions borrow those actual live bodies. */
export async function installClientSpeciesProgram(ctx: ShardContext, input: unknown): Promise<void> {
  const row = parse(ClientSpeciesProgramSchema, input), book = clientNativeBook(ctx), product = ctx.product;
  if (book.brains !== null) throw new Error('Species program is already installed');
  const source = product.shardfile, declared = product.section('actors/species-programs');
  const descriptor = outputDescriptor(source);
  if (declared.program === undefined || descriptor === undefined) throw new Error('Species feature needs its admitted program and product');
  const library = sceneModelSource(product, row.library);
  await library.preloadRigs();
  await Promise.all(parseDecisionScripts(product.section('sim/scripts')).filter(script => script.side === 'sim').map(async script => {
    const hash = script.module.slice('blobs/wasm/'.length, -'.wasm'.length), file = descriptor.index.files.find(candidate => candidate.hash === hash);
    if (file?.name === undefined) throw new Error('Species decision needs its admitted logical file');
    book.decisionAssets.set(hash, await product.file(file.name));
  }));
  if (ctx.scope.disposed) throw new Error('Species preparation left its entered owner');
  const brains = admitSpeciesProgram(declared.program);
  const impulse = bindPlayerImpulse(velocity => { ctx.app.player?.impulse(velocity); }).directed;
  let push: typeof impulse | null = null;
  if (row.shove) installEnteredRuntimeService(ctx, scope => { push = impulse; scope.onDispose(() => { push = null; }); });
  const catalogue = brains.catalogue(declared.page, {
    decisions: { bind: (actor, decision, body) => {
      const world = ctx.game.runtime?.world, physics = ctx.app.physics, health = ctx.app.player, quest = book.quest;
      if (world === null || world === undefined || physics === null || health === null || quest === null)
        throw new Error('Decision body needs its actual world, player and quest');
      book.decisions ??= borrowedDecisionAuthority(source, book.decisionAssets, descriptor.sections, {
        scope: ctx.scope, events: ctx.app.events, flags: quest.flags, physics,
        player: { id: health.id, position: world.player.position, get yaw() { return world.player.yaw; }, health, motor: world.player.motor },
        groundHeightAt: (x, z) => {
          const y = floorBelow(physics, x, z, world.player.position.y + 500, 1000);
          if (y === undefined) throw new Error('Decision ground query has no floor'); return y;
        },
        live: candidate => ctx.game.runtime?.play?.animals.animals.some(value => value === candidate) === true,
        fixed: (id, run, scope) => { ctx.app.addSystem({ id, phase: 'fixed.post', when: () => !scope.disposed && ctx.app.state === 'play', run }, scope); },
      });
      return book.decisions.bind(actor, decision, body);
    } },
    ...(row.homes === undefined ? {} : { homes: row.homes }),
    ...(row.shove ? { held: { shove: (yaw: number, speed: number, lift: number) => { push?.(yaw, speed, lift); } } } : {}),
  });
  book.brains = brains; book.catalogue = catalogue;
  ctx.rows.species(catalogue.rows); ctx.rows.speciesLook(library.looks);
  const encounter = product.section('sim/runtime-plan').recipe.population.owner;
  ctx.rows.encounter({ id: encounter.actor, displayName: encounter.definition.name });
}
