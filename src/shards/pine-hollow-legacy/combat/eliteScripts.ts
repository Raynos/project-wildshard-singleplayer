import type { Vector3 } from 'three';
import { EliteBrain, type EliteActor } from '@wildshard/engine/ai/EliteBrain';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import { BEAR_CAVE } from '../layout';
import { ironhideGoal, ghostGoal, blackpawGoal, imperialGoal } from './EliteGoals';
import { PINE_ELITE_ANIMALS, PINE_ELITE_DEFS } from './eliteRoster';
import { pineEliteStreams, type PineEliteStreams } from './eliteStreams';
import { behindPlayer, fadeCooldown, headingTo } from './combatMath';
import { PINE_LANES } from './strikes';
import type { Lane, LaneBody } from './lane';

/**
 * Pine Hollow's four named elites' scripts, renderer-free (SF72): Old Ironhide, the Ghost Stag, Old Blackpaw and the Imperial
 * Bull as one implementation over any body and world (each satisfies the game's `EliteCoreScript`). The page (elites.ts) gives them its Animals, its decals, puffs and voices;
 * a renderer-free host (runtime/elites.ts) gives them its bodies, bare lanes and silent effects. Every random draw is the elite's
 * own seeded stream (eliteStreams.ts). The rules around them (lair, aware / engaged / leash, phase 2, respawn) are the game's
 * `EliteCore` (@wildshard/game/eliteSystem). Their moves and clocks live in EliteGoals.ts; the behaviour is told in elites.ts.
 */

/** An elite's body as the scripts drive it: the page's Animal and a renderer-free host's body alike. */
export interface PineEliteBody extends LaneBody, EliteActor {
  readonly alive: boolean; readonly position: Vector3; readonly entityId: string;
  hidden: boolean; hp: number; readonly maxHp: number; readonly kind: string;
  place: (x: number, z: number, yaw: number, y?: number) => void;
}

/** One of the authored lane charges (strikes.ts PINE_LANES). */
export type PineLaneRow = (typeof PINE_LANES)[keyof typeof PINE_LANES];

/** A ring telegraph (the page's GroundTell ring; a renderer-free host draws nothing). */
export interface PineRingTell { setTime: (t: number) => void; ring: (x: number, z: number, radius: number, alpha: number) => void; hide: () => void }

/** What the scripts touch of the world: the player, the fight's effects on them, the creature manager, the tells and the effects. */
export interface PineEliteWorld<B extends PineEliteBody> {
  readonly player: { readonly position: Vector3; readonly yaw: number };
  reach: (actor: B, target: { readonly x: number; readonly y: number; readonly z: number }) => boolean;
  readonly god: boolean;
  trauma: (k: number) => void; stun: (s: number) => void;
  dusk: () => number; night: () => number;
  /** `a` hits the player for `dmg` */
  hurt: (a: B, dmg: number, throughWalls?: boolean) => void;
  /** an animal voice at the body */
  voice: (name: string, a: B) => void;
  /** the creature manager's spawn (the shared creature stream's draws) */
  spawn: (kind: string, x: number, z: number, yaw: number, variant: string) => B;
  /** the manager's live body under an entity id (a continuation's rivals; null when none) */
  find: (entityId: string) => B | null;
  /** take a body under a fight's control (out of its herd, the manager's AI off) / hand it back / out of the world */
  own: (a: B) => void; release: (a: B) => void; retire: (a: B) => void;
  /** one of the named elites (the page: its skin comes from the orb) */
  adopt: (a: B) => void;
  lane: (row: PineLaneRow) => Lane<B>;
  ring: () => PineRingTell;
  heightAt: (x: number, z: number) => number;
  inChunk: (x: number, z: number, margin: number) => boolean;
  /** the body's view on / off (hidden in the cave, faded) */
  show: (a: B, visible: boolean) => void;
  readonly fx: { fade: (a: B) => void; reappear: (a: B) => void; burstOut: (a: B) => void; roar: (a: B, radius: number) => void };
  /** the elite system's signature flash */
  signature: (id: string) => void;
  /** the kill feed */
  feed: (text: string) => void;
}

/** where Blackpaw waits: a step inside the cave mouth (the mouth faces SE: (−sin rot, −cos rot)) */
export const BLACKPAW_MOUTH = { x: BEAR_CAVE.x - Math.sin(BEAR_CAVE.rot) * 1.5, z: BEAR_CAVE.z - Math.cos(BEAR_CAVE.rot) * 1.5 };
const MOUTH = BLACKPAW_MOUTH;

/** A script's own state beyond its brain's, as plain values (a renderer-free continuation). */
export type PineEliteFields = Record<string, number | boolean | null>;

/** One named elite: the shared brain (lair wander, home, phase) over its seeded streams, its spawn, despawn and trophy. */
export abstract class PineEliteScript<B extends PineEliteBody> extends EliteBrain<B> {
  override mode = 'idle';
  override modeT = 0;
  override p2 = false;
  override setMode(mode: string): void { super.setMode(mode); }
  override toPlayer(a: B): { d: number; yaw: number } { return super.toPlayer(a); }
  voice(name: string, a: B): void { this.env.voice(name, a); }
  next(): number { return this.streams.fight.next(); }
  protected readonly who: (typeof PINE_ELITE_ANIMALS)[string];
  readonly streams: PineEliteStreams;
  override readonly def: (typeof PINE_ELITE_DEFS)[string];
  readonly env: PineEliteWorld<B>;
  constructor(id: string, env: PineEliteWorld<B>, seed?: number) {
    const def = PINE_ELITE_DEFS[id];
    if (def === undefined) throw new Error(`no elite '${id}'`);
    // the level seed's own streams (eliteStreams.ts), never Math.random or the page's salted ones: the same elite every boot
    const streams = pineEliteStreams(def.id, seed);
    super(def, { player: env.player, random: () => streams.fight.next() }); this.def = def; this.env = env;
    this.streams = streams;
    const who = PINE_ELITE_ANIMALS[def.id];
    if (who === undefined) throw new Error(`pine elite '${def.id}' has no animal`);
    this.who = who;
  }
  override spawn(): void {
    const L = this.def.lair;
    const a = this.env.spawn(this.who.kind, L.x, L.z, this.streams.spawn.next() * Math.PI * 2, this.who.variant);
    this.env.own(a); this.env.adopt(a);
    this.animal = a; this.p2 = false; this.setMode('idle'); this.wx = L.x; this.wz = L.z; this.wanderT = 0;
    pinBrain(a); inspectBrain(a, () => ({ state: this.brainState, picks: [], brainHz: 60, pinned: true }));
    this.onSpawn(a);
  }
  protected onSpawn(_a: B): void { /* per elite */ }
  override despawn(): void { this.clearTells(); if (this.animal) this.env.retire(this.animal); this.animal = null; }
  // the trophy is the kill feed's line and the journal's wall (TAKEN), not a pack item: Mott has no use for it (E314 C)
  trophy(): void { this.clearTells(); this.env.feed(`${this.def.drop.trophyName ?? 'Felled'} — ${this.def.name}`); }
  sig(): void { this.env.signature(this.def.id); }
  hurt(a: B, dmg: number, throughWalls = false): void { this.env.hurt(a, dmg, throughWalls); }
  /** dev / captures: run its signature move now */
  abstract force(move: string): void;
  /** the brain's and the script's own state (its lanes ride `lanes()`) */
  fields(): PineEliteFields { return { modeT: this.modeT, p2: this.p2, wx: this.wx, wz: this.wz, wanderT: this.wanderT, ...this.extra() }; }
  restoreFields(mode: string, f: PineEliteFields): void {
    const num = (k: string): number => { const v = f[k]; if (typeof v !== 'number') throw new Error(`Incompatible Pine elite field ${k}`); return v; };
    const bool = (k: string): boolean => { const v = f[k]; if (typeof v !== 'boolean') throw new Error(`Incompatible Pine elite field ${k}`); return v; };
    this.mode = mode; this.modeT = num('modeT'); this.p2 = bool('p2'); this.wx = num('wx'); this.wz = num('wz'); this.wanderT = num('wanderT');
    this.restoreExtra(num, bool, f);
  }
  protected extra(): PineEliteFields { return {}; }
  protected restoreExtra(_num: (k: string) => number, _bool: (k: string) => boolean, _raw: PineEliteFields): void { /* per elite */ }
  /** its lanes (a continuation saves each runner) */
  lanes(): readonly Lane<B>[] { return []; }
  /** its streams (a continuation saves their states) */
  rngs(): readonly PineEliteStreams['fight'][] { return [this.streams.spawn, this.streams.fight]; }
}

// ─────────────────────────────── Old Ironhide ───────────────────────────────

export class Ironhide<B extends PineEliteBody> extends PineEliteScript<B> {
  readonly lane: Lane<B>;
  again = false;
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('ironhide', env, seed);
    this.lane = env.lane(PINE_LANES.ironhide);
  }
  protected override clearTells(): void { this.lane.cancel(); }
  force(): void { const a = this.animal; if (a) { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); } }
  protected fight(a: B, dt: number, t: number): void { ironhideGoal(this, a, dt, t); }
  protected override extra(): PineEliteFields { return { again: this.again }; }
  protected override restoreExtra(_num: (k: string) => number, bool: (k: string) => boolean): void { this.again = bool('again'); }
  override lanes(): readonly Lane<B>[] { return [this.lane]; }
}

// ─────────────────────────────── the Ghost Stag ───────────────────────────────

export class GhostStag<B extends PineEliteBody> extends PineEliteScript<B> {
  cd = 3;
  lastHit = -Infinity;
  fadeT = 0;
  autoT = 5;
  constructor(env: PineEliteWorld<B>, seed?: number) { super('ghost-stag', env, seed); }
  protected override onSpawn(a: B): void { this.lastHit = a.lastHitT; this.cd = 3; }
  protected override clearTells(): void {
    const a = this.animal;
    if (a && this.mode === 'faded') this.reappear(a, a.position.x, a.position.z);
  }
  force(): void { const a = this.animal; if (a) this.fade(a); }
  protected fight(a: B, dt: number, t: number): void { ghostGoal(this, a, dt, t); }
  /** the fade: a pale burst, gone — no hitbox, no aim assist, no bar — for 2 s */
  fade(a: B): void {
    this.env.fx.fade(a);
    this.env.voice('deer_call', a);
    a.hidden = true; this.env.show(a, false); a.setMotion(a.yaw, 0, 1);
    this.fadeT = 2; this.cd = fadeCooldown(this.p2);
    this.setMode('faded'); this.sig();
  }
  /** back behind you, 14–18 m off, on dry walkable ground inside its leash */
  comeBack(a: B): void {
    const p = this.env.player.position, L = this.def.lair;
    for (const side of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8, Math.PI]) {
      const q = behindPlayer(p.x, p.z, this.env.player.yaw, 14 + this.next() * 4, side);
      if (!this.env.inChunk(q.x, q.z, 24) || Math.hypot(q.x - L.x, q.z - L.z) > this.def.leashR - 12) continue;
      if (Math.abs(this.env.heightAt(q.x, q.z) - this.env.heightAt(p.x, p.z)) > 6) continue;
      this.reappear(a, q.x, q.z); return;
    }
    this.reappear(a, a.position.x, a.position.z);
  }
  private reappear(a: B, x: number, z: number): void {
    const p = this.env.player.position;
    a.place(x, z, headingTo(x, z, p.x, p.z));
    a.hidden = false; this.env.show(a, true);
    this.env.fx.reappear(a);
    this.setMode('stare');
  }
  protected override extra(): PineEliteFields { return { cd: this.cd, lastHit: this.lastHit === -Infinity ? null : this.lastHit, fadeT: this.fadeT, autoT: this.autoT, hidden: this.animal?.hidden === true }; }
  protected override restoreExtra(num: (k: string) => number, bool: (k: string) => boolean, raw: PineEliteFields): void {
    this.cd = num('cd'); this.lastHit = raw['lastHit'] === null ? -Infinity : num('lastHit'); this.fadeT = num('fadeT'); this.autoT = num('autoT');
    const a = this.animal; if (a) { a.hidden = bool('hidden'); this.env.show(a, !a.hidden); }
  }
}

// ─────────────────────────────── Old Blackpaw ───────────────────────────────

export class Blackpaw<B extends PineEliteBody> extends PineEliteScript<B> {
  readonly ring: PineRingTell;
  readonly lane: Lane<B>;
  roarCd = 0;
  swipeT = -1;
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('blackpaw', env, seed);
    this.ring = env.ring();
    this.lane = env.lane(PINE_LANES.blackpaw);
  }
  protected override onSpawn(a: B): void { this.lurk(a); }
  protected override clearTells(): void { this.ring.hide(); this.lane.cancel(); this.swipeT = -1; }
  get ringR(): number { return this.p2 ? 11 : 8; }
  /** in the cave: out of sight at the mouth */
  private lurk(a: B): void {
    a.place(MOUTH.x, MOUTH.z, BEAR_CAVE.rot + Math.PI);
    a.hidden = true; this.env.show(a, false);
    this.setMode('lurk');
  }
  force(move: string): void {
    const a = this.animal; if (!a) return;
    if (a.hidden) this.burstOut(a);
    if (move === 'roar') this.setMode('roar'); else { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); }
  }
  protected override idle(a: B, dt: number): void {
    if (this.mode === 'lurk') return;
    // back from a fight: walk to the mouth, then in (only when you are not watching from close by)
    const d = Math.hypot(MOUTH.x - a.position.x, MOUTH.z - a.position.z);
    if (d > 2.5) { a.setMotion(headingTo(a.position.x, a.position.z, MOUTH.x, MOUTH.z), 2.2, 2); return; }
    if (a.position.distanceTo(this.env.player.position) > 35) this.lurk(a); else super.idle(a, dt);
  }
  burstOut(a: B): void {
    const p = this.env.player.position;
    a.place(MOUTH.x - Math.sin(BEAR_CAVE.rot) * 2.5, MOUTH.z - Math.cos(BEAR_CAVE.rot) * 2.5, headingTo(MOUTH.x, MOUTH.z, p.x, p.z));
    a.hidden = false; this.env.show(a, true);
    this.env.fx.burstOut(a);
    this.sig();
  }
  roarFx(a: B): void { this.env.fx.roar(a, this.ringR); }
  protected fight(a: B, dt: number, t: number): void { blackpawGoal(this, a, dt, t); }
  protected override extra(): PineEliteFields { return { roarCd: this.roarCd, swipeT: this.swipeT, hidden: this.animal?.hidden === true }; }
  protected override restoreExtra(num: (k: string) => number, bool: (k: string) => boolean): void {
    this.roarCd = num('roarCd'); this.swipeT = num('swipeT');
    const a = this.animal; if (a) { a.hidden = bool('hidden'); this.env.show(a, !a.hidden); }
  }
  override lanes(): readonly Lane<B>[] { return [this.lane]; }
}

// ─────────────────────────────── the Imperial Bull ───────────────────────────────

interface Rival<B extends PineEliteBody> { a: B; lane: Lane<B>; mode: 'approach' | 'charge' }

export class ImperialBull<B extends PineEliteBody> extends PineEliteScript<B> {
  readonly lane: Lane<B>;
  private readonly rivalLanes: Lane<B>[];
  rivals: Rival<B>[] = [];
  bugledPhase = -1;
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('imperial-bull', env, seed);
    this.lane = env.lane(PINE_LANES.imperial);
    this.rivalLanes = [0, 1].map(() => env.lane(PINE_LANES.rival));
  }
  protected override clearTells(): void { this.lane.cancel(); }
  override reset(): void { super.reset(); this.releaseRivals(); this.bugledPhase = -1; }
  override trophy(): void { super.trophy(); this.releaseRivals(); }
  override despawn(): void { this.releaseRivals(); super.despawn(); }
  private releaseRivals(): void { for (const r of this.rivals) { r.lane.cancel(); this.env.release(r.a); } this.rivals = []; }
  force(move: string): void {
    const a = this.animal; if (!a) return;
    if (move === 'bugle') this.setMode('bugle');
    else { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); }
  }
  callRivals(a: B): void {
    const p = this.env.player.position, { yaw } = this.toPlayer(a);
    for (const [i, side] of [1, -1].entries()) {
      const ang = yaw + side * Math.PI / 2;
      let x = p.x + Math.sin(ang) * 55, z = p.z + Math.cos(ang) * 55;
      if (!this.env.inChunk(x, z, 24)) { x = p.x - Math.sin(ang) * 40; z = p.z - Math.cos(ang) * 40; }
      const r = this.env.spawn('elk', x, z, headingTo(x, z, p.x, p.z), i === 0 ? 'big-bull' : 'bull');
      this.env.own(r);
      const lane = this.rivalLanes[i];
      if (lane) this.rivals.push({ a: r, lane, mode: 'approach' });
      this.env.voice('elk_bugle', r);
    }
  }
  tickRivals(dt: number, t: number): void {
    const p = this.env.player.position;
    for (const r of this.rivals) {
      if (!r.a.alive) { r.lane.cancel(); continue; }
      const d = Math.hypot(p.x - r.a.position.x, p.z - r.a.position.z);
      r.a.lookTarget.copy(p); r.a.lookWeight = 1;
      if (r.mode === 'charge') { r.lane.update(r.a, dt, t, p, (dmg) => { this.hurt(r.a, dmg); this.env.trauma(0.35); }); if (!r.lane.busy) r.mode = 'approach'; continue; }
      r.a.setMotion(headingTo(r.a.position.x, r.a.position.z, p.x, p.z), d > 16 ? 7 : 1.5, 2.5);
      if (d < 20 && this.next() < dt * 0.6) { r.lane.start(r.a, p.x, p.z, 0.9); r.mode = 'charge'; }
    }
    this.rivals = this.rivals.filter((r) => r.a.alive || r.lane.busy);
  }
  protected fight(a: B, dt: number, t: number): void { imperialGoal(this, a, dt, t); }
  /** each rival lane's bull as its creature number (`creature:<n>`) and its mode; null: that lane has none */
  protected override extra(): PineEliteFields {
    const out: PineEliteFields = { bugledPhase: this.bugledPhase };
    this.rivalLanes.forEach((lane, i) => {
      const r = this.rivals.find(x => x.lane === lane), n = r === undefined ? null : Number(/^creature:(\d+)$/u.exec(r.a.entityId)?.[1]);
      if (n !== null && !Number.isInteger(n)) throw new Error(`Unsaveable Imperial Bull rival ${r?.a.entityId ?? ''}`);
      out[`rival${String(i)}`] = n; out[`rivalCharge${String(i)}`] = r?.mode === 'charge';
    });
    return out;
  }
  protected override restoreExtra(num: (k: string) => number, bool: (k: string) => boolean, raw: PineEliteFields): void {
    this.bugledPhase = num('bugledPhase');
    this.rivals = [];
    this.rivalLanes.forEach((lane, i) => {
      if (raw[`rival${String(i)}`] === null) return;
      const id = `creature:${String(num(`rival${String(i)}`))}`, a = this.env.find(id);
      if (a === null) throw new Error(`Incompatible Imperial Bull rival ${id}`);
      this.rivals.push({ a, lane, mode: bool(`rivalCharge${String(i)}`) ? 'charge' : 'approach' });
    });
  }
  override lanes(): readonly Lane<B>[] { return [this.lane, ...this.rivalLanes]; }
}

/** The four in the system's order (the page's add order). */
export function pineEliteScripts<B extends PineEliteBody>(env: PineEliteWorld<B>, seed?: number): [Ironhide<B>, GhostStag<B>, Blackpaw<B>, ImperialBull<B>] {
  return [new Ironhide(env, seed), new GhostStag(env, seed), new Blackpaw(env, seed), new ImperialBull(env, seed)];
}
