import type { Scope } from '@wildshard/engine/app/scope';
import { macrotask } from '@wildshard/engine/boot/plan';
import { wind } from '@wildshard/engine/world/steppeWind';
import type { ClientFeatureRow } from '@wildshard/format/clientPlan';
import type { ShardContext } from '../plugin/context';
import { createPageCrowds, readCrowdBody } from '../ambient/crowdPage';
import type { CrowdDraw } from '../ambient/crowdDraw';
import { prepareForagerDraw, type ForagerDraw } from '../ambient/foragerDraw';
import { pageRidingMounted } from '../riding/mount';
import { PopulationRelations } from './relations';
import * as v from 'valibot';
import type { TargetHit } from '@wildshard/engine/combat/types';
import { Vector3 } from 'three';
import { WildlifePopulationSchema } from '@wildshard/format/wildlifePopulation';
import { ForagerPopulation } from '@wildshard/engine/ai/ambientForager';
import { Rng } from '@wildshard/engine/core/rng';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { installDeclaredCrowdFrames, CrowdTargets, CrowdRoster, CrowdWeaponTarget } from '../shardfile/crowdRuntime';
import { PageGroups, PagePopulationPlanner, bindPageGroups, wildEnv } from './pageGroups';
import { ReturnProgram, ProjectedMotionSample } from './returnProgram';

type Rows = v.InferOutput<typeof WildlifePopulationSchema>;
/** Explicit presentation work, interleaved with the director's original spawns. */
export type WildlifeBuildStep = { kind: 'pause' } | { kind: 'foragers' } | { kind: 'crowd'; index: number; options: { x: number; z: number; count: number; seed: number; range: number } };
/** Client-only population director. Native owners handle every spawn, group,
 * relationship and observation; authored input is rows and admitted guests. */
export class PageWildlife<T extends CrowdTargets = CrowdTargets> {
  readonly flocks: T[] = []; readonly mountables: Animal[] = []; readonly predators: Animal[] = [];
  readonly groups: PageGroups; readonly pastureAuthor: ReturnProgram;
  readonly foragers: { rules: ForagerPopulation; initial: ReturnType<ForagerPopulation['snapshot']> } | null;
  private readonly rows: Rows; readonly placement: ReturnProgram; private readonly population: PagePopulationPlanner;
  private readonly weaponTarget: CrowdWeaponTarget<T>;
  private readonly targets: CrowdRoster<T>; private readonly relations: PopulationRelations;
  private readonly motion: ProjectedMotionSample; private readonly predatorBodies: Animal[] = [];
  constructor(private readonly animals: AnimalManager,input: unknown) {
    this.rows = v.parse(WildlifePopulationSchema,input); const row = this.rows;
    this.placement = ReturnProgram.page(row.admission); this.pastureAuthor = ReturnProgram.page(row.pasture);
    this.population = new PagePopulationPlanner(animals,this.placement,new Rng(row.random),{ begin: 'begin',spot: 'spot',accept: 'accept',yaw: 'yaw' });
    this.groups = new PageGroups(animals,this.flocks,row.groups); this.targets = new CrowdRoster(animals.animals,this.flocks,row.groups.prey);
    this.weaponTarget=new CrowdWeaponTarget(this.targets,row.combat);
    this.relations = new PopulationRelations(this.placement,{ packs: this.groups.packs,herds: this.groups.herds,crowds: this.flocks },row.relations);
    this.motion = new ProjectedMotionSample(this.placement,'speed');
    if (row.foragers === null) this.foragers = null;
    else { const rules = new ForagerPopulation(row.foragers.row,row.foragers.seed); rules.restore(row.foragers.initial); this.foragers = { rules,initial: rules.snapshot() }; }
  }
  get packs(): PageGroups['packs'] { return this.groups.packs; }
  get herds(): PageGroups['herds'] { return this.groups.herds; }
  get pastureProfile(): Rows['pastureActor'] { return this.rows.pastureActor; }
  *buildSteps(): Generator<WildlifeBuildStep,void> {
    const row = this.rows;
    for (const pack of row.packs) { this.spawnPack(pack.x,pack.z,pack.variants); yield { kind: 'pause' }; }
    for (const herd of row.herds) { this.spawnHerd(herd.x,herd.z,herd.mares,herd.foals,herd.stallion); yield { kind: 'pause' }; }
    for (const [index,flock] of row.flocks.entries()) {
      yield { kind: 'crowd',index,options: { x: flock.x,z: flock.z,count: flock.count,seed: row.seed+index*101,range: flock.range } };
      if (this.flocks.length !== index+1) throw new Error('Unbound population crowd');
    }
    for (const mount of row.mountables) this.mountables.push(this.animals.spawn(row.kinds.mount,mount.x,mount.z,mount.yaw,mount.variant));
    if (row.mountables.length > 0) yield { kind: 'pause' };
    if (this.foragers !== null) yield { kind: 'foragers' };
  }
  spawnPack(x: number,z: number,variants: readonly string[]): ReturnType<PageGroups['pack']> {
    const radius = v.parse(v.number(),this.placement.project('packPlan',{})['radius']);
    const members = this.population.scatter({ kind: this.rows.kinds.predator,variants,x,z,radius }); this.predatorBodies.push(...members);
    return this.groups.pack(members.map(actor => actor.entityId),x,z);
  }
  spawnHerd(x: number,z: number,mares: number,foals: number,stallion: boolean): ReturnType<PageGroups['herd']> {
    const row = this.rows,members = this.population.planned({ kind: row.kinds.mount,x,z,observations: { mares,foals,stallion: Number(stallion),coats: row.coats.length },
      variants: [...row.coats,...row.young,row.leader],start: 'herdStart',member: 'herdMember',offset: 'foal' });
    return this.groups.herd(members.map(actor => actor.entityId));
  }
  /** Bind an already-built native crowd; return the optional guardian identity. */
  attachCrowd(index: number,view: T): Animal | null {
    const row = this.rows.flocks[index];
    if (!(view instanceof CrowdTargets) || index !== this.flocks.length || row?.count !== view.n) throw new Error('Invalid population crowd binding');
    let dog: Animal | null = null;
    if (row.dog) {
      const plan = v.parse(v.object({ x: v.number(),z: v.number(),radius: v.number() }),this.placement.project('dogPlan',{ x: row.x,z: row.z }));
      const at = this.population.spot(plan.x,plan.z,plan.radius); dog = this.animals.spawn(this.rows.kinds.guardian,at.x,at.z,0,this.rows.kinds.guardianVariant);
      dog.herd = this.animals.addHerd(this.rows.kinds.guardian,row.x,row.z);
    }
    this.flocks.push(view); return dog;
  }
  sound(cue: string,x: number,z: number,height = this.rows.soundHeight): void { app.events.emit('creature.sound',{ cue,x,y: terrainHeight(x,z)+height,z }); }
  /** Observe before advancing declared crowds, without a per-crowd callback. */
  beginFrame(dt: number,player: { position: Vector3; forward: Vector3; crouching: boolean },extra: { mounted?: boolean }): number {
    const p = player.position,speed = this.motion.update(dt,p.x,p.z),length = Math.hypot(player.forward.x,player.forward.z);
    if (length > 1e-4) { wildEnv.playerFwdX = player.forward.x/length; wildEnv.playerFwdZ = player.forward.z/length; }
    const health=app.player?.attributes;
    wildEnv.playerCrouched = player.crouching; wildEnv.playerMounted = extra.mounted ?? false; wildEnv.playerHealth01=health===undefined?1:health.health/health.maxHealth;
    this.predators.length = 0; for (const actor of this.predatorBodies) if (actor.alive) this.predators.push(actor);
    const row = this.rows.trample;
    for (const actor of this.animals.animals) {
      const radius = row.kinds[actor.kind];
      if (radius === undefined || !actor.alive || actor.speed < row.minSpeed || (actor.position.x-p.x)**2+(actor.position.z-p.z)**2 > row.range**2) continue;
      wildEnv.trample(actor.position.x,actor.position.z,radius*actor.scale,Math.min(1,actor.speed/row.fullSpeed),Math.sin(actor.yaw)*actor.speed,Math.cos(actor.yaw)*actor.speed);
    }
    return speed;
  }
  /** Finish after crowd motion; the forager owner emits an ordinary alarm row. */
  endFrame(dt: number,player: Vector3,speed: number,crouched: boolean): void {
    const forager = this.rows.foragers;
    if (forager !== null && this.foragers !== null) {
      const alarm = this.foragers.rules.update(dt,player,speed > forager.runSpeed,crouched);
      if (alarm !== null) { this.sound(forager.cue,alarm.x,alarm.z,0); this.relations.alert(alarm.x,alarm.z); }
    }
    this.relations.ripple();
  }
  disturb(x: number,z: number): void { this.relations.disturb(x,z); }
  scare(x: number,z: number,radius = 60): void { this.relations.scare(x,z,radius); wildEnv.onEvent('scare',x,z); }
  /** Native weapon target over the same authoritative crowd/prey roster. */
  raycastWeapon(origin:Vector3,direction:Vector3,maximum:number,previous:TargetHit|null):TargetHit|null{return this.weaponTarget.raycast(origin,direction,maximum,previous);}
  raycastCrowd(origin: Vector3,direction: Vector3,maximum: number): { flock: T; index: number; distance: number } | null { return this.targets.raycast(origin,direction,maximum); }
  killCrowd(hit: { flock: T; index: number }): void { hit.flock.kill(hit.index); }
}

const clientPopulations = new WeakMap<Scope, { wildlife: PageWildlife<CrowdDraw> | null }>();
/** Borrow the actual population assembled by the declared animal stage. */
export function clientWildlife(ctx: Pick<ShardContext, 'scope'>): PageWildlife<CrowdDraw> | null {
  if (ctx.scope.disposed) throw new Error('Wildlife owner is disposed');
  const owner = clientPopulations.get(ctx.scope);
  if (owner === undefined) throw new Error('Wildlife feature is not installed');
  return owner.wildlife;
}
/** Client-only lifecycle adapter for the existing population host. Admitted
 * files select geometry and population rows; native owners retain all clocks. */
export async function installClientWildlife(ctx: ShardContext, feature: ClientFeatureRow): Promise<void> {
  if (feature.kind !== 'population.wildlife' || ctx.scope.disposed || clientPopulations.has(ctx.scope)) throw new Error('Invalid wildlife feature owner');
  const runtime = ctx.game.runtime, world = runtime?.world;
  if (runtime === undefined || world === undefined || world === null || runtime.hooks.animalsBuilt !== undefined) throw new Error('Wildlife requires its unbound world animal stage');
  const rows = v.parse(WildlifePopulationSchema, await ctx.product.json(feature.file));
  bindPageGroups(ctx, rows.groups);
  const body = await readCrowdBody(ctx.product, feature.crowd);
  ctx.scope.own(body.geometry);
  const page = v.parse(v.object({ page: v.object({ world: v.unknown() }) }), await ctx.product.json(feature.crowd.json));
  const predators: Animal[] = [], crowds = createPageCrowds(world.sky, world.chunk.seed, body, page.page.world, predators);
  const foragers = rows.foragers?.view === undefined ? null : await prepareForagerDraw(ctx, rows);
  const owner: { wildlife: PageWildlife<CrowdDraw> | null } = { wildlife: null };
  let draw: ForagerDraw | null = null;
  clientPopulations.set(ctx.scope, owner);
  let started = false;
  const ensureActive = (): void => { if (ctx.scope.disposed) throw new Error('Wildlife owner left during construction'); };
  const build = async (animals: AnimalManager): Promise<void> => {
    if (ctx.scope.disposed || started) throw new Error('Wildlife animal stage is unavailable');
    started = true;
    animals.wetAt = (x, z) => wildEnv.wetAt(x, z);
    animals.navSteer = feature.navSteer;
    const population = new PageWildlife<CrowdDraw>(animals, rows);
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
  ctx.scope.onDispose(() => { clientPopulations.delete(ctx.scope); if (runtime.hooks.animalsBuilt === build) delete runtime.hooks.animalsBuilt; });
  const player = { position: world.player.position, forward: new Vector3(0, 0, -1), crouching: false };
  const extra = { mounted: false };
  installDeclaredCrowdFrames(ctx, { systemId: feature.frame.id, after: feature.frame.after, before: feature.frame.before,
    current: () => owner.wildlife === null ? null : crowds.runtime,
    frame: (dt, time, advance) => {
      const population = owner.wildlife; if (population === null) return;
      player.forward.set(-Math.sin(world.player.yaw), 0, -Math.cos(world.player.yaw)); player.crouching = world.player.crouching;
      extra.mounted = pageRidingMounted(ctx);
      wildEnv.wind.x = wind.dirX; wildEnv.wind.z = wind.dirZ; wildEnv.wind.strength = Math.min(1, wind.speed / 10);
      const speed = population.beginFrame(dt, player, extra);
      predators.length = 0;
      for (let index = 0; index < 64; index++) { const actor = population.predators[index]; if (actor === undefined) break; predators.push(actor); }
      for (const [index, view] of population.flocks.entries()) crowds.advance(view, index, speed, player.position, dt, time, advance);
      population.endFrame(dt, player.position, speed, player.crouching); draw?.project();
    } });
}
