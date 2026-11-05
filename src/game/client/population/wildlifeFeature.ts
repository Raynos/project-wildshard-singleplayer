import { macrotask } from '@wildshard/engine/boot/plan';
import { buildYield } from '@wildshard/engine/core/workSlice';
import { wind } from '@wildshard/engine/world/steppeWind';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { RayTargets } from '@wildshard/engine/combat/targets';
import type { SpeciesActorsFileRows } from '@wildshard/format/speciesBookRows';
import { WildlifePopulationSchema } from '@wildshard/format/wildlifePopulation';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { Vector3 } from 'three';
import * as v from 'valibot';
import type { PageWildlife } from '../../server/population/wildlife';
import { ReturnProgram } from '../../shared/population/returnProgram';
import { clientWildlifeLent, retireClientWildlife } from '../../shared/population/wildlifeOwner';
import { pageRidingMounted } from '../../shared/riding/entered';
import { installDeclaredCrowdFrames } from '../../shared/shardfile/crowdRuntime';
import type { CrowdDraw } from '../ambient/crowdDraw';
import { prepareForagerDraw, type ForagerDraw } from '../ambient/foragerDraw';
import { createPageCrowds } from '../ambient/pageCrowds';
import { fixedDraws } from '../models/fixedDraws';
import type { ShardContext } from '../plugin/context';
import { pageSim } from '../shardfile/clientMoverOwners';

/** Client-only lifecycle adapter for the existing population host. Admitted
 * files select geometry and population rows; native owners retain all clocks. */
export async function installClientWildlife(ctx: ShardContext, feature: ClientFeatureRow): Promise<void> {
  if (feature.kind !== 'population.wildlife' || ctx.scope.disposed || clientWildlifeLent(ctx.scope)) throw new Error('Invalid wildlife feature owner');
  const runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null || runtime.hooks.animalsBuilt !== undefined) throw new Error('Wildlife requires its unbound world animal stage');
  const rows = v.parse(WildlifePopulationSchema, await ctx.product.json(feature.file));
  // Resolve the named wet loan before publishing any entered population owner.
  const wet=rows.groups.world.wet,wetFile=typeof wet==='string'||typeof wet.data==='string'?undefined:wet.data.file;
  if (ctx.scope.disposed || ctx.scope.disposing || ctx.game.runtime !== runtime || runtime.world !== world) throw new Error('Wildlife owner left during wet preparation');
  const wetBlock=wetFile===undefined?undefined:{file:wetFile,bytes:await ctx.product.file(wetFile)};
  if (ctx.scope.disposed || ctx.scope.disposing || ctx.game.runtime !== runtime || runtime.world !== world) throw new Error('Wildlife owner left during wet preparation');
  // Only programmes this population consumes, in the same two original scopes.
  // Guest initialization stays at bindPageGroups / animalsBuilt below.
  for (const [program, scope] of [[rows.groups.damage, ctx.scope], [rows.admission, world.game.levelScope], [rows.pasture, world.game.levelScope]] as const) {
    if (ReturnProgram.prepareMemory(program, scope)) await buildYield(scope);
    if (ctx.scope.disposed || ctx.scope.disposing || ctx.game.runtime !== runtime || runtime.world !== world) throw new Error('Wildlife owner left during memory preparation');
  }
  pageSim.bindPageGroups(ctx, rows.groups,wetBlock);
  const page = await ctx.product.json<SpeciesActorsFileRows>(feature.crowd.json);
  if (page.parts.length === 0 || page.parts.length !== page.pivots.length || page.radius <= 0 || page.draws.length !== 1) throw new Error('Invalid crowd body joints or bound');
  const draws = fixedDraws(ctx.product, page.draws), template = draws.handle(feature.crowd.binary);
  const closed = (): boolean => ctx.scope.disposed || ctx.scope.disposing;
  await draws.load();
  const geometry = template.take();
  if (closed() || geometry.boundingSphere === null) { geometry.dispose(); throw new Error('Crowd geometry owner left or bounds are missing'); }
  ctx.scope.own(geometry);
  // The original animated sphere includes moving limbs; fixedDraws stays static.
  geometry.boundingSphere.radius = page.radius;
  const body = { geometry, pivots: page.pivots, parts: page.parts };
  const predators: Animal[] = [], crowds = createPageCrowds(world.sky, world.chunk.seed, body, page.page.world, predators,world.game.levelScope);
  const foragers = rows.foragers?.view === undefined ? null : await prepareForagerDraw(ctx, rows);
  const owner: { wildlife: PageWildlife<CrowdDraw> | null } = { wildlife: null };
  let draw: ForagerDraw | null = null;
  pageSim.lendClientWildlife(ctx.scope, owner);
  // Registered at feature install, before later state reducers. The same
  // mutable owner is empty until animalsBuilt and retires with this scope.
  ctx.answer('combat.targets.ray',(request:RayTargets):RayTargets=>({...request,
    hit:owner.wildlife===null?request.hit:owner.wildlife.raycastWeapon(request.origin,request.dir,request.maxDist,request.hit)}));
  let started = false;
  const ensureActive = (): void => { if (ctx.scope.disposed) throw new Error('Wildlife owner left during construction'); };
  const build = async (animals: AnimalManager): Promise<void> => {
    if (ctx.scope.disposed || started) throw new Error('Wildlife animal stage is unavailable');
    started = true;
    animals.wetAt = (x, z) => pageSim.wild.wetAt(x, z);
    animals.navSteer = feature.navSteer;
    const population = pageSim.pageWildlife(animals, rows,world.game.levelScope,world.player.position);
    // the population's admission and its first pack take a task each: together they were one 117 ms afterKit frame of a
    // cold Nalati crossing at phone 4x (~32 ms admitting its programmes, ~59 ms the first pack)
    await macrotask(); ensureActive();
    for (const step of population.buildSteps()) {
      ensureActive();
      if (step.kind === 'crowd') {
        const view = crowds.factory(step.options, step.index); world.game.scene.add(view.mesh);
        const guardian = population.attachCrowd(step.index, view);
        if (guardian !== null) { view.dog = guardian; crowds.guardian(guardian, step.index, population.placement, ctx.app.rng.stream('ai')); }
      } else if (step.kind === 'foragers' && population.foragers !== null && foragers !== null) {
        draw = foragers.create(population.foragers.rules); world.game.scene.add(draw.mesh);
      }
      await macrotask();
    }
    await macrotask();
    ensureActive();
    owner.wildlife = population;
  };
  runtime.hooks.animalsBuilt = build;
  ctx.scope.onDispose(() => { retireClientWildlife(ctx.scope); if (runtime.hooks.animalsBuilt === build) delete runtime.hooks.animalsBuilt; });
  const player = { position: world.player.position, forward: new Vector3(0, 0, -1), crouching: false };
  const extra = { mounted: false };
  installDeclaredCrowdFrames(ctx, { systemId: feature.frame.id, after: feature.frame.after, before: feature.frame.before,
    current: () => owner.wildlife === null ? null : crowds.runtime,
    frame: (dt, time, advance) => {
      const population = owner.wildlife; if (population === null) return;
      player.forward.set(-Math.sin(world.player.yaw), 0, -Math.cos(world.player.yaw)); player.crouching = world.player.crouching;
      extra.mounted = pageRidingMounted(ctx);
      const env = pageSim.wild; env.wind.x = wind.dirX; env.wind.z = wind.dirZ; env.wind.strength = Math.min(1, wind.speed / 10);
      const speed = population.beginFrame(dt, player, extra);
      predators.length = 0;
      for (let index = 0; index < 64; index++) { const actor = population.predators[index]; if (actor === undefined) break; predators.push(actor); }
      for (const [index, view] of population.flocks.entries()) crowds.advance(view, index, speed, player.position, dt, time, advance);
      population.endFrame(dt, player.position, speed, player.crouching); draw?.project();
    } });
}
