import * as THREE from 'three';
import type { Animal } from './Animal';
import type { ThinkCtx } from './species/registry';
import { inChunk, normalAt } from '../world/Heightfield';
import { wildEnv, playerVisibility, downwindOf, hearingRadius, angDiff } from './wildEnv';

/**
 * Pack — one wolf pack's shared hunt (docs/design/nalati/wolves-horses-taming.md "Steppe wolves"). The wolves are
 * ordinary AnimalManager animals (`species/wolf.ts`, a `think` species); every wolf's 10 Hz think lands in
 * `thinkWolf()`, which finds its Pack (created on first use from the manager herd the wolf was spawned into), runs the
 * pack-level tick once per AI tick and then drives that wolf.
 *
 * Roles: ALPHA (the largest; holds back on the outer ring, howls the regroup, joins the lunges only when the player is
 * hurt or it is the last one), FLANKERS (slots on the ring outside the player's view cone), the LUNGER (whoever holds
 * the attack token), the SCOUT (the young one in packs of 4–5: it probes first and yips when it finds you).
 *
 * Phases:  roam → shadow → encircle ⇄ regroup → break → roam (after a calm-down)
 *   roam      the pack trots between points 40–90 m from its den, 60–120 s a leg
 *   (senses)  sight 35 m × grass visibility (wildEnv.playerVisibility), cone 70°; hearing 4 / 8 / 16 / 30 m by the player's
 *             speed; SMELL inside 60 m when a wolf is downwind (±35°) — scent ignores the grass. A hit → found at once.
 *   shadow    30–40 m out, low (mem.low), picking the tallest grass on its side of you — the grass wakes (wolf-1)
 *   encircle  a 12–16 m ring, slots spaced 360°/n but squeezed out of your 90° view cone; slots re-assign as you turn
 *             (wolves drift round the ring, never through you). One ATTACK TOKEN (two mounted, +1 while bold) goes to
 *             the wolf most behind you every 2.5–4 s: a 0.4 s crouch-snarl telegraph, a 9.5 m/s dash, the bite at 1.4 m
 *             (12, alpha 18), a hard break-off back to the ring. A lunge that is hit is staggered (`animal.stagger`).
 *   regroup   a wolf dies or the pack drops under 50 % hp: the alpha HOWLS (mem.howl, 'howl' event), the pack pulls back
 *             to 30 m, then re-encircles bolder (one more token for 10 s)
 *   break     the alpha dies, one wolf is left, or `scare()` lands within 20 m (stampede, lightning): flee 70 m, then
 *             the pack ignores you for 120 s
 *
 * Prey: `pack.findPrey = (x, z, r) => Animal | null` (Wildlife hands it the herds' foals) — a roaming pack that has not
 * found you may hunt a foal instead, with the same ring and lunges; the bite lands on the foal.
 *
 * For other rows: `isLunging(wolf)` (a braced spear kills a dashing wolf — B3), `wolf.mem.hidden` (1 = still in grass
 * ≥ 0.8 m and > 10 m away: off the minimap and out of aim assist — B9 / HUD), `pack.phase`, `pack.awareness`,
 * `pack.scare(x, z)`, `Pack.all` (every live pack).
 */

export type PackPhase = 'roam' | 'shadow' | 'encircle' | 'regroup' | 'break';

export const ROLE_ALPHA = 0, ROLE_FLANK = 1, ROLE_SCOUT = 2;

/** wolf numbers (design) */
const TROT = 4.0, RUN = 9.5, SHADOW_R = [30, 40] as const, RING_R = [12, 16] as const, BITE_R = 1.4;
const SIGHT = 35, CONE = THREE.MathUtils.degToRad(70), SMELL = 60, HEAR: [number, number, number, number] = [4, 8, 16, 30];
const TELEGRAPH = 0.4, DASH_MAX = 1.8, BREAKOFF = 1.1;

const packOf = new WeakMap<Animal, Pack>();
const _t = new THREE.Vector3();

const ease = (cur: number, to: number, k: number): number => cur + (to - cur) * Math.min(1, k);

export function isLunging(a: Animal): boolean { return a.kind === 'wolf' && (a.mem['lunge'] ?? 0) === 2; }

export class Pack {
  static all: Pack[] = [];
  /** the pack a wolf belongs to (null for a wolf spawned outside any herd) */
  static of(a: Animal): Pack | null { return packOf.get(a) ?? null; }

  readonly members: Animal[];
  alpha: Animal | null = null;
  phase: PackPhase = 'roam';
  /** 0..1: how sure the pack is of the player (the max over its wolves' senses) */
  awareness = 0;
  /** the den / home range centre */
  homeX: number; homeZ: number;
  /** a foal (or any Animal) the pack is hunting instead of the player */
  prey: Animal | null = null;
  findPrey?: ((x: number, z: number, r: number) => Animal | null) | undefined;
  onPhase?: ((phase: PackPhase, pack: Pack) => void) | undefined;

  private phaseT = 0;
  private roamX: number; private roamZ: number; private roamT = 0;
  private nextTokenT = 0; private boldT = 0; private calmT = 0;
  private lastTick = -1;
  private hpStart = 0; private halfDone = false; private deadSeen = 0;
  private shadowDur = 12;
  private howled = false;
  private bites = 0;
  private scared = false;

  constructor(members: Animal[], homeX: number, homeZ: number) {
    this.members = members;
    this.homeX = this.roamX = homeX; this.homeZ = this.roamZ = homeZ;
    // roles: the alpha variant (else the biggest) leads; the smallest of a 4–5 pack scouts
    let big: Animal | null = null, small: Animal | null = null;
    for (const w of members) {
      if (w.variant === 'alpha' || big === null || (big.variant !== 'alpha' && w.scale > big.scale)) big = w;
      if (small === null || w.scale < small.scale) small = w;
    }
    this.alpha = big;
    for (const w of members) {
      w.mem['role'] = w === big ? ROLE_ALPHA : members.length >= 4 && w === small ? ROLE_SCOUT : ROLE_FLANK;
      w.mem['ox'] = (Math.random() - 0.5) * 8; w.mem['oz'] = (Math.random() - 0.5) * 8;
      w.mem['hitT'] = w.lastHitT;
      w.mem['ring'] = RING_R[0] + Math.random() * (RING_R[1] - RING_R[0]);
      this.hpStart += w.maxHp;
      packOf.set(w, this);
    }
    Pack.all.push(this);
  }

  /** the pack a wolf's think should use: its Pack, or one made now from the manager herd it was spawned into */
  static forThink(a: Animal, c: ThinkCtx): Pack | null {
    const p = packOf.get(a);
    if (p !== undefined) return p;
    if (c.herd === null) return null;
    const wolves = c.herd.filter((m) => m.kind === 'wolf');
    let x = 0, z = 0;
    for (const w of wolves) { x += w.position.x; z += w.position.z; }
    return new Pack(wolves, x / Math.max(1, wolves.length), z / Math.max(1, wolves.length));
  }

  /** a stampede / lightning / anything terrifying at (x, z): the pack breaks if a wolf is within `r` m */
  scare(x: number, z: number, r = 20): void {
    for (const w of this.members) if (w.alive && Math.hypot(w.position.x - x, w.position.z - z) < r) { this.scared = true; return; }
  }

  get alive(): number { let n = 0; for (const w of this.members) if (w.alive) n++; return n; }

  private setPhase(p: PackPhase, c: ThinkCtx): void {
    if (p === this.phase) return;
    this.phase = p; this.phaseT = 0;
    if (p === 'shadow') {
      this.shadowDur = c.rng.range(9, 16);
      // the scout gives the pack away with a yip
      for (const w of this.members) if (w.alive && w.mem['role'] === ROLE_SCOUT) { this.sound(c, w, 'wolf_yip'); break; }
    }
    if (p === 'regroup') this.howled = false;
    if (p === 'break') { for (const w of this.members) { w.mem['lunge'] = 0; w.cancelAttack(); } wildEnv.onEvent?.('pack-break', this.cx(), this.cz()); }
    if (p === 'roam') { this.prey = null; this.pickRoam(c); }
    this.onPhase?.(p, this);
  }

  private cx(): number { let x = 0, n = 0; for (const w of this.members) if (w.alive) { x += w.position.x; n++; } return n > 0 ? x / n : this.homeX; }
  private cz(): number { let z = 0, n = 0; for (const w of this.members) if (w.alive) { z += w.position.z; n++; } return n > 0 ? z / n : this.homeZ; }

  private sound(c: ThinkCtx, _w: Animal, name: string): void { c.sound(name); }

  private pickRoam(c: ThinkCtx): void {
    for (let i = 0; i < 16; i++) {
      const ang = c.rng.range(0, Math.PI * 2), r = c.rng.range(40, 90);
      const x = this.homeX + Math.cos(ang) * r, z = this.homeZ + Math.sin(ang) * r;
      if (!inChunk(x, z, 30) || normalAt(x, z)[1] < 0.8) continue;
      this.roamX = x; this.roamZ = z; break;
    }
    this.roamT = c.rng.range(60, 120);
  }

  /** where the hunt is aimed (the player, or the prey) */
  private target(c: ThinkCtx): THREE.Vector3 { return this.prey !== null ? this.prey.position : c.player; }
  /** the direction the target faces, as a yaw (animal convention: atan2(x, z)) */
  private targetFacing(): number { return this.prey !== null ? this.prey.yaw : Math.atan2(wildEnv.playerFwdX, wildEnv.playerFwdZ); }

  /** the pack-level tick: senses, phase changes, the attack token (once per AI tick, whichever wolf thinks first) */
  tick(c: ThinkCtx): void {
    if (c.t - this.lastTick < 0.05) return;
    const dt = this.lastTick < 0 ? 0.1 : Math.min(0.5, c.t - this.lastTick);
    this.lastTick = c.t;
    this.phaseT += dt; this.boldT = Math.max(0, this.boldT - dt); this.calmT = Math.max(0, this.calmT - dt);
    let living = 0, hp = 0, dead = 0;
    for (const w of this.members) { if (w.alive) { living++; hp += w.hp; } else dead++; }
    if (living === 0) return;
    if (this.prey !== null && !this.prey.alive) {
      wildEnv.onEvent?.('prey-killed', this.prey.position.x, this.prey.position.z);
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
      const V = playerVisibility(w.position.x, w.position.z, c.player, c.playerSpeed, c.t);
      const sight = SIGHT * V;
      if (d < sight && Math.abs(angDiff(Math.atan2(dx, dz), w.yaw)) < CONE) rate = Math.max(rate, 0.5 * (2 - d / sight));
      const hear = hearingRadius(HEAR, c.player, c.playerSpeed);
      if (d < hear) rate = Math.max(rate, 0.6 * (2 - d / hear));
      if (d < SMELL && downwindOf(w.position.x, w.position.z, c.player)) rate = Math.max(rate, 0.35 * (2 - d / SMELL));
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
        if (!this.howled && this.alpha !== null) { this.howled = true; this.sound(c, this.alpha, 'wolf_howl'); wildEnv.onEvent?.('howl', this.alpha.position.x, this.alpha.position.z); }
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
  private assignToken(c: ThinkCtx): void {
    const tgt = this.target(c);
    let lungers = 0, living = 0;
    for (const w of this.members) if (w.alive) { living++; const l = w.mem['lunge'] ?? 0; if (l === 1 || l === 2) lungers++; }
    const tokens = (wildEnv.playerMounted && this.prey === null ? 2 : 1) + (this.boldT > 0 ? 1 : 0);
    if (lungers >= tokens || c.t < this.nextTokenT) return;
    const facing = this.targetFacing();
    let best: Animal | null = null, bestScore = -Infinity;
    for (const w of this.members) {
      if (!w.alive || w.stunned || (w.mem['lunge'] ?? 0) !== 0) continue;
      const d = w.position.distanceTo(tgt);
      if (d > 24) continue;
      const role = w.mem['role'] ?? ROLE_FLANK;
      if (role === ROLE_ALPHA && living > 1 && wildEnv.playerHealth01 >= 0.6 && this.bites < 3) continue;   // the alpha holds back
      const behind = Math.abs(angDiff(Math.atan2(w.position.x - tgt.x, w.position.z - tgt.z), facing));   // π = straight behind
      const score = behind - d * 0.03 + (role === ROLE_SCOUT && this.bites === 0 ? 1.5 : 0);
      if (score > bestScore) { bestScore = score; best = w; }
    }
    if (best === null) return;
    best.mem['lunge'] = 1; best.mem['lt'] = TELEGRAPH; best.mem['bit'] = 0;
    this.sound(c, best, 'wolf_snarl');
    this.nextTokenT = c.t + (this.boldT > 0 ? c.rng.range(1.2, 2.0) : c.rng.range(2.5, 4.0));
  }

  /** steer one wolf for this tick (after `tick`) */
  drive(a: Animal, c: ThinkCtx): void {
    const m = a.mem;
    const dt = c.dt;
    const tgt = this.target(c);
    const dx = tgt.x - a.position.x, dz = tgt.z - a.position.z, d = Math.hypot(dx, dz);
    const toTgt = Math.atan2(dx, dz);
    const role = m['role'] ?? ROLE_FLANK;
    let low = 0, snarl = 0, howl = 0;
    a.lookTarget.copy(tgt); a.lookWeight = this.phase === 'roam' ? 0 : 0.8;
    // a hit mid-lunge staggers it and breaks the lunge off
    const lunge = m['lunge'] ?? 0;
    if ((lunge === 1 || lunge === 2) && a.lastHitT > (m['lhit'] ?? -Infinity) && performance.now() - a.lastHitT < 400) {
      _t.set(-dx, 0, -dz).normalize();
      a.stagger(_t, 0.7); a.cancelAttack();
      m['lunge'] = 3; m['lt'] = BREAKOFF + 0.5;
    }
    m['lhit'] = a.lastHitT;

    switch (this.phase) {
      case 'roam': {
        const tx = this.roamX + (m['ox'] ?? 0), tz = this.roamZ + (m['oz'] ?? 0);
        const td = Math.hypot(tx - a.position.x, tz - a.position.z);
        if (td > 3) this.steerSep(a, c, Math.atan2(tx - a.position.x, tz - a.position.z), td > 25 ? TROT : 1.6, 2.5);
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
          const r = SHADOW_R[0] + (a.seed % 1) * (SHADOW_R[1] - SHADOW_R[0]);
          let bestG = -1, bx = a.position.x, bz = a.position.z;
          for (let k = -2; k <= 2; k++) {
            const ang = bearing + k * 0.3;
            const x = tgt.x + Math.sin(ang) * r, z = tgt.z + Math.cos(ang) * r;
            if (!inChunk(x, z, 24)) continue;
            const g = wildEnv.grassHeightAt(x, z) - Math.abs(k) * 0.05;
            if (g > bestG) { bestG = g; bx = x; bz = z; }
          }
          m['sx'] = bx; m['sz'] = bz;
        }
        const sx = m['sx'] ?? a.position.x, sz = m['sz'] ?? a.position.z;
        const sd = Math.hypot(sx - a.position.x, sz - a.position.z);
        const speed = d > 55 ? RUN * 0.8 : sd > 4 ? TROT : sd > 1.5 ? 1.4 : 0;
        if (speed > 0) this.steerSep(a, c, Math.atan2(sx - a.position.x, sz - a.position.z), speed, 3);
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
          if ((m['lt'] ?? 0) <= 0) { m['lunge'] = 2; m['lt'] = DASH_MAX; }
          break;
        }
        if (lunge === 2) {
          a.state = 'charge'; snarl = 1;
          c.steer(a, toTgt, RUN * a.mods.speed, 7);
          if (d < 2.6 && a.attackPhase < 0) a.startAttack(0.42);
          m['lt'] = (m['lt'] ?? 0) - dt;
          if (d < BITE_R * Math.max(1, a.scale) + 0.25 && (m['bit'] ?? 0) === 0) {
            m['bit'] = 1; this.bites++;
            this.sound(c, a, 'wolf_bite');
            if (this.prey !== null) { _t.set(dx, 0, dz).normalize(); this.prey.applyDamage(role === ROLE_ALPHA ? 22 : 15, this.prey.position, _t); }
            else c.hurt(a.mods.chargeDamage);
            m['lunge'] = 3; m['lt'] = BREAKOFF;
          } else if ((m['lt'] ?? 0) <= 0) { m['lunge'] = 3; m['lt'] = BREAKOFF * 0.6; }
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
        const step = THREE.MathUtils.clamp(angDiff(slot, bearing), -0.7, 0.7);
        const ang = bearing + step;
        const px = tgt.x + Math.sin(ang) * R, pz = tgt.z + Math.cos(ang) * R;
        const pd = Math.hypot(px - a.position.x, pz - a.position.z);
        low = 0.5;
        if (pd > 1.2) this.steerSep(a, c, Math.atan2(px - a.position.x, pz - a.position.z), pd > 10 ? RUN * 0.85 : pd > 3 ? TROT * 1.2 : 2.2, 4);
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
          this.steerSep(a, c, Math.atan2(-dx, -dz), RUN * 0.8, 4);   // pull back to 30 m…
        } else {
          a.setMotion(toTgt, 0, 2); howl = this.phaseT > 0.8 && this.phaseT < 2.8 && (a.seed * 7) % 1 > 0.35 ? 1 : 0;   // …and answer the howl
        }
        m['lunge'] = 0;
        break;
      }
      case 'break':
        a.state = 'flee';
        this.steerSep(a, c, Math.atan2(-dx, -dz), RUN * a.mods.speed, 3.5);
        break;
      // no default
    }
    // pose knobs (postPose eases toward them)
    m['low'] = ease(m['low'] ?? 0, low, dt * 5);
    m['snarl'] = ease(m['snarl'] ?? 0, snarl, dt * 8);
    m['howl'] = ease(m['howl'] ?? 0, howl, dt * 4);
    // stealth: still in tall grass and more than 10 m out → hidden (off the minimap, out of aim assist)
    m['hidden'] = a.speed < 0.5 && d > 10 && wildEnv.grassHeightAt(a.position.x, a.position.z) >= 0.8 ? 1 : 0;
  }

  /** the ring angle (bearing from the target) this wolf should hold: slots spread round the back, out of the view cone */
  private slotFor(a: Animal, c: ThinkCtx): number {
    const tgt = this.target(c);
    const behind = this.targetFacing() + Math.PI;
    // ring members in bearing order (relative to "behind"); a tiny n, so a sort of a small scratch array is fine
    const ring = this.ringScratch; ring.length = 0;
    for (const w of this.members) if (w.alive && (w.mem['lunge'] ?? 0) === 0) ring.push(w);
    const n = ring.length;
    if (n <= 1) return behind;
    const rel = (w: Animal): number => angDiff(Math.atan2(w.position.x - tgt.x, w.position.z - tgt.z), behind);
    ring.sort((p, q) => rel(p) - rel(q));
    const spacing = Math.min((Math.PI * 2) / n, (Math.PI * 1.5) / (n - 1));
    const k = ring.indexOf(a);
    return behind + (k - (n - 1) / 2) * spacing;
  }
  private ringScratch: Animal[] = [];

  /** steer with a little separation from pack-mates so they don't stack */
  private steerSep(a: Animal, c: ThinkCtx, yaw: number, speed: number, turn: number): void {
    let vx = Math.sin(yaw), vz = Math.cos(yaw);
    for (const w of this.members) {
      if (w === a || !w.alive) continue;
      const ox = a.position.x - w.position.x, oz = a.position.z - w.position.z, d = Math.hypot(ox, oz);
      if (d < 2.2 && d > 1e-3) { const f = (1 - d / 2.2) * 1.2; vx += (ox / d) * f; vz += (oz / d) * f; }
    }
    c.steer(a, Math.atan2(vx, vz), speed, turn);
  }
}


/** SpeciesDef.think for the wolf: the pack tick, then this wolf's part in it */
export function thinkWolf(a: Animal, c: ThinkCtx): void {
  const p = Pack.forThink(a, c);
  if (p === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  p.tick(c);
  p.drive(a, c);
  c.confine(a);
}
