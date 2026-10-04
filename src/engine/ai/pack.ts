import { Vector3, MathUtils } from 'three';
import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng } from '../core/rng';
import type { AggressionDirector } from './director';
import { GroupBrain } from './GroupBrain';
import * as v from 'valibot';

/** Shared predator hunt phases; one decision clock serves every member. */
export type PackPhase = 'roam' | 'shadow' | 'encircle' | 'regroup' | 'break';
/** Host-owned prey identity, pose and damage recipe; no guest code chooses its target binding. */
export interface PackPrey {
  readonly position: Vector3; readonly yaw: number; readonly alive: boolean;
  readonly applyDamage: (amount: number, hitPoint: Vector3, dir: Vector3) => boolean;
}
/** Declared circling-pack tuning, independent of a shard, species rig or combat recipe. */
export interface PackSpec {
  trotSpeed: number; runSpeed: number; shadowMinRadius: number; shadowMaxRadius: number;
  ringMinRadius: number; ringMaxRadius: number; biteRadius: number;
  sightRadius: number; coneAngle: number; smellRadius: number; hearing: readonly [number, number, number, number];
  telegraphSeconds: number; dashSeconds: number; breakoffSeconds: number; attackSeconds: number;
  leaderVariant: string; yipCue: string; howlCue: string; snarlCue: string; biteCue: string;
}
/** Caller-owned AI or body tick; motion, pathfinding and attack-token authority stay with the host. */
export interface PackContext<A extends AnimalSim> {
  dt: number; t: number; player: Vector3; playerSpeed: number; calm: boolean; rng: Rng;
  sound: (cue: string) => void; claim: (actor: A) => boolean;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
  pathYaw: (actor: A, x: number, z: number, every?: number) => number;
}
/** Trusted shared observations, terrain, token registration and strike recipe. */
export interface PackPorts<A extends AnimalSim> {
  sharedRng: () => Rng;
  environment: () => { playerFwdX: number; playerFwdZ: number; playerMounted: boolean; playerHealth01: number; grassHeightAt: (x: number, z: number) => number };
  visibility: (x: number, z: number, player: Vector3, speed: number, time: number) => number;
  hearing: (radii: readonly [number, number, number, number], player: Vector3, speed: number) => number;
  downwind: (x: number, z: number, player: Vector3) => boolean;
  inBounds: (x: number, z: number, margin: number) => boolean; normalY: (x: number, z: number) => number;
  register: (actor: A, director: AggressionDirector<A>) => void;
  bite: (actor: A, context: PackContext<A>, radius: number) => void;
  onEvent?: (event: string, x: number, z: number) => void;
  preyIdentity?: (prey: PackPrey) => string;
  resolvePrey?: (id: string) => PackPrey | null;
}
const finite = v.pipe(v.number(), v.finite());
const continuation = v.strictObject({ contract: v.string(), group: v.string(), alpha: v.nullable(v.string()),
  prey: v.nullable(v.string()), pendingPrey: v.nullable(v.string()),
  state: v.strictObject({ phase: v.picklist(['roam', 'shadow', 'encircle', 'regroup', 'break']), awareness: finite,
    homeX: finite, homeZ: finite, phaseT: finite, roamX: finite, roamZ: finite, roamT: finite, nextTokenT: finite,
    boldT: finite, calmT: finite, hpStart: finite, halfDone: v.boolean(), deadSeen: finite,
    shadowDur: finite, howled: v.boolean(), bites: finite, scared: v.boolean() }) });
const ROLE_ALPHA = 0, ROLE_FLANK = 1, ROLE_SCOUT = 2;
const _t = new Vector3();
const ease = (cur: number, to: number, k: number): number => cur + (to - cur) * Math.min(1, k);
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function validatePack(spec: PackSpec): PackSpec {
  const numbers = [spec.trotSpeed, spec.runSpeed, spec.shadowMinRadius, spec.shadowMaxRadius, spec.ringMinRadius, spec.ringMaxRadius,
    spec.biteRadius, spec.sightRadius, spec.coneAngle, spec.smellRadius, ...spec.hearing, spec.telegraphSeconds, spec.dashSeconds, spec.breakoffSeconds, spec.attackSeconds];
  if (numbers.some(value => !Number.isFinite(value) || value < 0 || value > 600) || spec.runSpeed > 15 || spec.trotSpeed > spec.runSpeed
    || spec.shadowMinRadius > spec.shadowMaxRadius || spec.ringMinRadius > spec.ringMaxRadius || spec.coneAngle > Math.PI
    || Math.min(spec.telegraphSeconds, spec.dashSeconds, spec.breakoffSeconds, spec.attackSeconds) <= 0
    || [spec.leaderVariant, spec.yipCue, spec.howlCue, spec.snarlCue, spec.biteCue].some(value => value.length === 0 || value.length > 128)) throw new Error('Invalid pack parameters');
  return { ...spec, hearing: [...spec.hearing] };
}
/** Renderer-free pack decisions and body timing; native strikes, perception and shared RNG are injected. */
export class PackBrain<A extends AnimalSim> extends GroupBrain<A> {
  private readonly spec: PackSpec;
  private readonly ports: PackPorts<A>;
  private readonly contract: string;
  alpha: A | null = null;
  phase: PackPhase = 'roam';
  /** 0..1: how sure the pack is of the player (the max over its wolves' senses) */
  awareness = 0;
  /** the den / home range centre */
  homeX: number; homeZ: number;
  /** a foal (or a raided sheep, any PackPrey) the pack is hunting instead of the player */
  prey: PackPrey | null = null;
  /** B1: a raid's prey, taken at the next tick while roaming (`raid`) */
  private pendingPrey: PackPrey | null = null;
  findPrey?: ((x: number, z: number, r: number) => A | null) | undefined;
  onPhase?: ((phase: PackPhase, pack: PackBrain<A>) => void) | undefined;

  private phaseT = 0;
  private roamX: number; private roamZ: number; private roamT = 0;
  private nextTokenT = 0; private boldT = 0; private calmT = 0;
  private hpStart = 0; private halfDone = false; private deadSeen = 0;
  private shadowDur = 12;
  private howled = false;
  private bites = 0;
  private scared = false;

  constructor(members: A[], homeX: number, homeZ: number, spec: PackSpec, ports: PackPorts<A>, restoring = false) {
    super(members);
    this.ports = ports; this.spec = validatePack(spec); this.contract = JSON.stringify(this.spec);
    if (members.length === 0 || members.length > 128 || new Set(members.map(actor => actor.entityId)).size !== members.length
      || !Number.isFinite(homeX) || !Number.isFinite(homeZ)) throw new Error('Invalid pack roster');
    this.homeX = this.roamX = homeX; this.homeZ = this.roamZ = homeZ;
    // roles: the alpha variant (else the biggest) leads; the smallest of a 4–5 pack scouts
    let big: A | null = null, small: A | null = null;
    for (const w of members) {
      if (w.variant === this.spec.leaderVariant || big === null || (big.variant !== this.spec.leaderVariant && w.scale > big.scale)) big = w;
      if (small === null || w.scale < small.scale) small = w;
    }
    this.alpha = big;
    for (const w of members) {
      if (!restoring) {
      w.mem['role'] = w === big ? ROLE_ALPHA : members.length >= 4 && w === small ? ROLE_SCOUT : ROLE_FLANK;
      w.mem['ox'] = (this.ports.sharedRng().next() - 0.5) * 8; w.mem['oz'] = (this.ports.sharedRng().next() - 0.5) * 8;
      w.mem['hitT'] = w.lastHitT;
      w.mem['ring'] = this.spec.ringMinRadius + this.ports.sharedRng().next() * (this.spec.ringMaxRadius - this.spec.ringMinRadius);
      }
      this.hpStart += w.maxHp;
    }
  }

  /** Group continuation stores timers, tokens and trusted prey references; actors and shared RNG are snapshotted by their owner. */
  snapshot(): string {
    const preyId = (prey: PackPrey | null): string | null => {
      if (prey === null) return null;
      if (this.ports.preyIdentity === undefined) throw new Error('Missing prey snapshot port');
      return this.ports.preyIdentity(prey);
    };
    return JSON.stringify({ contract: this.contract, group: this.snapshotGroup(actor => actor.entityId), alpha: this.alpha?.entityId ?? null,
      prey: preyId(this.prey), pendingPrey: preyId(this.pendingPrey), state: {
        phase: this.phase, awareness: this.awareness, homeX: this.homeX, homeZ: this.homeZ, phaseT: this.phaseT,
        roamX: this.roamX, roamZ: this.roamZ, roamT: this.roamT, nextTokenT: this.nextTokenT, boldT: this.boldT,
        calmT: this.calmT, hpStart: this.hpStart, halfDone: this.halfDone, deadSeen: this.deadSeen,
        shadowDur: this.shadowDur, howled: this.howled, bites: this.bites, scared: this.scared } });
  }
  /** Reject changed tuning, missing prey or forged members before applying any continuation; restore never runs a body or RNG. */
  restore(saved: string): void {
    const data = v.parse(continuation, JSON.parse(saved));
    if (data.contract !== this.contract) throw new Error('Incompatible pack continuation');
    const alpha = data.alpha === null ? null : this.members.find(actor => actor.entityId === data.alpha);
    if (alpha === undefined) throw new Error('Unresolved pack leader');
    const resolve = (id: string | null): PackPrey | null => {
      if (id === null) return null;
      const prey = this.ports.resolvePrey?.(id);
      if (prey === undefined || prey === null || this.ports.preyIdentity?.(prey) !== id) throw new Error('Unresolved pack prey');
      return prey;
    };
    const prey = resolve(data.prey), pendingPrey = resolve(data.pendingPrey);
    this.restoreGroup(data.group, actor => actor.entityId);
    this.alpha = alpha; this.prey = prey; this.pendingPrey = pendingPrey;
    Object.assign(this, data.state);
  }

  /** a stampede / lightning / anything terrifying at (x, z): the pack breaks if a wolf is within `r` m */
  scare(x: number, z: number, r = 20): void {
    for (const w of this.members) if (w.alive && Math.hypot(w.position.x - x, w.position.z - z) < r) { this.scared = true; return; }
  }

  get alive(): number { let n = 0; for (const w of this.members) if (w.alive) n++; return n; }

  /** B1: send a roaming pack after `p` (a raid on the flock) — false if it is busy (hunting, ringing you, fleeing) or dead */
  raid(p: PackPrey): boolean {
    if (this.phase !== 'roam' || this.alive === 0 || !p.alive) return false;
    this.pendingPrey = p;
    return true;
  }

  private setPhase(p: PackPhase, c: PackContext<A>): void {
    if (p === this.phase) return;
    this.phase = p; this.phaseT = 0;
    if (p === 'shadow') {
      this.shadowDur = c.rng.range(9, 16);
      // the scout gives the pack away with a yip
      for (const w of this.members) if (w.alive && w.mem['role'] === ROLE_SCOUT) { this.sound(c, w, this.spec.yipCue); break; }
    }
    if (p === 'regroup') this.howled = false;
    if (p === 'break') { for (const w of this.members) { w.mem['lunge'] = 0; w.cancelAttack(); } this.ports.onEvent?.('pack-break', this.cx(), this.cz()); }
    if (p === 'roam') { this.prey = null; this.pickRoam(c); }
    this.onPhase?.(p, this);
  }

  private cx(): number { let x = 0, n = 0; for (const w of this.members) if (w.alive) { x += w.position.x; n++; } return n > 0 ? x / n : this.homeX; }
  private cz(): number { let z = 0, n = 0; for (const w of this.members) if (w.alive) { z += w.position.z; n++; } return n > 0 ? z / n : this.homeZ; }

  private sound(c: PackContext<A>, _w: A, name: string): void { c.sound(name); }

  private pickRoam(c: PackContext<A>): void {
    for (let i = 0; i < 16; i++) {
      const ang = c.rng.range(0, Math.PI * 2), r = c.rng.range(40, 90);
      const x = this.homeX + Math.cos(ang) * r, z = this.homeZ + Math.sin(ang) * r;
      if (!this.ports.inBounds(x, z, 30) || this.ports.normalY(x, z) < 0.8) continue;
      this.roamX = x; this.roamZ = z; break;
    }
    this.roamT = c.rng.range(60, 120);
  }

  /** where the hunt is aimed (the player, or the prey) */
  private target(c: PackContext<A>): Vector3 { return this.prey !== null ? this.prey.position : c.player; }
  /** the direction the target faces, as a yaw (animal convention: atan2(x, z)) */
  private targetFacing(): number { return this.prey !== null ? this.prey.yaw : Math.atan2(this.ports.environment().playerFwdX, this.ports.environment().playerFwdZ); }

  /** the pack-level tick: senses, phase changes, the attack token (once per AI tick, whichever wolf thinks first) */
  tick(c: PackContext<A>): void {
    const dt = this.groupDelta(c.t, c.dt);
    if (dt <= 0) return;
    this.phaseT += dt; this.boldT = Math.max(0, this.boldT - dt); this.calmT = Math.max(0, this.calmT - dt);
    let living = 0, hp = 0, dead = 0;
    for (const w of this.members) { if (w.alive) { living++; hp += w.hp; } else dead++; }
    if (living === 0) return;
    if (this.prey !== null && !this.prey.alive) {
      this.ports.onEvent?.('prey-killed', this.prey.position.x, this.prey.position.z);
      this.prey = null; this.setPhase('roam', c); this.calmT = 40;
    }

    // ── senses → pack awareness ──
    let rate = 0;
    let hit = false;
    for (const w of this.members) {
      if (!w.alive) continue;
      if (w.lastHitT > (w.mem['hitT'] ?? -Infinity)) { w.mem['hitT'] = w.lastHitT; hit = true; }
      if (c.calm || this.calmT > 0) continue;
      const dx = c.player.x - w.position.x, dz = c.player.z - w.position.z, d = Math.hypot(dx, dz);
      const V = this.ports.visibility(w.position.x, w.position.z, c.player, c.playerSpeed, c.t);
      const sight = this.spec.sightRadius * V;
      if (d < sight && Math.abs(angDiff(Math.atan2(dx, dz), w.yaw)) < this.spec.coneAngle) rate = Math.max(rate, 0.5 * (2 - d / sight));
      const hear = this.ports.hearing(this.spec.hearing, c.player, c.playerSpeed);
      if (d < hear) rate = Math.max(rate, 0.6 * (2 - d / hear));
      if (d < this.spec.smellRadius && this.ports.downwind(w.position.x, w.position.z, c.player)) rate = Math.max(rate, 0.35 * (2 - d / this.spec.smellRadius));
    }
    if (hit && this.calmT <= 0) { this.awareness = 1; if (this.prey !== null) { this.prey = null; } }
    this.awareness = rate > 0 ? Math.min(1, this.awareness + rate * dt) : Math.max(0, this.awareness - 0.1 * dt);

    // ── break conditions ──
    const alphaDead = this.alpha !== null && !this.alpha.alive;
    const lastOne = this.members.length > 1 && living <= 1;
    if (this.phase !== 'break' && (alphaDead || lastOne || this.scared)) { this.scared = false; this.setPhase('break', c); }
    this.scared = false;

    const tgt = this.target(c);
    const al = this.alpha;
    const dAlpha = al?.alive === true ? al.position.distanceTo(tgt) : Math.hypot(this.cx() - tgt.x, this.cz() - tgt.z);
    switch (this.phase) {
      case 'roam': {
        // B1: a raid — the pack goes after the flock's sheep, whatever it had of you
        if (this.pendingPrey !== null) {
          const p = this.pendingPrey;
          this.pendingPrey = null;
          if (p.alive) { this.prey = p; this.awareness = 0; this.calmT = 0; this.setPhase('shadow', c); break; }
        }
        this.roamT -= dt;
        if (this.roamT <= 0 || (Math.hypot(this.cx() - this.roamX, this.cz() - this.roamZ) < 6 && c.rng.next() < 0.05)) this.pickRoam(c);
        if (this.awareness >= 0.35) { this.setPhase(hit ? 'encircle' : 'shadow', c); break; }
        // a foal nearby: hunt it (only when the pack has not found you)
        if (this.findPrey !== undefined && this.calmT <= 0 && this.awareness < 0.1 && c.rng.next() < 0.01) {
          const p = this.findPrey(this.cx(), this.cz(), 70);
          if (p !== null) { this.prey = p; this.setPhase('shadow', c); }
        }
        break;
      }
      case 'shadow':
        if (hit) { this.setPhase('encircle', c); break; }
        if (this.prey === null && this.awareness < 0.15) { this.setPhase('roam', c); break; }
        if (dAlpha < 22 || this.phaseT > this.shadowDur || (this.prey !== null && this.phaseT > 6)) this.setPhase('encircle', c);
        break;
      case 'encircle': {
        if (dead > this.deadSeen || (!this.halfDone && hp < this.hpStart * 0.5)) {
          if (hp < this.hpStart * 0.5) this.halfDone = true;
          this.deadSeen = dead;
          if (this.alpha?.alive === true) { this.setPhase('regroup', c); break; }
        }
        if (this.prey === null && this.awareness < 0.08 && dAlpha > 50) { this.setPhase('roam', c); break; }
        this.assignToken(c);
        break;
      }
      case 'regroup':
        // the alpha howls (2.2 s), the others answer; all pull back to 30 m; then in again, bolder
        if (!this.howled && this.alpha !== null) { this.howled = true; this.sound(c, this.alpha, this.spec.howlCue); this.ports.onEvent?.('howl', this.alpha.position.x, this.alpha.position.z); }
        if (this.phaseT > 3.6) { this.boldT = 10; this.nextTokenT = c.t + 0.6; this.setPhase('encircle', c); }
        break;
      case 'break': {
        let far = true;
        for (const w of this.members) if (w.alive && w.position.distanceTo(c.player) < 70) far = false;
        if (far || this.phaseT > 14) { this.calmT = 120; this.awareness = 0; this.setPhase('roam', c); }
        break;
      }
      // no default
    }
  }

  /** hand the attack token(s) to the wolves best placed behind the target */
  private assignToken(c: PackContext<A>): void {
    const tgt = this.target(c);
    let lungers = 0, living = 0;
    for (const w of this.members) if (w.alive) { living++; const l = w.mem['lunge'] ?? 0; if (l === 1 || l === 2) lungers++; }
    const tokens = (this.ports.environment().playerMounted && this.prey === null ? 2 : 1) + (this.boldT > 0 ? 1 : 0);
    if (lungers >= tokens || c.t < this.nextTokenT) return;
    const facing = this.targetFacing();
    let best: A | null = null, bestScore = -Infinity;
    for (const w of this.members) {
      if (!w.alive || w.stunned || (w.mem['lunge'] ?? 0) !== 0) continue;
      const d = w.position.distanceTo(tgt);
      if (d > 24) continue;
      const role = w.mem['role'] ?? ROLE_FLANK;
      if (role === ROLE_ALPHA && living > 1 && this.ports.environment().playerHealth01 >= 0.6 && this.bites < 3) continue;   // the alpha holds back
      const behind = Math.abs(angDiff(Math.atan2(w.position.x - tgt.x, w.position.z - tgt.z), facing));   // π = straight behind
      const score = behind - d * 0.03 + (role === ROLE_SCOUT && this.bites === 0 ? 1.5 : 0);
      if (score > bestScore) { bestScore = score; best = w; }
    }
    if (best === null) return;
    const director = this.groupDirector(tokens, (actor) => actor.alive && ((actor.mem['lunge'] ?? 0) === 1 || (actor.mem['lunge'] ?? 0) === 2));
    this.ports.register(best, director);
    if (!c.claim(best)) return;
    best.mem['lhit'] = best.lastHitT; best.mem['lunge'] = 1; best.mem['lt'] = this.spec.telegraphSeconds; best.mem['bit'] = 0;
    this.sound(c, best, this.spec.snarlCue);
    this.nextTokenT = c.t + (this.boldT > 0 ? c.rng.range(1.2, 2.0) : c.rng.range(2.5, 4.0));
  }

  /** steer one wolf for this tick (after `tick`) */
  drive(a: A, c: PackContext<A>, body = false): void {
    const m = a.mem;
    const committed = this.phase === 'encircle' && (m['lunge'] ?? 0) !== 0;
    if (body !== committed) return;
    const dt = c.dt;
    const tgt = this.target(c);
    const dx = tgt.x - a.position.x, dz = tgt.z - a.position.z, d = Math.hypot(dx, dz);
    const toTgt = Math.atan2(dx, dz);
    const role = m['role'] ?? ROLE_FLANK;
    let low = 0, snarl = 0, howl = 0;
    a.lookTarget.copy(tgt); a.lookWeight = this.phase === 'roam' ? 0 : 0.8;
    // a hit mid-lunge staggers it and breaks the lunge off
    const lunge = m['lunge'] ?? 0;
    if ((lunge === 1 || lunge === 2) && a.lastHitT > (m['lhit'] ?? -Infinity)) {
      _t.set(-dx, 0, -dz).normalize();
      a.stagger(_t, 0.7); a.cancelAttack();
      m['lunge'] = 3; m['lt'] = this.spec.breakoffSeconds + 0.5;
    }
    m['lhit'] = a.lastHitT;

    switch (this.phase) {
      case 'roam': {
        const tx = this.roamX + (m['ox'] ?? 0), tz = this.roamZ + (m['oz'] ?? 0);
        const td = Math.hypot(tx - a.position.x, tz - a.position.z);
        if (td > 3) this.steerSep(a, c, c.pathYaw(a, tx, tz, 2), td > 25 ? this.spec.trotSpeed : 1.6, 2.5);
        else { a.setMotion(a.yaw, 0, 1.5); a.state = 'graze'; }   // sniffing the ground
        if (td > 3) a.state = 'wander';
        break;
      }
      case 'shadow': {
        a.state = 'stalk'; low = 1;
        // stay 30–40 m out on our side of the target, in the tallest grass we can find
        m['st'] = (m['st'] ?? 0) - dt;
        if (m['st'] <= 0 || m['sx'] === undefined) {
          m['st'] = 1.5;
          const bearing = Math.atan2(a.position.x - tgt.x, a.position.z - tgt.z);
          const r = this.spec.shadowMinRadius + (a.seed % 1) * (this.spec.shadowMaxRadius - this.spec.shadowMinRadius);
          let bestG = -1, bx = a.position.x, bz = a.position.z;
          for (let k = -2; k <= 2; k++) {
            const ang = bearing + k * 0.3;
            const x = tgt.x + Math.sin(ang) * r, z = tgt.z + Math.cos(ang) * r;
            if (!this.ports.inBounds(x, z, 24)) continue;
            const g = this.ports.environment().grassHeightAt(x, z) - Math.abs(k) * 0.05;
            if (g > bestG) { bestG = g; bx = x; bz = z; }
          }
          m['sx'] = bx; m['sz'] = bz;
        }
        const sx = m['sx'] ?? a.position.x, sz = m['sz'] ?? a.position.z;
        const sd = Math.hypot(sx - a.position.x, sz - a.position.z);
        const speed = d > 55 ? this.spec.runSpeed * 0.8 : sd > 4 ? this.spec.trotSpeed : sd > 1.5 ? 1.4 : 0;
        if (speed > 0) this.steerSep(a, c, c.pathYaw(a, sx, sz, 1.5), speed, 3);
        else a.setMotion(toTgt, 0, 2);
        break;
      }
      case 'encircle': {
        a.state = 'stalk';
        if (lunge === 1) {
          // the telegraph: stop, face, crouch, snarl
          a.state = 'attack'; low = 1; snarl = 1;
          a.setMotion(toTgt, 0, 6);
          m['lt'] = (m['lt'] ?? 0) - dt;
          if ((m['lt'] ?? 0) <= 0) { m['lunge'] = 2; m['lt'] = this.spec.dashSeconds; }
          break;
        }
        if (lunge === 2) {
          a.state = 'charge'; snarl = 1;
          c.steer(a, toTgt, this.spec.runSpeed * a.mods.speed, 7);
          if (d < 2.6 && a.attackPhase < 0) a.startAttack(this.spec.attackSeconds);
          m['lt'] = (m['lt'] ?? 0) - dt;
          if (d < this.spec.biteRadius * Math.max(1, a.scale) + 0.25 && (m['bit'] ?? 0) === 0) {
            m['bit'] = 1; this.bites++;
            this.sound(c, a, this.spec.biteCue);
            if (this.prey !== null) { _t.set(dx, 0, dz).normalize(); this.prey.applyDamage(role === ROLE_ALPHA ? 22 : 15, this.prey.position, _t); }
            else { this.ports.bite(a, c, this.spec.biteRadius * Math.max(1, a.scale) + 0.25); if (this.ports.environment().playerMounted) this.ports.onEvent?.('rider-bitten', a.position.x, a.position.z); }   // B1: the horse panics
            m['lunge'] = 3; m['lt'] = this.spec.breakoffSeconds;
          } else if ((m['lt'] ?? 0) <= 0) { m['lunge'] = 3; m['lt'] = this.spec.breakoffSeconds * 0.6; }
          break;
        }
        if (lunge === 3) {
          // hard break-off: out and round, back toward the ring
          a.state = 'flee';
          m['lt'] = (m['lt'] ?? 0) - dt;
          const out = Math.atan2(-dx, -dz) + ((a.seed * 10) % 2 < 1 ? 0.6 : -0.6);
          c.steer(a, out, 8, 5);
          if ((m['lt'] ?? 0) <= 0) { m['lunge'] = 0; a.cancelAttack(); }
          break;
        }
        // on the ring: take the slot, drift with the target's turning, never cut through it
        const slot = this.slotFor(a, c);
        const R = (m['ring'] ?? 14) + (role === ROLE_ALPHA ? 5 : 0);
        const bearing = Math.atan2(a.position.x - tgt.x, a.position.z - tgt.z);
        const step = MathUtils.clamp(angDiff(slot, bearing), -0.7, 0.7);
        const ang = bearing + step;
        const px = tgt.x + Math.sin(ang) * R, pz = tgt.z + Math.cos(ang) * R;
        const pd = Math.hypot(px - a.position.x, pz - a.position.z);
        low = 0.25;   // on the ring: slinking, head still over the grass
        if (pd > 1.2) this.steerSep(a, c, pd > 6 ? c.pathYaw(a, px, pz, 0.8) : Math.atan2(px - a.position.x, pz - a.position.z), pd > 10 ? this.spec.runSpeed * 0.85 : pd > 3 ? this.spec.trotSpeed * 1.2 : 2.2, 4);
        else a.setMotion(toTgt, 0, 3);
        break;
      }
      case 'regroup': {
        a.state = 'alert';
        if (a === this.alpha) {
          a.setMotion(toTgt, 0, 2);
          howl = this.phaseT < 2.6 ? 1 : 0;
          a.lookWeight = 0;
        } else if (d < 29) {
          this.steerSep(a, c, Math.atan2(-dx, -dz), this.spec.runSpeed * 0.8, 4);   // pull back to 30 m…
        } else {
          a.setMotion(toTgt, 0, 2); howl = this.phaseT > 0.8 && this.phaseT < 2.8 && (a.seed * 7) % 1 > 0.35 ? 1 : 0;   // …and answer the howl
        }
        m['lunge'] = 0;
        break;
      }
      case 'break':
        a.state = 'flee';
        this.steerSep(a, c, Math.atan2(-dx, -dz), this.spec.runSpeed * a.mods.speed, 3.5);
        break;
      // no default
    }
    // pose knobs (postPose eases toward them)
    m['low'] = ease(m['low'] ?? 0, low, dt * 5);
    m['snarl'] = ease(m['snarl'] ?? 0, snarl, dt * 8);
    m['howl'] = ease(m['howl'] ?? 0, howl, dt * 4);
    // stealth: still in tall grass and more than 10 m out → hidden (off the minimap, out of aim assist)
    m['hidden'] = a.speed < 0.5 && d > 10 && this.ports.environment().grassHeightAt(a.position.x, a.position.z) >= 0.8 ? 1 : 0;
  }

  /** the ring angle (bearing from the target) this wolf should hold: slots spread round the back, out of the view cone */
  private slotFor(a: A, c: PackContext<A>): number {
    const tgt = this.target(c);
    const behind = this.targetFacing() + Math.PI;
    // ring members in bearing order (relative to "behind"); a tiny n, so a sort of a small scratch array is fine
    const ring = this.ringScratch; ring.length = 0;
    for (const w of this.members) if (w.alive && (w.mem['lunge'] ?? 0) === 0) ring.push(w);
    const n = ring.length;
    if (n <= 1) return behind;
    const rel = (w: A): number => angDiff(Math.atan2(w.position.x - tgt.x, w.position.z - tgt.z), behind);
    ring.sort((p, q) => rel(p) - rel(q));
    const spacing = Math.min((Math.PI * 2) / n, (Math.PI * 1.5) / (n - 1));
    const k = ring.indexOf(a);
    return behind + (k - (n - 1) / 2) * spacing;
  }
  private ringScratch: A[] = [];

  /** steer with a little separation from pack-mates so they don't stack */
  private steerSep(a: A, c: PackContext<A>, yaw: number, speed: number, turn: number): void {
    let vx = Math.sin(yaw), vz = Math.cos(yaw);
    for (const w of this.members) {
      if (w === a || !w.alive) continue;
      const ox = a.position.x - w.position.x, oz = a.position.z - w.position.z, d = Math.hypot(ox, oz);
      if (d < 2.2 && d > 1e-3) { const f = (1 - d / 2.2) * 1.2; vx += (ox / d) * f; vz += (oz / d) * f; }
    }
    c.steer(a, Math.atan2(vx, vz), speed, turn);
  }
}
