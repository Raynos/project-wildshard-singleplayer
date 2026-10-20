import { PopulationRelations } from './relations';
import * as v from 'valibot';
import type { TargetHit } from '@wildshard/engine/combat/types';
import type { Vector3 } from 'three';
import { WildlifePopulationSchema } from '@wildshard/format/wildlifePopulation';
import { ForagerPopulation } from '@wildshard/engine/ai/ambientForager';
import { Rng } from '@wildshard/engine/core/rng';
import { app } from '@wildshard/engine/app/runtime';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import { terrainHeight } from '@wildshard/engine/world/terrainHeight';
import { CrowdTargets, CrowdRoster, CrowdWeaponTarget } from '../shardfile/crowdRuntime';
import { PageGroups, PagePopulationPlanner, wildEnv } from './pageGroups';
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
