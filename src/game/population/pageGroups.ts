import { installEnteredRuntimeService } from '../shard/retainedHooks';
import type { ShardContext } from '../plugin/context';
import { PackBrain, type PackPorts } from '@wildshard/engine/ai/pack';
import { HerdBrain } from '@wildshard/engine/ai/herd';
import { CrowdRoster, type CrowdTargets } from '../shardfile/crowdRuntime';
import { app } from '@wildshard/engine/app/runtime';
import { StrikeRunner } from '@wildshard/engine/ai/strikes';
import { strikeFromData } from '@wildshard/engine/ai/strikeRows';
import { nativeGroupBrain } from '@wildshard/format/groupBrains';
import { PageGroupRowsSchema } from '@wildshard/format/creatures';
import { bakedSamplers } from '@wildshard/format/bakedTerrainSampling';
import { unzlibSync } from 'fflate';
import { grassBaseHeightAt } from '../systems/looks/grassField';
import { grassHeightAt, trample } from '../systems/looks/trample';
import * as v from 'valibot';
import type { Rng } from '@wildshard/engine/core/rng';
import { knockdownVelocity } from './relations';
import { ReturnProgram, ProjectedState } from './returnProgram';
import { createCreatureSpawner, type CreatureSpawnRow } from '../plugin/brain';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { terrainHeight, terrainNormal, terrainWaterLevel } from '@wildshard/engine/world/terrainHeight';
import type { Vector3 } from 'three';
import type { PopulationProjectionRows } from '@wildshard/format/populationProjection';
import type { Scope } from '@wildshard/engine/app/scope';
import type { EncounterRegistry, SpawnContext, SpawnEntry, SpawnPoint, Spawner } from '@wildshard/engine/ai/encounters';

/** A fixed encounter table borrows the actual manager's spawn and retirement
 * services. The table consumes no random draw; scope-free previews use the
 * supplied fallback entry, with the same native admission and identity path. */
export class FixedPageSpawnTable {
  private readonly spawner: Spawner<Animal> | null;
  constructor(private readonly animals: AnimalManager, registry: EncounterRegistry, scope: Scope | null, id: string) {
    this.spawner = scope === null ? null : registry.spawn(id, scope, {
      create: (entry, point) => animals.spawn(entry.kind, point.x, point.z, point.yaw, entry.variant),
      retire: actor => { animals.retire(actor); },
    });
  }
  spawn(context: SpawnContext, point: SpawnPoint, fallback: SpawnEntry): Animal {
    if (this.spawner === null) return this.animals.spawn(fallback.kind, point.x, point.z, point.yaw, fallback.variant);
    const actor = this.spawner.spawn(context, point, () => { throw new Error('Fixed spawn table must not consume a random draw'); })[0];
    if (actor === undefined) throw new Error('Fixed spawn table returned no actor');
    return actor;
  }
  retire(actor: Animal): void { if (this.spawner === null) this.animals.retire(actor); else this.spawner.retire(actor); }
}

type Placement = CreatureSpawnRow & { readonly herd: number; readonly practice?: true };
interface Counts { readonly bodies: Map<string, number>; readonly groups: Map<string, number> }

/** Client-only grouped page lifetimes over the existing manager. Bodies keep their own AI,
 * native identities and creature-stream order. The owner retires only what it
 * actually spawned. Authored rows select the training slot. */
export class PageActorGroups {
  private readonly owner: ReturnType<typeof createCreatureSpawner<Animal>>;
  readonly counts: Counts = { bodies: new Map(), groups: new Map() };
  private training: Animal | null = null;
  private trainingRow: Placement | null = null;
  private readonly law: ProjectedState;
  private deadTime = 0;
  constructor(animals: AnimalManager, row: PopulationProjectionRows['practice'], scope: Scope) {
    this.owner = createCreatureSpawner(animals);
    this.law = new ProjectedState({ ...row.law, signals: { step: row.law.signal } }, ReturnProgram.page(row.program, scope));
  }
  get practice(): Animal | null { return this.training; }
  count(kind: string, groups = false): number { return (groups ? this.counts.groups : this.counts.bodies).get(kind) ?? 0; }
  private countBody(kind: string): void { this.counts.bodies.set(kind, this.count(kind) + 1); }

  /** Group preflight happens before any draw; body/row joins use the returned
   * ordered batch rather than guessing the manager's array offsets. */
  place(centres: readonly { readonly x: number; readonly z: number }[], kinds: readonly string[], rows: readonly Placement[]): void {
    this.owner.place(centres, kinds, rows, (actor, row) => {
      this.countBody(row.kind);
      if (row.practice === true) { this.training = actor; this.trainingRow = row; this.law.reset(); this.deadTime = 0; }
    }, kind => { this.counts.groups.set(kind, this.count(kind, true) + 1); });
  }
  /** Ungrouped actors retain herd −1. Presentation attaches to the real body. */
  loose(row: CreatureSpawnRow): Animal { const actor = this.owner.spawn(row.kind, row.x, row.z, row.yaw, row.variant ?? undefined); actor.herd = -1; this.countBody(row.kind); return actor; }

  /** Authored training homes refill after their corpse is hidden. Ordinary
   * ecological returns stay independent and retain their own queue entry.
   * The admitted guest owns the rule at ten Hz; native identity never leaves the manager. */
  updatePractice(dt: number, player: { readonly x: number; readonly z: number }): void {
    const actor = this.training, placed = this.trainingRow;
    if (actor === null || placed === null) return;
    this.deadTime += actor.alive ? 0 : dt;
    const result = this.law.step(dt, { alive: Number(actor.alive), hidden: Number(actor.hidden), deadDt: this.deadTime, distance: Math.hypot(player.x - placed.x, player.z - placed.z) });
    if (result.dt === 0) return;
    this.deadTime = 0;
    const action = v.parse(v.picklist([0, 1, 2]), result.values['action']);
    if (action === 1) actor.fadeOut();
    if (action !== 2) return;
    const [next] = this.owner.group(placed.kind, placed, [placed]);
    if (next === undefined) throw new Error('Missing training return');
    this.training = next; this.law.reset(); this.deadTime = 0; this.countBody(placed.kind);
  }

  dispose(): void { this.owner.dispose(); this.training = null; }
}

const point = v.object({ x: v.number(), z: v.number() });
const whole = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1024));
/** Client-only ordered placement on the existing page population owner. The admitted event program
 * chooses retries, terrain admission, member variants and relative placements.
 * Inputs are data and existing authorities; no content callback crosses it. */
export class PagePopulationPlanner {
  constructor(private readonly animals: AnimalManager, private readonly program: ReturnProgram, private readonly random: Rng,
    private readonly signals: { readonly begin: string; readonly spot: string; readonly accept: string; readonly yaw: string }) {}
  spot(x: number, z: number, radius: number): { x: number; z: number } {
    const attempts = v.parse(whole, this.program.project(this.signals.begin, {})['attempts']);
    for (let i = 0; i < attempts; i++) {
      const at = v.parse(point, this.program.project(this.signals.spot, { x, z, radius }, this.random));
      const clash = this.animals.animals.some(a => Math.abs(a.position.x - at.x) < 2 && Math.abs(a.position.z - at.z) < 2);
      if (this.program.project(this.signals.accept, { ...at, normal: terrainNormal(at.x, at.z)[1], height: terrainHeight(at.x, at.z), water: terrainWaterLevel(),
        wet: Number(this.animals.wetAt?.(at.x, at.z) === true), clash: Number(clash) })['accept'] === 1) return at;
    }
    return { x, z };
  }
  place(kind: string, variant: string, x: number, z: number, radius: number): Animal {
    const at = this.spot(x, z, radius), yaw = v.parse(v.number(), this.program.project(this.signals.yaw, {}, this.random)['yaw']);
    return this.animals.spawn(kind, at.x, at.z, yaw, variant);
  }
  /** Scatter a known ordered roster into one manager-owned group. */
  scatter(row: { readonly kind: string; readonly variants: readonly string[]; readonly x: number; readonly z: number; readonly radius: number }): Animal[] {
    const herd = this.animals.addHerd(row.kind, row.x, row.z);
    return row.variants.map(variant => this.member(this.place(row.kind, variant, row.x, row.z, row.radius), herd));
  }
  /** A bounded guest plan selects each member and optional placement relative to
   * an earlier member or the group's origin. Allocation stays in source order. */
  planned(row: { readonly kind: string; readonly x: number; readonly z: number; readonly variants: readonly string[];
    readonly observations: Readonly<Record<string, number>>; readonly start: string; readonly member: string; readonly offset: string }): Animal[] {
    const herd = this.animals.addHerd(row.kind, row.x, row.z);
    const start = v.parse(v.object({ start: v.number(), count: whole }), this.program.project(row.start, row.observations, this.random));
    const members: Animal[] = [];
    for (let index = 0; index < start.count; index++) {
      const plan = this.program.project(row.member, { ...row.observations, ...start, index });
      const variant = row.variants[v.parse(whole, plan['variant'])]; if (variant === undefined) throw new Error('Missing population variant');
      const actor = this.member(this.place(row.kind, variant, row.x, row.z, v.parse(v.number(), plan['radius'])), herd); members.push(actor);
      if (plan['place'] === 1) {
        const parent = members[v.parse(whole, plan['mother'])];
        if (parent !== undefined && parent !== actor) { const offset = v.parse(point, this.program.project(row.offset, {}, this.random)); actor.place(parent.position.x + offset.x, parent.position.z + offset.z, parent.yaw); }
      } else if (plan['place'] === 2) actor.place(row.x + v.parse(v.number(), plan['x']), row.z + v.parse(v.number(), plan['z']), v.parse(v.number(), plan['yaw']));
    }
    return members;
  }
  private member(actor: Animal, herd: number): Animal { actor.herd = herd; this.animals.herds[herd]?.members.push(actor); return actor; }
}

/** Nearest live body in a native ordered roster; ties preserve source order. */
export function nearestPopulationActor(actors: readonly Animal[], x: number, z: number, radius: number): Animal | null {
  let selected: Animal | null = null, distance = radius;
  for (const actor of actors) if (actor.alive) {
    const next = Math.hypot(actor.position.x - x, actor.position.z - z);
    if (next < distance) { distance = next; selected = actor; }
  }
  return selected;
}

/** Client-only observations over the installed native grass and terrain. A scope
 * lends numeric weather/player state and a baked wet mask; no query hook binds. */
export class PageWildEnvironment {
  wind = { x: 0,z: -1,strength: 0 };
  playerFwdX = 0; playerFwdZ = -1; playerCrouched = false; playerMounted = false; playerHealth01 = 1;
  lastShotT = -1e9; light = 1; storm = false;
  private author: ReturnProgram | null = null;
  private wet: ((x: number,z: number) => number) | null = null;
  private readonly states = new WeakMap<object,PropertyDescriptorMap>();
  enter(scope: Scope, input: unknown, author: ReturnProgram): void {
    const rows = v.parse(PageGroupRowsSchema,input), world = rows.world, previous = Object.getOwnPropertyDescriptors(this);
    if (input === null || typeof input !== 'object') throw new Error('Missing entered population rows');
    const state = this.states.get(input);
    if (state !== undefined) { Object.defineProperties(this,state); scope.onDispose(() => { this.states.set(input,Object.getOwnPropertyDescriptors(this)); Object.defineProperties(this,previous); }); return; }
    const bytes = unzlibSync(Uint8Array.from(atob(world.wet),value => value.codePointAt(0) ?? 0));
    if (bytes.byteLength !== world.res*world.res*4) throw new Error('Invalid population wet mask');
    const heights = new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    if (heights.some(value => !Number.isFinite(value))) throw new Error('Invalid population wet sample');
    this.wet = bakedSamplers({ res: world.res,size: world.size,seed: 0,landscapeHash: 0,heights,splat: new Uint8Array(0),undergrowth: null }).heightAt;
    this.wind = { ...rows.wind }; this.author = author;
    scope.onDispose(() => { this.states.set(input,Object.getOwnPropertyDescriptors(this)); Object.defineProperties(this,previous); });
  }
  grassHeightAt(x: number,z: number): number { return grassHeightAt(x,z); }
  grassStandingAt(x: number,z: number): number { return grassBaseHeightAt(x,z); }
  trample(x: number,z: number,radius: number,strength: number,vx: number,vz: number): void { trample.push(x,z,radius,strength,vx,vz); }
  wetAt(x: number,z: number): boolean { return (this.wet?.(x,z) ?? 0) > .5; }
  onEvent(name: string,x: number,z: number): void { app.events.emit('creature.signal',{ name,x,z }); }
  onKnockdown(x: number,z: number,strength: number): void { app.events.emit('creature.knockdown',{ x,z,strength }); }
  visibility(x: number, z: number, player: Vector3, speed: number, now: number): number {
    const dx = x-player.x, dz = z-player.z, distance = Math.hypot(dx,dz) || 1;
    const samples = [1.5,3,5].filter(step => step <= distance).map(step => ({ height: this.grassHeightAt(player.x+dx/distance*step,player.z+dz/distance*step) }));
    return v.parse(v.number(), this.author?.project('visibility', { height: this.grassStandingAt(player.x,player.z), crouched: Number(this.playerCrouched), speed, elapsed: now-this.lastShotT, light: this.light, count: samples.length }, undefined, samples)['fraction']);
  }
  downwind(x: number, z: number, player: Vector3): boolean {
    const dx = x-player.x, dz = z-player.z;
    return this.author?.project('downwind', { distance: Math.hypot(dx,dz), strength: this.wind.strength, dot: dx*this.wind.x+dz*this.wind.z })['accept'] === 1;
  }
  hearing(radii: readonly [number,number,number,number], player: Vector3, speed: number): number {
    return v.parse(v.number(), this.author?.project('hearing', { speed, height: this.grassStandingAt(player.x,player.z), storm: Number(this.storm) }, undefined, radii.map(radius => ({ radius })))['radius']);
  }

}
/** The entered page's observation surface; construction installs no service. */
export const wildEnv = new PageWildEnvironment();
const renderedPacks = new WeakMap<Animal,PackBrain<Animal>>(), renderedHerds = new WeakMap<Animal,HerdBrain<Animal>>();
let renderedDamage: { program: ReturnProgram; variant: string } | null = null;
/** Client-only group admission. Entered observations and damage borrow the
 * same native rows across retained home entries; no author installer binds. */
export function bindPageGroups(ctx: ShardContext,input: unknown): void {
  const rows = v.parse(PageGroupRowsSchema,input),herd = nativeGroupBrain(rows.herd);
  if (herd.kind !== 'herd') throw new Error('Invalid rendered damage preset');
  const program=ReturnProgram.page(rows.damage,ctx.scope),lastNotice=new Map<string,number>(),knocked={x:0,z:0};
  installEnteredRuntimeService(ctx,scope=>{
    const previous=renderedDamage;renderedDamage={program,variant:herd.stallionVariant};
    scope.onDispose(()=>{renderedDamage=previous;});wildEnv.enter(scope,input,program);
    const effects=rows.effects;if(effects===undefined)return;
    const toast=(key:string,text:string,every:number):void=>{
      const now=ctx.app.clock.now;if(now-(lastNotice.get(key)??-1e9)<every)return;
      lastNotice.set(key,now);ctx.game.runtime?.play?.hud.toast(text);
    };
    ctx.app.events.on('creature.signal',({name})=>{const notice=effects.notices.find(row=>row.signal===name);if(notice!==undefined)toast(name,notice.text,notice.every);},scope);
    ctx.app.events.on('creature.knockdown',({x,z,strength})=>{
      const player=ctx.game.runtime?.world?.player;if(player===undefined)return;
      knockdownVelocity(effects.knockdown,x,z,strength,knocked);player.dash(knocked.x,knocked.z,effects.knockdown.seconds);
      ctx.game.runtime?.play?.hud.damageFlash();toast('knockdown',effects.knockdown.text,effects.knockdown.every);
    },scope);
  });
}
/** Native page body lookup, independent from content ids and species names. */
export function renderedPackOf(actor: Animal): PackBrain<Animal> | null { return renderedPacks.get(actor) ?? null; }
export function renderedHerdOf(actor: Animal): HerdBrain<Animal> | null { return renderedHerds.get(actor) ?? null; }
export function observeHerdDamage(actor: Animal): void {
  const policy = renderedDamage; if (policy === null) throw new Error('Missing rendered damage policy');
  actor.mem['damageScale'] = v.parse(v.number(),policy.program.project('damage',{ owned: Number(actor.mem['owned'] === 1),stallion: Number(actor.variant === policy.variant),health: actor.hp/actor.maxHp })['scale']);
}

/** Client-only group factories bind native app authorities internally. Rows
 * choose brains, strikes, water and prey ids; no shard port object is accepted. */
export class PageGroups {
  readonly packs: PackBrain<Animal>[] = []; readonly herds: HerdBrain<Animal>[] = [];
  private readonly packRow; readonly herdRow;
  private readonly targets: CrowdRoster<CrowdTargets>;
  private readonly strikes = new StrikeRunner();
  private readonly rows: v.InferOutput<typeof PageGroupRowsSchema>;
  constructor(private readonly animals: AnimalManager, crowds: readonly CrowdTargets[], input: unknown) {
    this.rows = v.parse(PageGroupRowsSchema,input);
    const pack = nativeGroupBrain(this.rows.pack),herd = nativeGroupBrain(this.rows.herd);
    if (pack.kind !== 'pack' || herd.kind !== 'herd') throw new Error('Invalid rendered group presets');
    this.packRow = pack; this.herdRow = herd;
    this.targets = new CrowdRoster(animals.animals,crowds,this.rows.prey);
  }
  private actor(id: string): Animal { const actor = this.animals.animals.find(body => body.entityId === id); if (actor === undefined) throw new Error('Missing rendered group actor'); return actor; }
  private common() {
    return { sharedRng: () => app.rng.stream('ai'),environment: () => wildEnv,
      visibility: (x: number,z: number,player: Vector3,speed: number,time: number) => wildEnv.visibility(x,z,player,speed,time),
      hearing: (radii: readonly [number,number,number,number],player: Vector3,speed: number) => wildEnv.hearing(radii,player,speed),
      downwind: (x: number,z: number,player: Vector3) => wildEnv.downwind(x,z,player),
      inBounds: (x: number,z: number,margin = 0) => Math.abs(x) <= this.rows.world.size/2-margin && Math.abs(z) <= this.rows.world.size/2-margin,
      normalY: (x: number,z: number) => terrainNormal(x,z)[1],onEvent: (name: string,x: number,z: number) => { wildEnv.onEvent(name,x,z); } };
  }
  private contact(actor: Animal,context: { player: Vector3 },radius: number,herd: boolean): void {
    interface Contact { player: Vector3; reach: (actor: Animal) => boolean; hurt: (damage: number) => void }
    const admitted = (value: { player: Vector3 }): value is Contact => 'reach' in value && typeof value.reach === 'function' && 'hurt' in value && typeof value.hurt === 'function';
    if (!admitted(context)) throw new Error('Missing rendered contact authority');
    const row = strikeFromData(herd ? this.rows.contacts.herd : this.rows.contacts.pack);
    this.strikes.contact({ ...row,shape: { kind: 'point',radius,exclusive: true } },{ actor,target: context.player,canReach: () => context.reach(actor),hit: () => { context.hurt(actor.mods.chargeDamage); } });
  }
  pack(ids: readonly string[],x: number,z: number): PackBrain<Animal> {
    const members = ids.map(id => this.actor(id)), row = { ...this.packRow,members: [...ids],home: [x,z] as [number,number] };
    const ports: PackPorts<Animal> = { ...this.common(),register: (actor,director) => { app.aggression.register(actor,director); },
      bite: (actor,context,radius) => { this.contact(actor,context,radius,false); },preyIdentity: prey => this.targets.identity(prey),resolvePrey: id => this.targets.resolve(id) };
    const pack = new PackBrain(members,x,z,row,ports); pack.initialize();
    pack.findPrey = (px,pz,radius) => nearestPopulationActor(this.herds.flatMap(herd => herd.foals),px,pz,radius);
    this.packs.push(pack); for (const actor of members) { renderedPacks.set(actor,pack); } return pack;
  }
  herd(ids: readonly string[]): HerdBrain<Animal> {
    const members = ids.map(id => this.actor(id)),row = { ...this.herdRow,members: [...ids] },herd = new HerdBrain(members,row,{ ...this.common(),
      passThrough: (actor,through) => { actor.motor?.passThrough(through ? ['PLAYER'] : []); },resolveActor: id => this.animals.animals.find(body => body.entityId === id) ?? null,
      chargeContact: (actor,context,radius) => { this.contact(actor,context,radius,true); },
      scarePack: (actor,radius) => { const pack = renderedPacks.get(actor); if (pack === undefined) return false; pack.scare(actor.position.x,actor.position.z,radius); return true; },
      onKnockdown: (x,z,strength) => { wildEnv.onKnockdown(x,z,strength); } });
    herd.initialize(); herd.findThreat = (x,z,radius) => nearestPopulationActor(this.packs.flatMap(pack => pack.members),x,z,radius);
    const adopt = herd.adoptStallion.bind(herd); herd.adoptStallion = actor => { adopt(actor); renderedHerds.set(actor,herd); };
    this.herds.push(herd); for (const actor of members) { renderedHerds.set(actor,herd); } return herd;
  }
}
