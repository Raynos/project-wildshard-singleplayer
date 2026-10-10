// Frozen shipping Antler King oracle, before the phasedBoss port. Do not update to follow the platform.
import { Vector3 } from 'three';
import type { BossBrain, BossScript } from '@wildshard/engine/ai/BossBrain';
import { fnv1a32, Rng, type RngState } from '@wildshard/engine/core/rng';
import { KINGS_CLEARING } from '../../../src/shards/pine-hollow/layout';
import { KING_PHASE_AT, burnTick, headingTo, wallPush } from '../../../src/shards/pine-hollow/combat/combatMath';
import { PINE_LEVEL_SEED } from '../../../src/shards/pine-hollow/combat/eliteStreams';
import { PINE_STRIKES, pineContact } from '../../../src/shards/pine-hollow/combat/strikes';
import type { Lane, LaneBody, LaneState } from '../../../src/shards/pine-hollow/combat/lane';
import { AntlerKingGoals, type KingGoalEnv } from './antlerKingGoals';

const C = KINGS_CLEARING;
/** the arena's threshold, the soft wall, the fog wall and his own leash round the clearing's centre (m) */
export const KING_ARENA_IN = 22, KING_WALL_R = 27.5, KING_FOG_R = 31, KING_LEASH_R = 24;
/** the rearing strike's slam: the forehooves land 4.0 m ahead, ±1.7 m off his line (4.4 m out): the root ring bursts from there */
const STOMP_R = 4.4;

/** A body the King's fight drives: his own, or a thrall's (the page's Animal, the headless host's body). */
export interface KingBody extends LaneBody { hp: number; readonly maxHp: number; herd: number; place: (x: number, z: number, yaw: number) => void }
/** What the King's fight reads of the world beyond his goals' (the page's PineCtx over its Player, the host's player). */
export interface KingCoreEnv<B extends KingBody> extends KingGoalEnv<B> {
  readonly player: { readonly position: Vector3; readonly onGround: boolean; shove: (fromX: number, fromZ: number, speed: number) => void };
}

/** The King's two random streams (SF72), from the level seed alone in the browser and headless alike: where a thrall walks
 *  out of the fog (`pine.king.call`, one draw a thrall) and when it starts down its lane (`pine.king.charge`, a draw a tick
 *  in range), each a uniform [0, 1) draw as Math.random was. */
export interface PineKingStreams { readonly call: Rng; readonly charge: Rng }
export function pineKingStreams(seed: number = PINE_LEVEL_SEED): PineKingStreams {
  return { call: new Rng(fnv1a32(`${String(seed)}:pine.king.call`)), charge: new Rng(fnv1a32(`${String(seed)}:pine.king.charge`)) };
}

/** A fallen lantern burning where it landed: its spot, its fall (−1 out, 0..1 falling, 1 burning) and its burn's bite clock. */
export interface KingLantern { x: number; z: number; y: number; fallT: number; acc: number }
/** A thrall the King called: its body, its lane and whether it is running it. */
export interface KingThrall<B extends KingBody> { a: B; lane: Lane<B>; mode: 'approach' | 'charge' }

/** The fight's own continuation beside BossBrain's (the headless runtime's `fight`; bodies by entity id). */
export interface KingFightState {
  king: string | null; present: boolean; sealed: boolean; sealK: number; darkK: number; glow: number; invuln: boolean; lockHp: number; won: boolean;
  phase: number; mode: string; modeT: number; sweepCd: number; stompCd: number; callCd: number; laneN: number; open: number;
  lane: LaneState; waves: { r: number; on: boolean; hit: boolean; delay: number }[]; lanterns: KingLantern[];
  thralls: { a: string; lane: number; mode: 'approach' | 'charge' }[]; thrallLanes: LaneState[]; rngs: RngState[];
}

/**
 * THE ANTLER KING's whole fight, renderer-free (SF72): the `BossScript` the engine's boss brain runs (his presence at night,
 * the seal and its soft wall, reset per checkpoint, the intro's beats, the phases, victory), his moves (AntlerKingGoals), the
 * root rings, the lanterns that fall and burn, the thralls he calls out of the fog (their lanes and charges), his leash to
 * the stones, the beat's held health and the ribcage's damage multiplier. Every roll is from the level seed's King streams.
 * One fight, two hosts: the page's `AntlerKingFight` (runtime/antlerKing.ts) is this plus its views (the model, the tells,
 * the fog wall, the light, the puffs and the dark), overriding the view hooks below; the headless runtime (runtime/king.ts)
 * runs it on the simulation host with the hooks silent.
 */
export abstract class AntlerKingCore<B extends KingBody> extends AntlerKingGoals<B> implements BossScript {
  king: B | null = null;
  protected abstract override readonly ctx: KingCoreEnv<B>;
  protected abstract override readonly waves: { r: number; on: boolean; hit: boolean; delay: number }[];
  protected abstract readonly thrallLanes: readonly Lane<B>[];
  protected readonly lanterns: KingLantern[] = [0, 1, 2].map(() => ({ x: 0, z: 0, y: 0, fallT: -1, acc: 0 }));
  protected thralls: KingThrall<B>[] = [];
  protected readonly rng: PineKingStreams;
  protected invuln = false; protected lockHp = 0;
  protected sealK = 0; protected sealed = false;
  protected darkK = 0; protected glow = 0;
  protected present = false;
  protected won = false;

  protected constructor(seed: number = PINE_LEVEL_SEED) { super(); this.rng = pineKingStreams(seed); }

  // ── the hosts' bodies and views ──
  /** the terrain's height (the page's terrainHeight, the host's height query) */
  protected abstract groundAt(x: number, z: number): number;
  /** a fresh King body at the clearing (the old one, if any, already retired) */
  protected abstract makeKing(): B;
  protected abstract retireKing(k: B): void;
  /** out of every list (AI, aim, hitboxes) and hidden, kept for tonight; and back */
  protected abstract parkKing(k: B): void;
  protected abstract unparkKing(k: B): void;
  /** a thrall of `kind` walking out of the fog at (x, z), and its retirement */
  protected abstract spawnThrall(kind: 'elk' | 'boar', x: number, z: number, yaw: number): B;
  protected abstract retireThrall(a: B): void;
  /** the point a hit lands on is his ribcage (the weak point: the page's model; headless has no model yet) */
  protected onRibs(_p: Vector3): boolean { return false; }
  /** views: the ribcage's glow, the lanterns hung on his rack, the intro's camera focus, the room's tick (fog wall, puffs,
   *  ribcage, light), a lantern's fall / burn, a thrall's arrival or exit, the light's release */
  protected glowTo(_v: number): void { /* view */ }
  protected lanternsHung(_on: boolean): void { /* view */ }
  protected introFocus(k: B, out: Vector3): Vector3 { return out.copy(k.position); }
  protected room(_dt: number, _t: number): void { /* view */ }
  protected lanternView(_i: number, _f: KingLantern, _t: number, _event: 'drop' | 'fall' | 'land' | 'burn' | 'out' | 'placed'): void { /* view */ }
  protected thrallView(_a: B, _event: 'in' | 'out'): void { /* view */ }
  protected lightOn(): void { /* view */ }
  protected lightOff(): void { /* view */ }
  protected stompFx(_k: B): void { /* view */ }

  // ── BossScript ──
  get weatherHold(): number { return this.sealK; }
  get hpFrac(): number { const k = this.king; return k ? Math.max(0, k.hp / k.maxHp) : 0; }
  get shielded(): boolean { return this.invuln; }
  get dead(): boolean { return this.king !== null && !this.king.alive; }
  inArena(p: Vector3): boolean { return this.present && Math.hypot(p.x - C.x, p.z - C.z) < KING_ARENA_IN; }
  seal(on: boolean): void { this.sealed = on; }
  clampHp(frac: number): void { const k = this.king; if (k) { k.hp = Math.max(1, Math.round(k.maxHp * frac)); this.lockHp = k.hp; } }
  setInvulnerable(on: boolean): void { this.invuln = on; if (on && this.king) this.lockHp = this.king.hp; }
  rewardPoint(): Vector3 { return new Vector3(C.x, this.groundAt(C.x, C.z + 4) + 0.2, C.z + 4); }
  respawnPoint(): { pos: Vector3; yaw: number } { return { pos: new Vector3(C.x, this.groundAt(C.x, C.z + 26), C.z + 26), yaw: 0 }; }

  protected spawnKing(): B {
    const old = this.king;
    if (old) this.retireKing(old);
    const a = this.makeKing();
    a.herd = -1;
    this.king = a;
    return a;
  }

  /** in the world tonight (true) or not at all */
  setPresent(on: boolean): void {
    if (on === this.present) return;
    this.present = on;
    const k = this.king;
    if (on) { if (k === null || !k.alive) this.spawnKing(); else this.unparkKing(k); }
    else {
      if (k) { if (k.alive) this.parkKing(k); else { this.retireKing(k); this.king = null; } }
      this.clearAdds(); this.hideTells(); this.setHazards(false);
      this.sealed = false; this.mode = 'dormant';
      this.lightOff();
    }
  }

  reset(phase: number): void {
    this.phase = phase; this.won = false;
    if (!this.present) this.setPresent(true);
    let k = this.king;
    if (k === null || !k.alive) k = this.spawnKing();
    k.place(C.x, C.z, 0);
    k.hp = Math.max(1, Math.round(k.maxHp * (KING_PHASE_AT[phase] ?? 1)));
    k.setMotion(0, 0, 1); k.lookWeight = 0; k.cancelAttack();
    this.clearAdds(); this.hideTells();
    this.lanternsHung(phase < 1);
    this.setHazards(phase >= 1);
    this.glow = 0.15; this.glowTo(this.glow); this.open = 0;
    this.darkK = 0;
    this.mode = 'dormant';
    this.sweepCd = 2; this.stompCd = 3; this.callCd = 0;
  }

  intro(t: number, short: boolean): Vector3 {
    const k = this.king;
    if (!k) return new Vector3(C.x, this.groundAt(C.x, C.z) + 4, C.z);
    const len = short ? 1.4 : 4.2;
    if (this.mode !== 'intro') { this.mode = 'intro'; this.modeT = 0; this.ctx.shot('king_bells', k.position); }
    this.modeT = t;
    this.glow = Math.max(0.15, smoothstep(t, 0.2, len * 0.75));
    this.glowTo(this.glow);
    k.lookTarget.copy(this.ctx.player.position); k.lookWeight = Math.min(1, t / (len * 0.5));
    if (t > len * 0.6 && t - 1 / 30 <= len * 0.6) { this.ctx.shot('king_roar', k.position); this.roar(k); }
    this.lightOn();
    return this.introFocus(k, new Vector3());
  }

  begin(phase: number): void {
    this.phase = phase; this.glow = 1; this.glowTo(1);
    this.setMode(phase === 2 ? 'stalk3' : 'stalk');
    this.lightOn();
    if (phase >= 1 && this.thralls.length === 0) this.callCd = 1.5;
  }

  enterPhase(phase: number): void {
    this.phase = phase;
    this.hideTells(); this.lane.cancel();
    if (phase === 1) { this.dropLanterns(); this.callCd = 1.2; this.setMode('stalk'); }
    if (phase === 2) { this.setMode('stalk3'); this.laneN = 0; this.ctx.shot('king_roar', this.king?.position ?? new Vector3(C.x, 0, C.z)); }
  }

  victory(): void {
    this.won = true; this.mode = 'dead';
    this.hideTells(); this.lane.cancel();
    for (const th of this.thralls) { if (th.a.alive) { this.thrallView(th.a, 'out'); this.retireThrall(th.a); } th.lane.cancel(); }
    this.thralls = [];
    this.setHazards(false);
    this.glow = 0.25; this.glowTo(this.glow);
    this.lightOff();
  }

  update(dt: number, t: number, fighting: boolean): void {
    const k = this.king;
    // the seal: the fog wall + the thick air come in over ~2 s, and go the same way
    this.sealK = clamp01(this.sealK + (this.sealed ? dt / 2 : -dt / 2.5));
    this.darkK = clamp01(this.darkK + ((this.phase === 2 && !this.won && this.sealed) ? dt / 2.5 : -dt / 2));
    this.room(dt, t);
    this.hazards(dt, t, fighting);
    if (!k) return;
    if (this.invuln && k.hp < this.lockHp) k.hp = this.lockHp;
    if (this.sealed) this.softWall();
    if (!fighting || !k.alive) { this.open = Math.max(0, this.open - dt * 2); return; }
    this.modeT += dt;
    this.fight(k, dt, t);
    this.tickThralls(dt, t);
    // he never leaves the stones
    const kd = Math.hypot(k.position.x - C.x, k.position.z - C.z);
    if (kd > KING_LEASH_R) {
      k.position.x = C.x + (k.position.x - C.x) / kd * KING_LEASH_R; k.position.z = C.z + (k.position.z - C.z) / kd * KING_LEASH_R;
      this.lane.recoverNow();
    }
  }

  /** a hit's multiplier on him: the beat and the dormant King all but shrug it off; the open ribcage ×3, shut ×0.6, bark ×0.25 */
  damageMul(a: B, p: Vector3): number {
    if (a !== this.king) return 1;
    if (this.invuln || this.mode === 'dormant') return 0.01;
    if (this.onRibs(p)) return this.open > 0.5 ? 3 : 0.6;
    return 0.25;
  }

  /** the stomp lands: the root ring(s) race out (two in pairs from phase II) */
  protected override stompNow(k: B): void {
    this.stompFx(k);
    this.ctx.shot('king_stomp', k.position);
    this.ctx.trauma(0.3);
    const n = this.phase >= 1 ? 2 : 1;
    this.waves.forEach((w, i) => { w.on = i < n; w.r = STOMP_R; w.hit = false; w.delay = i * 0.8; });
  }
  protected override tickWaves(k: B, dt: number, t: number): void {
    const p = this.ctx.player.position;
    const pd = Math.hypot(p.x - C.x, p.z - C.z) < KING_FOG_R ? Math.hypot(p.x - k.position.x, p.z - k.position.z) : Infinity;
    this.waves.forEach((w, i) => {
      if (!w.on) { this.waveView(i, t, null); return; }
      if (w.delay > 0) { w.delay -= dt; return; }
      w.r += dt * 10.5;
      this.waveView(i, t, k.position);
      if (!w.hit && pd !== Infinity) w.hit = pineContact(k, p, PINE_STRIKES.roots, (damage) => { this.ctx.hurt(k, damage, true); this.ctx.trauma(0.4); }, () => this.ctx.reach(k, p), { ringRadius: w.r, airborne: !this.ctx.player.onGround });
      if (w.r > KING_FOG_R) { w.on = false; this.waveView(i, t, null); }
    });
  }
  /** a root ring's view round `at` at its radius, or hidden (null) */
  protected waveView(_i: number, _t: number, _at: Vector3 | null): void { /* view */ }

  // ── thralls ──
  protected override aliveThralls(): number { return this.thralls.filter((th) => th.a.alive).length; }
  protected override callThralls(n: number): void {
    const p = this.ctx.player.position;
    for (let i = 0; i < n; i++) {
      const lane = this.thrallLanes.find((l) => !this.thralls.some((th) => th.lane === l && th.a.alive));
      if (!lane) break;
      const ang = this.rng.call.next() * Math.PI * 2, x = C.x + Math.sin(ang) * 27, z = C.z + Math.cos(ang) * 27;
      const kind = i % 2 === 0 ? 'elk' : 'boar';
      const a = this.spawnThrall(kind, x, z, headingTo(x, z, p.x, p.z));
      this.thralls = this.thralls.filter((th) => th.lane !== lane);
      this.thralls.push({ a, lane, mode: 'approach' });
      this.thrallView(a, 'in');
      this.ctx.shot('thrall_call', a.position);
    }
  }
  protected tickThralls(dt: number, t: number): void {
    const p = this.ctx.player.position;
    for (const th of this.thralls) {
      const a = th.a;
      if (!a.alive) { th.lane.cancel(); continue; }
      a.lookTarget.copy(p); a.lookWeight = 1;
      if (th.mode === 'charge') { th.lane.update(a, dt, t, p, (dmg) => { this.ctx.hurt(a, dmg); this.ctx.trauma(0.3); }); if (!th.lane.busy) th.mode = 'approach'; }
      else {
        const d = Math.hypot(p.x - a.position.x, p.z - a.position.z);
        a.setMotion(headingTo(a.position.x, a.position.z, p.x, p.z), d > 8 ? 4.8 : d > 4.5 ? 0.8 : 0, 2.5);
        if (d < 11 && this.rng.charge.next() < dt * 0.9) { th.lane.start(a, p.x, p.z, 0.7); th.mode = 'charge'; this.ctx.shot('thrall_groan', a.position); }
      }
      const ad = Math.hypot(a.position.x - C.x, a.position.z - C.z);
      if (ad > KING_WALL_R + 1) { a.position.x = C.x + (a.position.x - C.x) / ad * (KING_WALL_R + 1); a.position.z = C.z + (a.position.z - C.z) / ad * (KING_WALL_R + 1); }
    }
  }
  protected clearAdds(): void {
    for (const th of this.thralls) { th.lane.cancel(); this.retireThrall(th.a); }
    this.thralls = [];
  }

  // ── the lanterns fall ──
  private dropLanterns(): void {
    const k = this.king;
    if (!k) return;
    this.lanterns.forEach((f, i) => {
      const ang = k.yaw + (i - 1) * 2.1 + 0.35, r = 10 + i * 2.5;
      f.x = C.x + Math.sin(ang) * r; f.z = C.z + Math.cos(ang) * r; f.y = this.groundAt(f.x, f.z);
      f.fallT = 0; f.acc = 0;
      this.lanternView(i, f, 0, 'drop');
    });
    this.lanternsHung(false);
  }
  /** on (placed where they burn, no fall — a checkpoint at phase II / III) or all out */
  protected setHazards(on: boolean): void {
    this.lanterns.forEach((f, i) => {
      if (on) {
        const ang = (i - 1) * 2.1 + 0.35, r = 10 + i * 2.5;
        f.x = C.x + Math.sin(ang) * r; f.z = C.z + Math.cos(ang) * r; f.y = this.groundAt(f.x, f.z);
        f.fallT = 1; this.lanternView(i, f, 0, 'placed');
      } else { f.fallT = -1; this.lanternView(i, f, 0, 'out'); }
    });
  }
  private hazards(dt: number, t: number, fighting: boolean): void {
    const p = this.ctx.player.position;
    this.lanterns.forEach((f, i) => {
      if (f.fallT < 0) return;
      if (f.fallT < 1) {
        f.fallT = Math.min(1, f.fallT + dt / 0.75);
        this.lanternView(i, f, t, f.fallT >= 1 ? 'land' : 'fall');
        return;
      }
      this.lanternView(i, f, t, 'burn');
      if (fighting && !this.won) {
        let inside = false;
        const actor = this.king;
        if (actor) pineContact(actor, p, PINE_STRIKES.lantern, () => { inside = true; }, () => this.ctx.reach(actor, p), { origin: { x: f.x, y: f.y, z: f.z } });
        const r = burnTick(f.acc, dt, inside, 0.8);
        f.acc = r.acc;
        if (r.bites > 0 && actor) this.ctx.hurt(actor, PINE_STRIKES.lantern.damage * r.bites, true);
      }
    });
  }

  // ── the room ──
  protected hideTells(): void { this.tellRing.hide(); this.waves.forEach((w, i) => { w.on = false; this.waveView(i, 0, null); }); this.lane.cancel(); }

  /** the soft wall: past the wall you are shoved back in; never out past the fog */
  private softWall(): void {
    const pl = this.ctx.player, p = pl.position;
    const dx = p.x - C.x, dz = p.z - C.z, d = Math.hypot(dx, dz);
    const push = wallPush(d, KING_WALL_R);
    if (push > 0 && d > 1e-3) pl.shove(C.x + dx / d * (d + 2), C.z + dz / d * (d + 2), push);
    if (d > KING_FOG_R - 1) { p.x = C.x + dx / d * (KING_FOG_R - 1.2); p.z = C.z + dz / d * (KING_FOG_R - 1.2); }
  }

  // ── the continuation (the headless runtime's; bodies by entity id) ──
  /** the fight's plain state; `id` names a body (the host's entity id) */
  fightState(id: (b: B) => string): KingFightState {
    return { king: this.king === null ? null : id(this.king), present: this.present, sealed: this.sealed, sealK: this.sealK, darkK: this.darkK, glow: this.glow,
      invuln: this.invuln, lockHp: this.lockHp, won: this.won, phase: this.phase, mode: this.mode, modeT: this.modeT, sweepCd: this.sweepCd, stompCd: this.stompCd,
      callCd: this.callCd, laneN: this.laneN, open: this.open, lane: this.lane.snapshot(), waves: this.waves.map(w => ({ r: w.r, on: w.on, hit: w.hit, delay: w.delay })),
      lanterns: this.lanterns.map(f => ({ ...f })), thralls: this.thralls.map(th => ({ a: id(th.a), lane: this.thrallLanes.indexOf(th.lane), mode: th.mode })),
      thrallLanes: this.thrallLanes.map(l => l.snapshot()), rngs: [this.rng.call.snapshot(), this.rng.charge.snapshot()] };
  }
  /** restore the fight's state; `find` resolves a saved body (the host reinstalled it) */
  restoreFight(s: KingFightState, find: (id: string) => B | null): void {
    const body = (id: string): B => { const b = find(id); if (b === null) throw new Error(`Incompatible Antler King continuation (${id})`); return b; };
    if (s.waves.length !== this.waves.length || s.lanterns.length !== this.lanterns.length || s.thrallLanes.length !== this.thrallLanes.length || s.rngs.length !== 2) throw new Error('Incompatible Antler King continuation');
    this.king = s.king === null ? null : body(s.king);
    Object.assign(this, { present: s.present, sealed: s.sealed, sealK: s.sealK, darkK: s.darkK, glow: s.glow, invuln: s.invuln, lockHp: s.lockHp, won: s.won,
      phase: s.phase, mode: s.mode, modeT: s.modeT, sweepCd: s.sweepCd, stompCd: s.stompCd, callCd: s.callCd, laneN: s.laneN, open: s.open });
    this.lane.restore(s.lane);
    s.waves.forEach((w, i) => { const own = this.waves[i]; if (own !== undefined) Object.assign(own, w); });
    s.lanterns.forEach((f, i) => { const own = this.lanterns[i]; if (own !== undefined) Object.assign(own, f); });
    s.thrallLanes.forEach((l, i) => { this.thrallLanes[i]?.restore(l); });
    this.thralls = s.thralls.map(th => {
      const lane = this.thrallLanes[th.lane];
      if (lane === undefined) throw new Error('Incompatible Antler King continuation (thrall lane)');
      return { a: body(th.a), lane, mode: th.mode };
    });
    const [call, charge] = s.rngs;
    if (call !== undefined) this.rng.call.restore(call);
    if (charge !== undefined) this.rng.charge.restore(charge);
  }
}

/** Before the boss brain's tick: the King comes at night when the player is within 80 m (armed at the stones) and goes by
 *  day or past 110 m (the page's AntlerKing and the headless step alike). */
export function kingPresence<B extends KingBody>(boss: BossBrain, fight: AntlerKingCore<B>, player: { readonly x: number; readonly z: number }, night: boolean): void {
  const d = Math.hypot(player.x - KINGS_CLEARING.x, player.z - KINGS_CLEARING.z), s = boss.state;
  if (s === 'dormant') { if (night && d < 80) { fight.setPresent(true); boss.arm(); } }
  else if ((s === 'armed' || s === 'victory') && (d > 110 || !night)) { boss.disarm(); fight.setPresent(false); }
}
/** After the boss brain's tick: a dormant fight still ticks its room (the brain ticks the script in every other state). */
export function kingDormant<B extends KingBody>(boss: BossBrain, fight: AntlerKingCore<B>, dt: number, t: number): void {
  if (boss.state === 'dormant') fight.update(dt, t, false);
}
/** The page's whole King tick: presence, the boss brain, the dormant room (headless runs the three as its own steps). */
export function kingTick<B extends KingBody>(boss: BossBrain, fight: AntlerKingCore<B>, player: { readonly x: number; readonly z: number }, night: boolean, dt: number, t: number): void {
  kingPresence(boss, fight, player, night);
  boss.update(dt, t);
  kingDormant(boss, fight, dt, t);
}

function clamp01(v: number): number { return Math.min(1, Math.max(0, v)); }
/** THREE.MathUtils.smoothstep, renderer-free */
function smoothstep(x: number, min: number, max: number): number {
  if (x <= min) return 0;
  if (x >= max) return 1;
  const u = (x - min) / (max - min);
  return u * u * (3 - 2 * u);
}
