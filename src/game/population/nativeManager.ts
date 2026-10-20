import { ForagerPopulation } from '@wildshard/engine/ai/ambientForager';
import { GrassField } from '../systems/looks/grassField';
import { TrampleField } from '../systems/looks/trample';
import { knockdownVelocity, PopulationRelations } from './relations';
import { Vector3 } from 'three';
import { AggressionDirector } from '@wildshard/engine/ai/director';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import type { FlockBrain, FlockThreat } from '@wildshard/engine/ai/flock';
import { canReach } from '@wildshard/engine/ai/reach';
import { createNativeSpeciesContext } from '../plugin/brain';
import type { EliteBindings } from '../shardfile/eliteEncounters';
import { ReturnProgram } from './returnProgram';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { HuntBody } from '@wildshard/engine/ai/hunt';
import { huntMemoryCodec } from '@wildshard/engine/ai/huntPattern';
import { StalkerBrain } from '@wildshard/engine/ai/stalker';
import { Rng } from '@wildshard/engine/core/rng';
import type { SimHost } from '@wildshard/engine/sim';

/** Existing native envelope fields; adapters retain their historical wire names. */
export interface NativeHuntContinuation {
  readonly clock: number; readonly rng: ReturnType<Rng['snapshot']>;
  readonly noise: { readonly seen: boolean; readonly speed: number; readonly prev: readonly [number, number, number] };
  readonly sight: readonly (boolean | null | undefined)[]; readonly memories: readonly unknown[];
  readonly herds: readonly (readonly [number, number])[];
}
/** Detached scalar/vector state; never a borrowed body, memory or controller. */
export interface NativeHuntSnapshot {
  clock: number; rng: { [K in keyof ReturnType<Rng['snapshot']>]: ReturnType<Rng['snapshot']>[K] };
  noise: { seen: boolean; speed: number; prev: [number, number, number] };
  sight: (boolean | null)[]; memories: (ReturnType<typeof huntMemoryCodec.save> | null)[];
  herds: [number, number][];
}
/** Immutable native capacity and historical memory field selection. */
export interface NativeManagerRows {
  readonly limit: number; readonly sightSlots: number; readonly initialSight: boolean | null;
  readonly memoryFields?: readonly string[];
}
const huntBody = (actor: AnimalSim): actor is HuntBody => 'hidden' in actor && typeof actor.hidden === 'boolean'
  && 'sampleTerrain' in actor && typeof actor.sampleTerrain === 'function';

/** Native manager state over concrete built-in hunt/stream owners. Inputs are
 * actor ids, plain rows and saved values, never a shard resolver or callback.
 * This installs no independent clock, allocates no actor and draws no entropy.
 * Null roster slots preserve a retired body's historical array position. */
export class NativeManager {
  readonly noise = { seen: false, speed: 0, prev: new Vector3() };
  readonly sight: (boolean | null | undefined)[];
  private clock = 0;
  constructor(private readonly host: SimHost, private readonly hunt: StalkerBrain<HuntBody>, private readonly stream: Rng, private readonly rows: NativeManagerRows) {
    if (!(hunt instanceof StalkerBrain) || !(stream instanceof Rng) || !Number.isSafeInteger(rows.limit) || rows.limit < 1 || rows.limit > 1024
      || !Number.isSafeInteger(rows.sightSlots) || rows.sightSlots < 0 || rows.sightSlots > rows.limit
      || (rows.initialSight !== null && typeof rows.initialSight !== 'boolean')) throw new Error('Invalid native manager owners or capacity');
    this.sight = Array.from({ length: rows.sightSlots }, () => rows.initialSight);
  }
  /** Advance at the original manager phase, with the owner's actual dt. */
  advance(dt: number): void { this.hunt.beginTick(dt); this.clock += dt; }
  /** Resolve every native identity before observing or restoring any state. */
  private roster(ids: readonly (string | null)[], participants: readonly string[]): (HuntBody | null)[] {
    const present = ids.filter((id): id is string => id !== null), names = new Set(present);
    if (ids.length > this.rows.limit || names.size !== present.length || new Set(participants).size !== participants.length
      || participants.some(id => !names.has(id))) throw new Error('Invalid native manager roster');
    return ids.map(id => {
      if (id === null) return null;
      const actor = this.host.entities.get(id);
      if (actor === undefined || !huntBody(actor)) throw new Error('Foreign native manager body');
      return actor;
    });
  }
  /** Capture a detached common payload in the adapter's declared slot order. */
  snapshot(ids: readonly (string | null)[], participants: readonly string[]): NativeHuntSnapshot {
    const bodies = this.roster(ids, participants), participating = new Set(participants);
    return { clock: this.clock, rng: { ...this.stream.snapshot() }, noise: { seen: this.noise.seen, speed: this.noise.speed, prev: this.noise.prev.toArray() },
      sight: this.sight.map(value => value ?? null), memories: bodies.map(actor => {
        const memory = actor === null || !participating.has(actor.entityId) ? undefined : this.hunt.memory(actor);
        return memory === undefined ? null : huntMemoryCodec.save(memory, this.rows.memoryFields);
      }), herds: this.hunt.herds.map(herd => [herd.cx, herd.cz]) };
  }
  /** Quietly restore after the adapter reinstalls its exact native roster. */
  restore(state: NativeHuntContinuation, ids: readonly (string | null)[], participants: readonly string[]): void {
    const bodies = this.roster(ids, participants), participating = new Set(participants);
    if (state.memories.length !== bodies.length || state.sight.length !== this.sight.length || state.herds.length !== this.hunt.herds.length
      || !Number.isFinite(state.clock)) throw new Error('Incompatible native manager continuation');
    this.stream.restore(state.rng); this.hunt.beginTick(state.clock - this.clock); this.clock = state.clock;
    this.noise.seen = state.noise.seen; this.noise.speed = state.noise.speed; this.noise.prev.set(...state.noise.prev);
    state.sight.forEach((seen, i) => { this.sight[i] = seen; });
    state.herds.forEach(([cx, cz], i) => { const herd = this.hunt.herds[i]; if (herd !== undefined) { herd.cx = cx; herd.cz = cz; } });
    bodies.forEach((actor, i) => {
      const memory = actor === null || !participating.has(actor.entityId) ? undefined : this.hunt.memory(actor), saved = state.memories[i];
      if ((saved === null) !== (memory === undefined)) throw new Error('Incompatible native manager memory');
      if (memory !== undefined) huntMemoryCodec.restore(memory, saved, this.rows.memoryFields === undefined);
    });
  }
}

const directors = new WeakMap<SimHost, Map<string, WeakMap<AnimalSim, AggressionDirector<AnimalSim>>>>();
/** Register actual built-in token owners, never shard claim or attack callbacks. */
export function admitNativeManagerTokens(host: SimHost, id: string, owners: WeakMap<AnimalSim, AggressionDirector<AnimalSim>>): void {
  const map = directors.get(host) ?? new Map<string, WeakMap<AnimalSim, AggressionDirector<AnimalSim>>>();
  if (map.has(id)) throw new Error('Duplicate native manager token owners');
  map.set(id, owners); directors.set(host, map); host.scope.onDispose(() => { map.delete(id); });
}
/** The single shard supplies dispatch roles and guest ids; clocks and concrete
 * actor, group, hunt, token and elite owners belong to the game. */
export interface NativeDriverRows {
  tokens: string; program: unknown; packKind: string; dogKind: string; eliteKinds: readonly string[]; dispatch: string; dogDecision: string; stragglerDistance: number;
}
/** Manager decisions and native body continuation. Contexts allocate only when
 * a concrete actor joins; restored and newly bonded actors keep the same owner. */
export class NativePopulationDriver {
  private readonly contexts = new WeakMap<HuntBody, ReturnType<typeof this.makeContext>>();
  private readonly author: ReturnProgram;
  private readonly tokens: WeakMap<AnimalSim, AggressionDirector<AnimalSim>>;
  private readonly sheep = new Vector3();
  private readonly route = { elite: 0, wolf: 0, dog: 0, held: 0 };
  private readonly missing = new Error('Missing native population context');
  private dodgeCd = 0;
  constructor(private readonly host: SimHost, private readonly manager: NativeManager, private readonly hunt: StalkerBrain<HuntBody>, private readonly rng: Rng,
    private readonly bodies: HuntBody[], private readonly packs: ReadonlyMap<AnimalSim, PackBrain<AnimalSim>>,
    private readonly herds: ReadonlyMap<AnimalSim, HerdBrain<AnimalSim>>, private readonly elites: EliteBindings,
    private readonly flocks: readonly FlockBrain[], private readonly wolves: readonly FlockThreat[], private readonly rows: NativeDriverRows) {
    const tokens = directors.get(host)?.get(rows.tokens); if (tokens === undefined) throw new Error('Missing native manager tokens'); this.tokens = tokens;
    if (bodies.length > 64 || flocks.length > 4) throw new Error('Native population driver capacity exceeded');
    this.author = ReturnProgram.native(host, rows.program);
    for (const actor of bodies) this.admit(actor);
    host.useBodyStep({ before: (_id, body, dt) => {
      const actor = this.body(body); if (actor === undefined || actor.hidden || !actor.alive || actor.stunned || actor.kind === rows.dogKind) return;
      const elite = elites.brains.get(actor);
      if (elite !== undefined) elite.act(actor);
      else if (actor.kind === rows.packKind) { const pack = packs.get(actor); if (pack !== undefined) { const c = this.context(actor, dt); pack.drive(actor, c, true); c.confine(actor); } }
      else { const herd = herds.get(actor); if (herd !== undefined) herd.drive(actor, this.context(actor, dt), true); }
    }, after: (_id, body) => {
      const actor = this.body(body); if (actor?.alive === true && !actor.hidden && !actor.stunned && actor.state === 'charge') hunt.chargeContact(actor, host.player.position);
    } });
  }
  private body(actor: AnimalSim): HuntBody | undefined { return this.bodies.find(body => body === actor); }
  private required(actor: AnimalSim): HuntBody { const body = this.body(actor); if (body === undefined) throw this.missing; return body; }
  private makeContext(actor: HuntBody) {
    const { observation } = createNativeSpeciesContext({ host: this.host, hunt: this.hunt, rng: this.rng,
      world: null, heightAt: (x, z) => this.host.groundHeightAt(x, z), waterLevel: 0 }, actor, null);
    return { ...observation, claim: (a: AnimalSim): boolean => {
      const director = this.tokens.get(a); if (director !== undefined && !(director instanceof AggressionDirector)) throw this.missing; return director?.take(a) ?? true;
    }, pathYaw: (a: AnimalSim, x: number, z: number, every = 1): number => this.hunt.pathYawFor(this.required(a), x, z, every),
      steer: (a: AnimalSim, yaw: number, speed: number, turn: number): void => { this.hunt.steerAny(this.required(a), yaw, speed, turn); },
      confine: (a: AnimalSim): void => { this.hunt.confine(this.required(a)); }, reach: (a: AnimalSim): boolean => canReach(a, this.host.player.position, this.host.physics) };
  }
  admit(actor: HuntBody): void {
    if (this.host.entities.get(actor.entityId) !== actor || this.contexts.has(actor)) throw new Error('Invalid native driver actor');
    this.contexts.set(actor, this.makeContext(actor));
  }
  private context(actor: HuntBody, dt: number) {
    const context = this.contexts.get(actor); if (context === undefined) throw this.missing;
    context.dt = dt; context.t = this.host.clock.now; context.playerSpeed = this.manager.noise.speed;
    context.herd = actor.herd >= 0 ? this.hunt.herds[actor.herd]?.members ?? null : null; return context;
  }
  private dog(actor: HuntBody, dt: number): void {
    const flock = this.flocks.find(row => row.dog === actor);
    if (flock === undefined) { actor.setMotion(actor.yaw, 0, 1); return; }
    let nearest: FlockThreat | null = null, distance = Infinity;
    for (const wolf of this.wolves) { const d = Math.hypot(wolf.position.x - flock.cx, wolf.position.z - flock.cz); if (wolf.alive && d < distance) { distance = d; nearest = wolf; } }
    const straggler = flock.straggler(this.rows.stragglerDistance); if (straggler >= 0) flock.positions(straggler, this.sheep);
    const p = actor.position, memory = actor.mem, player = this.host.player.position;
    memory['dogThinkAt'] = this.host.clock.now;
    const answer = this.author.project(this.rows.dogDecision, { px: p.x, py: p.y, pz: p.z, cx: flock.cx, cz: flock.cz, dt,
      bark: memory['barkT'] ?? 0, rest: memory['rest'] ?? 0, wolf: Number(nearest !== null), distance: nearest === null ? 0 : distance,
      wx: nearest?.position.x ?? 0, wy: nearest?.position.y ?? 0, wz: nearest?.position.z ?? 0, straggler: Number(straggler >= 0),
      sx: this.sheep.x, sy: this.sheep.y, sz: this.sheep.z, playerX: player.x, playerY: player.y, playerZ: player.z }, this.host.rng.stream('ai'));
    const n = (key: string): number => { const value = answer[key]; if (value === undefined || !Number.isFinite(value)) throw this.missing; return value; };
    memory['barkT'] = n('bark'); memory['snarl'] = n('snarl'); memory['low'] = n('low'); if (answer['rest'] !== undefined) memory['rest'] = n('rest');
    const state = (['idle', 'alert', 'stalk', 'wander'] as const)[n('state')]; if (state === undefined) throw this.missing;
    actor.state = state; actor.lookTarget.set(n('lookX'), n('lookY'), n('lookZ')); actor.lookWeight = n('look');
    const path = n('path'), yaw = path > 0 ? this.hunt.pathYawFor(actor, n('x'), n('z'), path) : n('yaw');
    if (path < 0) actor.setMotion(yaw, n('speed'), n('turn')); else this.hunt.steerAny(actor, yaw, n('speed'), n('turn')); this.hunt.confine(actor);
  }
  private decide(actor: HuntBody, dt: number): void {
    const elite = this.elites.brains.get(actor);
    if (!actor.alive) { actor.lookWeight = 0; return; }
    if (this.rows.eliteKinds.includes(actor.kind) && elite === undefined) throw this.missing;
    if (actor.stunned) { actor.setMotion(actor.yaw, 0, 1); actor.setStrafe(0); actor.lookTarget.copy(this.host.player.position); actor.lookWeight = 1; return; }
    Object.assign(this.route, { elite: Number(elite !== undefined), wolf: Number(actor.kind === this.rows.packKind), dog: Number(actor.kind === this.rows.dogKind), held: Number(actor.mem['ridden'] === 1 || actor.mem['owned'] === 1) });
    const route = this.author.project(this.rows.dispatch, this.route)['state'];
    if (route === 0) return;
    const context = this.context(actor, dt);
    if (route === 1) elite?.think(actor, context);
    else if (route === 2) { const pack = this.packs.get(actor); if (pack === undefined) actor.setMotion(actor.yaw, 0, 1); else { pack.tick(context); pack.drive(actor, context); context.confine(actor); } }
    else if (route === 3) this.dog(actor, dt);
    else if (route === 4) { const herd = this.herds.get(actor); if (herd === undefined) actor.setMotion(actor.yaw, 0, 1); else { herd.tick(context); herd.drive(actor, context); } }
    const herd = actor.herd >= 0 ? this.hunt.herds[actor.herd] : undefined; if (herd !== undefined) this.hunt.updateHerd(herd);
  }
  private takeStep(actor: HuntBody, urgent: boolean): number {
    const dt = this.host.brainDt(actor.entityId, urgent), last = actor.mem['groupThinkAt'];
    if (dt <= 0 || (last !== undefined && this.host.clock.now-last < .1-1e-9)) return 0;
    actor.mem['groupThinkAt'] = this.host.clock.now; return last === undefined ? dt : this.host.clock.now-last;
  }
  /** Advance after world and riding observations, before the native body phase. */
  update(dt: number): void {
    const player = this.host.player.position, speed = this.manager.noise, hunt = this.hunt;
    if (!speed.seen) { speed.prev.set(player.x, 0, player.z); speed.seen = true; }
    const moved = Math.hypot(player.x-speed.prev.x, player.z-speed.prev.z); speed.prev.set(player.x, 0, player.z);
    speed.speed += (Math.min(moved/dt, 9)-speed.speed)*(1-0.5**(dt*10)); this.manager.advance(dt); hunt.resetRepaths();
    const dodged = this.host.playerDodge.cd > this.dodgeCd; this.dodgeCd = this.host.playerDodge.cd;
    if (dodged) for (const actor of this.bodies) {
      if (!actor.alive || actor.harnessHold || actor.hidden || (!actor.aggressive && !hunt.sensed(actor))) continue;
      const step = this.takeStep(actor, true); if (step > 0) this.decide(actor, step);
    }
    for (let i = 0; i < 64; i++) {
      const actor = this.bodies[i]; if (actor === undefined) break; if (actor.harnessHold || actor.hidden) continue;
      let urgent = false;
      if (actor.alive && actor.aggressive && (actor.state === 'charge' || actor.state === 'stalk' || actor.state === 'alert')) {
        const line = canReach(actor, player, this.host.physics); urgent = this.manager.sight[i] === true && !line; this.manager.sight[i] = line;
      }
      const step = this.takeStep(actor, urgent); if (step > 0) { actor.sampleTerrain(); this.decide(actor, step); }
    }
  }
  snapshot(): number { return this.dodgeCd; }
  restore(value: number): void { if (!Number.isFinite(value) || value < 0) throw this.missing; this.dodgeCd = value; }
}

interface WildlifeFrameState { init: boolean; x: number; z: number; v: number; at?: number }
export interface NativeWildlifeRows {
  speed: string; alert: string; range: string; packRadius: number; scareSeconds: number; scareRadius: number; foragerRunSpeed: number;
  trample: { kinds: Readonly<Record<string, number>>; minSpeed: number; range: number; fullSpeed: number };
  knockdown: { speed: number; min: number; max: number; seconds: number };
}
/** Continuous world observations around the existing native group and crowd
 * owners. Placement and response decisions stay in their admitted guest. */
export class NativeWildlifeFrame {
  private readonly state: WildlifeFrameState = { init: false, x: 0, z: 0, v: 0, at: 0 };
  private readonly fields = { x: 0, z: 0, px: 0, pz: 0, dt: 0, speed: 0 };
  private readonly relations: PopulationRelations<AnimalSim>;
  constructor(private readonly host: SimHost, private readonly author: ReturnProgram, private readonly bodies: readonly HuntBody[],
    private readonly wildWolves: readonly HuntBody[], private readonly wolves: HuntBody[],
    packs: readonly PackBrain<AnimalSim>[], herds: readonly HerdBrain<AnimalSim>[], private readonly flocks: readonly FlockBrain[],
    private readonly foragers: ForagerPopulation, private readonly trample: TrampleField, private readonly rows: NativeWildlifeRows) {
    if (!(foragers instanceof ForagerPopulation) || !(trample instanceof TrampleField) || bodies.length > 64 || flocks.length > 4) throw new Error('Invalid native wildlife owners');
    this.relations = new PopulationRelations(author, { packs, herds, crowds: flocks }, { alert: rows.alert, range: rows.range, packRadius: rows.packRadius,
      disturbRadius: 0, disturbSeconds: 0, scareSeconds: rows.scareSeconds });
  }
  update(dt: number, crouched: boolean): void {
    const player = this.host.player.position, state = this.state;
    if (!state.init) { state.x = player.x; state.z = player.z; state.init = true; }
    const elapsed = this.host.clock.now-(state.at ?? 0);
    if (elapsed >= .1-1e-9) {
      Object.assign(this.fields, { x: player.x, z: player.z, px: state.x, pz: state.z, dt: elapsed, speed: state.v });
      const speed = this.author.project(this.rows.speed, this.fields)['speed']; if (speed === undefined || !Number.isFinite(speed)) throw new Error('Invalid native wildlife speed');
      state.v = speed; state.x = player.x; state.z = player.z; state.at = this.host.clock.now;
    }
    this.wolves.length = 0; for (const wolf of this.wildWolves) if (wolf.alive) this.wolves.push(wolf);
    const row = this.rows.trample;
    for (const actor of this.bodies) {
      const radius = row.kinds[actor.kind];
      if (radius === undefined || !actor.alive || actor.speed < row.minSpeed || Math.hypot(actor.position.x-player.x, actor.position.z-player.z) > row.range) continue;
      this.trample.push(actor.position.x, actor.position.z, radius*actor.scale, Math.min(1,actor.speed/row.fullSpeed), Math.sin(actor.yaw)*actor.speed, Math.cos(actor.yaw)*actor.speed);
    }
    for (const flock of this.flocks) flock.update(dt, this.host.clock.now, player, state.v, this.wolves);
    const alarm = this.foragers.update(dt, player, state.v > this.rows.foragerRunSpeed, crouched); if (alarm !== null) this.relations.alert(alarm.x, alarm.z);
    this.relations.ripple();
  }
  scare(x: number, z: number, radius = this.rows.scareRadius): void { this.relations.scare(x, z, radius); this.host.events.emit('creature.signal', { name: 'scare', x, z }); }
  private readonly knocked={x:0,z:0};
  knockdown(x: number, z: number, strength: number): void {
    const row=this.rows.knockdown;knockdownVelocity(row,x,z,strength,this.knocked);
    this.host.dashPlayer(this.knocked.x,this.knocked.z,row.seconds);
  }
  snapshot(): { wild: { init: boolean; x: number; z: number; v: number; at: number }; flocks: string[]; marmots: ReturnType<ForagerPopulation['snapshot']> } {
    return { wild: { ...this.state, at: this.state.at ?? 0 }, flocks: this.flocks.map(flock => flock.snapshot()), marmots: this.foragers.snapshot() };
  }
  restore(saved: { wild: WildlifeFrameState; flocks: readonly string[]; marmots: unknown }): void {
    if (saved.flocks.length !== this.flocks.length || ![saved.wild.x,saved.wild.z,saved.wild.v,saved.wild.at ?? this.host.clock.now].every(Number.isFinite)) throw new Error('Invalid native wildlife continuation');
    Object.assign(this.state, saved.wild, { at: saved.wild.at ?? this.host.clock.now }); this.foragers.restore(saved.marmots);
    saved.flocks.forEach((wire, index) => { this.flocks[index]?.restore(wire); });
  }
}

/** Native grass and weather observations are a concrete game service. Content
 * supplies numeric defaults; signal and knockdown effects bind only game owners. */
export class NativeWildEnvironment {
  readonly wind: { x: number; z: number; strength: number };
  playerFwdX = 0; playerFwdZ = -1; playerCrouched = false; playerMounted = false; playerHealth01 = 1;
  lastShotT = -1e9; light = 1; storm = false;
  private host: SimHost | null = null;
  private frame: NativeWildlifeFrame | null = null;
  constructor(readonly field: GrassField, readonly trampleField: TrampleField, private readonly rows: { wind: { x: number; z: number; strength: number }; flatten: number }) {
    if (!(field instanceof GrassField) || !(trampleField instanceof TrampleField)) throw new Error('Invalid native grass owners'); this.wind = { ...rows.wind };
  }
  bind(host: SimHost, frame: NativeWildlifeFrame): void {
    if (this.host !== null || !(frame instanceof NativeWildlifeFrame)) throw new Error('Invalid native world binding'); this.host = host; this.frame = frame;
  }
  grassStandingAt(x: number, z: number): number { return this.field.baseHeightAt(x,z); }
  grassHeightAt(x: number, z: number): number { return this.field.baseHeightAt(x,z)*(1-this.rows.flatten*this.trampleField.amountAt(x,z)); }
  /** Standard grass-cover senses over this world's concrete field owners. */
  visibility(x: number, z: number, player: Vector3, speed: number, now: number): number {
    const cover = (height: number): number => Math.min(1, Math.max(0, (height-.15)/((this.playerCrouched ? 1.05 : 1.75)-.15)));
    const dx = x-player.x, dz = z-player.z, distance = Math.hypot(dx,dz) || 1;
    let screen = 0;
    for (const step of [1.5,3,5]) { if (step > distance) break; screen += cover(this.grassHeightAt(player.x+dx/distance*step,player.z+dz/distance*step))/3; }
    const motion = now-this.lastShotT < 1 ? 1.5 : speed < .4 ? .3 : speed <= 2.6 ? .7 : speed < 5.2 ? 1 : 1.5;
    return (1-.9*Math.max(cover(this.grassStandingAt(player.x,player.z)),.7*screen))*motion*this.light;
  }
  downwind(x: number, z: number, player: Vector3): boolean {
    const dx = x-player.x, dz = z-player.z, distance = Math.hypot(dx,dz), wind = this.wind;
    return distance >= 1e-3 && wind.strength >= .05 && (dx*wind.x+dz*wind.z)/distance > .82;
  }
  hearing(radii: readonly [number,number,number,number], player: Vector3, speed: number): number {
    return (speed < .4 ? radii[0] : speed <= 2.6 ? radii[1] : speed < 5.2 ? radii[2] : radii[3])
      *(speed > .4 && this.grassStandingAt(player.x,player.z) >= .7 ? 1.25 : 1)*(this.storm ? .5 : 1);
  }
  trample(x: number, z: number, radius: number, strength: number, vx: number, vz: number): void { this.trampleField.push(x,z,radius,strength,vx,vz); }
  onEvent(name: string, x: number, z: number): void {
    if (this.host === null) throw new Error('Unbound native world signal'); this.host.events.emit('creature.signal', { name,x,z });
  }
  onKnockdown(x: number, z: number, strength: number): void { if (this.frame === null) throw new Error('Unbound native knockdown'); this.frame.knockdown(x,z,strength); }
}
