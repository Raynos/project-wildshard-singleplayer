import { PineElitePrelude } from '../runtime/elitePrelude';
import type { Vector3 } from 'three';
import { EliteBrain, type EliteActor } from '@wildshard/engine/ai/EliteBrain';
import { inspectBrain, pinBrain } from '@wildshard/engine/ai/inspect';
import { BEAR_CAVE } from '../layout';
import { bossFight } from '@wildshard/game/plugin/bossPhase';
import { moduleBytes, stepEliteScript, type EliteScriptLane as EliteScript, type EliteScriptPorts } from '@wildshard/game/plugin/brain';
import { parseEliteScript, type EliteScriptData as EliteScriptRow } from '@wildshard/format/eliteScripts';
import { BLACKPAW_BRAIN, GHOST_STAG_BRAIN, IMPERIAL_BULL_BRAIN, IRONHIDE_BRAIN, PINE_ELITE_MODULES } from '../runtime/brains/eliteBrains';
import { PINE_ELITE_ANIMALS, PINE_ELITE_DEFS } from './eliteRoster';
import { pineEliteStreams, type PineEliteStreams } from './eliteStreams';
import { behindPlayer, bugleHour, fadeCooldown, headingTo } from './combatMath';
import { PINE_LANES, PINE_STRIKES, pineContact } from './strikes';
import type { Lane, LaneBody } from './lane';

/**
 * Pine Hollow's four named elites' scripts, renderer-free (SF72): Old Ironhide, the Ghost Stag, Old Blackpaw and the Imperial
 * Bull as one implementation over any body and world (each satisfies the game's `EliteCoreScript`). The page (elites.ts) gives them its Animals, its decals, puffs and voices;
 * a renderer-free host (runtime/elites.ts) gives them its bodies, bare lanes and silent effects. Every random draw is the elite's
 * own seeded stream (eliteStreams.ts). The rules around them (lair, aware / engaged / leash, phase 2, respawn) are the game's
 * `EliteCore` (@wildshard/game/eliteSystem). Their fights — the moves and clocks — are admitted elite scripts (SF27:
 * behaviour/<name>.as, data/eliteBrains.ts); these classes are their hosts (spawn, lair, tells, the actions a script names)
 * and keep the continuation's field names. The behaviour is told in elites.ts.
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
  /** the elite's admitted fight script (its slots are the fight's state) */
  readonly script: EliteScript;
  /** Authored outer encounter selection, distinct from the existing admitted fight script. */
  readonly prelude: PineElitePrelude;
  private frameDt = 0;
  private frameTime = 0;
  constructor(id: string, env: PineEliteWorld<B>, row: EliteScriptRow, seed?: number) {
    const def = PINE_ELITE_DEFS[id];
    if (def === undefined) throw new Error(`no elite '${id}'`);
    // the level seed's own streams (eliteStreams.ts), never Math.random or the page's salted ones: the same elite every boot
    const streams = pineEliteStreams(def.id, seed);
    super(def, { player: env.player, random: () => streams.fight.next() }); this.def = def; this.env = env;
    this.streams = streams;
    this.prelude = new PineElitePrelude({
      alive: () => this.animal?.alive === true,
      clock: () => { this.modeT += this.frameDt; },
      clear: () => { this.clearTells(); },
      home: () => { this.goHome(this.preludeBody()); },
      fight: () => { this.fight(this.preludeBody(), this.frameDt, this.frameTime); },
      idle: () => { this.idle(this.preludeBody(), this.frameDt); },
    });
    const bytes = PINE_ELITE_MODULES[row.module];
    if (bytes === undefined) throw new Error(`pine elite '${id}' has no module`);
    this.script = bossFight({ kind: 'boss', pattern: 'script', fight: parseEliteScript(row) }, { bytes: moduleBytes(bytes), random: () => streams.fight.next() });
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
  /** Advance at the original owner phase; rows select the same ordered native actions. */
  override tick(dt: number, t: number, engaged: boolean, leashing: boolean): void {
    this.frameDt = dt; this.frameTime = t;
    this.prelude.advance(engaged, leashing);
  }
  private preludeBody(): B {
    const animal = this.animal;
    if (animal === null || !animal.alive) throw new Error('Pine elite prelude requires its live native body');
    return animal;
  }
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
  /** the fight: one engaged step of its admitted script (the row's lanes step first, then its verbs in order) */
  protected fight(a: B, dt: number, t: number): void {
    const { d, yaw } = this.toPlayer(a);
    stepEliteScript(this.script, { body: a, dt, t, mode: this.mode, modeT: this.modeT, p2: this.p2, d, yaw, player: this.env.player.position, god: this.env.god }, this.scriptPorts(a, dt, t));
  }
  /** the verbs' world: the shared voices, lanes and contacts, and this elite's own actions */
  protected scriptPorts(a: B, dt: number, t: number): EliteScriptPorts {
    const lane = (i: number): Lane<B> => { const l = this.lanes()[i]; if (l === undefined) throw new Error(`pine elite '${this.def.id}' has no lane ${String(i)}`); return l; };
    const p = this.env.player.position;
    return {
      setMode: (mode) => { this.setMode(mode); }, voice: (name) => { this.voice(name, a); }, signature: () => { this.sig(); },
      lane: (i) => this.lanes()[i] ?? null, stepLane: (i, trauma) => { lane(i).update(a, dt, t, p, (dmg) => { this.hurt(a, dmg); this.env.trauma(trauma); }); },
      startLane: (i, tell, speedMul) => { lane(i).start(a, p.x, p.z, tell, speedMul); },
      contact: (row) => {
        const spec = Object.values(PINE_STRIKES).find(s => s.id === row.strike);
        if (spec === undefined) throw new Error(`pine elite '${this.def.id}' names no strike ${row.strike}`);
        pineContact(a, p, spec, (damage) => { if (row.stun > 0) this.env.stun(row.stun); this.hurt(a, damage, row.throughWalls); this.env.trauma(row.trauma); }, () => this.env.reach(a, p));
      },
      trauma: (k) => { this.env.trauma(k); },
      ring: () => undefined, ringHide: () => undefined,
      action: (name) => { this.act(name, a); },
    };
  }
  /** one of the elite's own actions its script names */
  protected act(name: string, _a: B): void { throw new Error(`pine elite '${this.def.id}' has no action ${name}`); }
}

// ─────────────────────────────── Old Ironhide ───────────────────────────────

export class Ironhide<B extends PineEliteBody> extends PineEliteScript<B> {
  readonly lane: Lane<B>;
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('ironhide', env, IRONHIDE_BRAIN, seed);
    this.lane = env.lane(PINE_LANES.ironhide);
  }
  /** a second charge is owed (phase 2) */
  get again(): boolean { return this.script.slot('again') !== 0; }
  protected override clearTells(): void { this.lane.cancel(); }
  force(): void { const a = this.animal; if (a) { const p = this.env.player.position; this.lane.start(a, p.x, p.z, 60); this.setMode('charge'); } }
  protected override extra(): PineEliteFields { return { again: this.again }; }
  protected override restoreExtra(_num: (k: string) => number, bool: (k: string) => boolean): void { this.script.setSlot('again', bool('again') ? 1 : 0); }
  override lanes(): readonly Lane<B>[] { return [this.lane]; }
}

// ─────────────────────────────── the Ghost Stag ───────────────────────────────

/** the Ghost Stag's never-hit mark in its `lastHit` slot (the row's initial value) */
const NEVER = GHOST_STAG_BRAIN.slots.find(s => s.field === 'lastHit')?.initial ?? -1e6;

export class GhostStag<B extends PineEliteBody> extends PineEliteScript<B> {
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('ghost-stag', env, GHOST_STAG_BRAIN, seed);
    if (GHOST_STAG_BRAIN.parameters[2] !== this.def.leashR) throw new Error("the Ghost Stag's script leash is not its lair's");
  }
  /** seconds until it may fade again */
  get cd(): number { return this.script.slot('cd'); }
  /** seconds left faded */
  get fadeT(): number { return this.script.slot('fadeT'); }
  /** phase 2: seconds to its next fade of its own */
  get autoT(): number { return this.script.slot('autoT'); }
  /** the body's last hit time it has seen (-Infinity: none yet) */
  get lastHit(): number { const v = this.script.slot('lastHit'); return v <= NEVER ? -Infinity : v; }
  protected override onSpawn(a: B): void { this.script.setSlot('lastHit', Math.max(NEVER, a.lastHitT)); this.script.setSlot('cd', 3); }
  protected override clearTells(): void {
    const a = this.animal;
    if (a && this.mode === 'faded') this.reappear(a, a.position.x, a.position.z);
  }
  force(): void {
    const a = this.animal; if (!a) return;
    this.vanish(a); this.script.setSlot('fadeT', 2); this.script.setSlot('cd', fadeCooldown(this.p2)); this.setMode('faded'); this.sig();
  }
  protected override act(name: string, a: B): void { if (name === 'fade') this.vanish(a); else if (name === 'comeBack') this.comeBack(a); else super.act(name, a); }
  /** the fade: a pale burst, gone — no hitbox, no aim assist, no bar (the script keeps its 2 s and the cooldown) */
  private vanish(a: B): void {
    this.env.fx.fade(a);
    this.env.voice('deer_call', a);
    a.hidden = true; this.env.show(a, false); a.setMotion(a.yaw, 0, 1);
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
    this.script.setSlot('cd', num('cd')); this.script.setSlot('lastHit', raw['lastHit'] === null ? NEVER : num('lastHit'));
    this.script.setSlot('fadeT', num('fadeT')); this.script.setSlot('autoT', num('autoT'));
    const a = this.animal; if (a) { a.hidden = bool('hidden'); this.env.show(a, !a.hidden); }
  }
}

// ─────────────────────────────── Old Blackpaw ───────────────────────────────

export class Blackpaw<B extends PineEliteBody> extends PineEliteScript<B> {
  readonly ring: PineRingTell;
  readonly lane: Lane<B>;
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('blackpaw', env, BLACKPAW_BRAIN, seed);
    this.ring = env.ring();
    this.lane = env.lane(PINE_LANES.blackpaw);
  }
  /** seconds until he may roar again */
  get roarCd(): number { return this.script.slot('roarCd'); }
  /** seconds until the swipe lands (negative: none pending) */
  get swipeT(): number { return this.script.slot('swipeT'); }
  protected override onSpawn(a: B): void { this.lurk(a); }
  protected override clearTells(): void { this.ring.hide(); this.lane.cancel(); this.script.setSlot('swipeT', -1); }
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
  protected override scriptPorts(a: B, dt: number, t: number): EliteScriptPorts {
    return { ...super.scriptPorts(a, dt, t),
      ring: (radius, alpha) => { this.ring.ring(a.position.x, a.position.z, radius, alpha); }, ringHide: () => { this.ring.hide(); },
      ringTime: () => { this.ring.setTime(t); } };
  }
  protected override act(name: string, a: B): void { if (name === 'burstOut') this.burstOut(a); else if (name === 'roarFx') this.env.fx.roar(a, this.ringR); else super.act(name, a); }
  protected override extra(): PineEliteFields { return { roarCd: this.roarCd, swipeT: this.swipeT, hidden: this.animal?.hidden === true }; }
  protected override restoreExtra(num: (k: string) => number, bool: (k: string) => boolean): void {
    this.script.setSlot('roarCd', num('roarCd')); this.script.setSlot('swipeT', num('swipeT'));
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
  constructor(env: PineEliteWorld<B>, seed?: number) {
    super('imperial-bull', env, IMPERIAL_BULL_BRAIN, seed);
    this.lane = env.lane(PINE_LANES.imperial);
    this.rivalLanes = [0, 1].map(() => env.lane(PINE_LANES.rival));
  }
  /** the last phase he bugled in (-1: none yet) */
  get bugledPhase(): number { return this.script.slot('bugledPhase'); }
  protected override clearTells(): void { this.lane.cancel(); }
  override reset(): void { super.reset(); this.releaseRivals(); this.script.setSlot('bugledPhase', -1); }
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
  /** the rivals run first (they charge too); the script then reads how many live and whether it is the bugle hour */
  protected override fight(a: B, dt: number, t: number): void { this.tickRivals(dt, t); super.fight(a, dt, t); }
  protected override scriptPorts(a: B, dt: number, t: number): EliteScriptPorts {
    return { ...super.scriptPorts(a, dt, t), hostValues: () => [this.rivals.length, bugleHour(this.env.dusk(), this.env.night()) ? 1 : 0] };
  }
  protected override act(name: string, a: B): void { if (name === 'callRivals') this.callRivals(a); else super.act(name, a); }
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
    this.script.setSlot('bugledPhase', num('bugledPhase'));
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
