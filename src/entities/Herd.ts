import * as THREE from 'three';
import type { Animal } from './Animal';
import type { ThinkCtx } from './species/registry';
import { inChunk, normalAt } from '../world/Heightfield';
import { wildEnv, playerVisibility, downwindOf, hearingRadius, angDiff } from './wildEnv';
import { Pack } from './Pack';
import type { GroupName } from '../physics/groups';
import { listSlot } from '../core/shardState';

/** the kinds a stampeding horse's body lets through (R3): the player on foot · none */
const THROUGH_PLAYER: readonly GroupName[] = ['PLAYER'], BLOCKED: readonly GroupName[] = [];

/**
 * HorseHerd — a wild horse herd's shared brain (docs/design/nalati/wolves-horses-taming.md "Wild horses — the herd").
 * The horses are AnimalManager animals (`species/horse.ts`, a `think` species); each one's 10 Hz think lands in
 * `thinkHorse()`, which runs the herd tick once per AI tick and then steers that horse.
 *
 * Herd modes:  graze → drift (the LEAD MARE walks to a new spot 30–60 m off every 60–120 s; the rest follow by boids:
 *              cohesion past 12 m, separation under 2.5 m, alignment within 8 m while moving; foals keep within 4 m of
 *              their mother) → alert (heads up) → flee / STAMPEDE (everyone gallops one way, bending off the slab edge,
 *              80–120 m) → settle (trot, stop, look back) → graze.
 * Senses per horse: sight 45 m head-up / 20 m grazing × grass visibility, cone 70°; hearing 4 / 8 / 15 / 30 m; the
 * stallion also smells you 40 m downwind. An alarm spreads to horses within 20 m in 0.2–0.8 s. Wolves within 25 m
 * start a flight (the stallion charges a wolf that gets inside 15 m of a foal instead).
 * STAMPEDE: `herd.stampede(x, z)` (a shot within 15 m — Wildlife.disturb, a foal killed, lightning, a rider galloping
 * in): the flight at full gallop, and anything in the path takes 30 and is knocked down (the player through
 * `ctx.hurt` + `wildEnv.onKnockdown`, wolves through applyDamage + stagger). 'stampede' event on wildEnv.onEvent.
 *
 * THE STALLION (variant 'stallion') does not graze with them: he keeps a guard point between the herd and the nearest
 * threat, 10–20 m out. States (`herd.stallionState`):
 *   watch   head high, looking at you                       warn     < 30 m: snorts, stamps, ears pinned
 *   display < 20 m and you are standing: he rears           charge   < 10 m and trust < 20: 12 m/s, 25 dmg + knock-down
 *   wheel   after a charge: away 15 m, then watch again     lead     runs the flight at the herd's flank
 *   beaten  under 25 % hp: he stops fighting, head low (`onBeaten` fires once) — he cannot be killed outright
 *           (`horseDamageMul` shrinks hits as his hp falls; the named elite Argymaq is "beaten to BROKEN" this way)
 *   ridden  `setRidden(horse)`: the herd AI lets go of that horse entirely (B7 drives its setMotion)
 *
 * Hooks for taming (B8 — not built here): `herd.trust` 0..100 (B8 writes it; a flight costs 30, `addTrust(n)`),
 * `herd.alert` 0..100 (the ALERT ear: rises with the stallion's senses / states), `herd.calm` = 1 − alert/100,
 * `onBeaten(stallion)`, `onStallionState(state)`, `onFlight(stampede)`, `stallion` / `lead` / `foals`.
 */

export type HerdMode = 'graze' | 'drift' | 'alert' | 'flee' | 'settle';
export type StallionState = 'watch' | 'warn' | 'display' | 'charge' | 'wheel' | 'lead' | 'beaten' | 'ridden';

const WALK = 1.8, TROT = 4.5, GALLOP = 12.5, CHARGE = 12;
const SIGHT = 45, SIGHT_GRAZE = 20, CONE = THREE.MathUtils.degToRad(70), HEAR: [number, number, number, number] = [4, 8, 15, 30];
const ALERT_AT = 0.45;

const herdOf = new WeakMap<Animal, HorseHerd>();
const _t = new THREE.Vector3();

export class HorseHerd {
  static all: HorseHerd[] = [];
  static of(a: Animal): HorseHerd | null { return herdOf.get(a) ?? null; }

  readonly members: Animal[];
  lead: Animal | null = null;
  stallion: Animal | null = null;
  readonly foals: Animal[] = [];
  mode: HerdMode = 'graze';
  stampeding = false;
  stallionState: StallionState = 'watch';
  /** taming (B8): 0..100 */
  trust = 0;
  /** the stallion's ALERT, 0..100 */
  alert = 0;
  /** true while taming (B8, src/game/Taming.ts) owns `alert` — the herd stops writing it */
  alertOwned = false;
  get calm(): number { return 1 - this.alert / 100; }
  ridden: Animal | null = null;
  onBeaten?: ((stallion: Animal, herd: HorseHerd) => void) | undefined;
  onStallionState?: ((state: StallionState, herd: HorseHerd) => void) | undefined;
  onFlight?: ((stampede: boolean, herd: HorseHerd) => void) | undefined;
  /** nearest living wolf to (x, z) within r (Wildlife wires it to the packs) */
  findWolf?: ((x: number, z: number, r: number) => Animal | null) | undefined;

  cx = 0; cz = 0;
  private spotX = 0; private spotZ = 0; private spotT = 0;
  private fleeX = 0; private fleeZ = 1; private fleeRun = 0; private fleeLen = 100; private fleeFromX = 0; private fleeFromZ = 0;
  private modeT = 0;
  private lastTick = -1;
  private mothers = new Map<Animal, Animal>();
  private sT = 0; private chargeCd = 0; private beatenT = 0; private beaten = false; private chargeTarget: Animal | null = null;
  private knockCd = 0;

  constructor(members: Animal[]) {
    this.members = members;
    for (const h of members) {
      herdOf.set(h, this);
      if (h.variant === 'stallion') this.stallion = h;
      else if (h.variant.startsWith('foal')) this.foals.push(h);
    }
    // the lead mare: the biggest adult mare
    for (const h of members) if (h !== this.stallion && !this.foals.includes(h) && (this.lead === null || h.scale > this.lead.scale)) this.lead = h;
    // each foal gets the nearest adult mare as its mother
    for (const f of this.foals) {
      let best: Animal | null = null, bd = Infinity;
      for (const h of members) {
        if (h === this.stallion || this.foals.includes(h)) continue;
        if ([...this.mothers.values()].includes(h)) continue;
        const d = h.position.distanceToSquared(f.position);
        if (d < bd) { bd = d; best = h; }
      }
      if (best !== null) this.mothers.set(f, best);
    }
    this.centre();
    this.spotX = this.cx; this.spotZ = this.cz; this.spotT = 20 + Math.random() * 40;
    HorseHerd.all.push(this);
  }

  static forThink(a: Animal, c: ThinkCtx): HorseHerd | null {
    const h = herdOf.get(a);
    if (h !== undefined) return h;
    if (c.herd === null) return null;
    return new HorseHerd(c.herd.filter((m) => m.kind === 'horse'));
  }

  /** B7: this horse is being ridden — the herd lets go of it (null hands it back) */
  setRidden(a: Animal | null): void {
    if (this.ridden !== null) this.ridden.mem['ridden'] = 0;
    this.ridden = a;
    if (a !== null) { a.mem['ridden'] = 1; if (a === this.stallion) this.setStallion('ridden'); }
    else if (this.stallionState === 'ridden') this.setStallion('watch');
  }
  addTrust(n: number): void { this.trust = THREE.MathUtils.clamp(this.trust + n, 0, 100); }

  /** a shot / a loud thing landed at (x, z): within 15 m of a horse → stampede, within 40 m → heads up */
  disturb(x: number, z: number): void {
    let near = Infinity;
    for (const h of this.members) if (h.alive) near = Math.min(near, Math.hypot(h.position.x - x, h.position.z - z));
    if (near < 15) this.stampede(x, z);
    else if (near < 40) for (const h of this.members) h.mem['aw'] = Math.max(h.mem['aw'] ?? 0, ALERT_AT);
  }

  /** the flight becomes a stampede, away from (x, z) */
  stampede(x: number, z: number): void { this.startFlight(x, z, true); }
  /** the stallion leads the herd away from (x, z) at a gallop (taming: ALERT maxed with some trust) — not a stampede */
  leadAway(x: number, z: number): void { this.startFlight(x, z, false); }
  /** the stallion leaves the herd for good (tamed): the herd grazes on without a guard */
  /** a stallion of another kind joins this herd as its stallion (the elite Argymaq, src/nalati/elites.ts). Without the
   *  registration his brain (thinkHorse → forThink) found no herd and built a fresh one every tick — he was never BEATEN
   *  and the mares were re-homed into throwaway herds (HorseHerd.all grew at 10 Hz) */
  adoptStallion(a: Animal): void { if (!this.members.includes(a)) this.members.push(a); herdOf.set(a, this); this.stallion = a; this.setStallion('watch'); }
  releaseStallion(): void { if (this.stallion !== null) { this.stallion.mem['ridden'] = 1; this.stallion = null; } this.alertOwned = false; }

  private centre(): void {
    let x = 0, z = 0, n = 0;
    for (const h of this.members) if (h.alive && h !== this.stallion && h !== this.ridden) { x += h.position.x; z += h.position.z; n++; }
    if (n > 0) { this.cx = x / n; this.cz = z / n; }
  }

  private setStallion(s: StallionState): void {
    if (s === this.stallionState) return;
    this.stallionState = s; this.sT = 0;
    this.onStallionState?.(s, this);
    if (s === 'display' && this.stallion !== null) wildEnv.onEvent?.('stallion-display', this.stallion.position.x, this.stallion.position.z);
  }

  private startFlight(fromX: number, fromZ: number, stampede: boolean): void {
    if (this.mode === 'flee' && (!stampede || this.stampeding)) return;
    let dx = this.cx - fromX, dz = this.cz - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    this.fleeX = dx; this.fleeZ = dz; this.fleeFromX = fromX; this.fleeFromZ = fromZ;
    this.fleeRun = 0; this.fleeLen = 80 + Math.random() * 40;
    this.mode = 'flee'; this.modeT = 0; this.stampeding = stampede;
    this.trust = Math.max(0, this.trust - 30);
    for (const h of this.members) { h.mem['hitP'] = 0; h.mem['aw'] = 1; }
    if (this.stallionState !== 'beaten' && this.stallionState !== 'ridden') this.setStallion('lead');
    this.onFlight?.(stampede, this);
    if (stampede) wildEnv.onEvent?.('stampede', this.cx, this.cz);
  }

  /** the herd-level tick: senses, alarms, mode changes (once per AI tick) */
  tick(c: ThinkCtx): void {
    if (c.t - this.lastTick < 0.05) return;
    const dt = this.lastTick < 0 ? 0.1 : Math.min(0.5, c.t - this.lastTick);
    this.lastTick = c.t;
    this.modeT += dt; this.sT += dt; this.chargeCd = Math.max(0, this.chargeCd - dt); this.knockCd = Math.max(0, this.knockCd - dt);
    const prevX = this.cx, prevZ = this.cz;
    this.centre();
    const moved = Math.hypot(this.cx - prevX, this.cz - prevZ);
    const player = c.player;
    const dCentre = Math.hypot(player.x - this.cx, player.z - this.cz);

    // ── senses ──
    let maxAw = 0, bolt = false;
    for (const h of this.members) {
      if (!h.alive || h === this.ridden) continue;
      let aw = h.mem['aw'] ?? 0;
      if (h.lastHitT > (h.mem['hitT'] ?? -Infinity)) { h.mem['hitT'] = h.lastHitT; this.startFlight(player.x, player.z, true); aw = 1; }
      let rate = 0;
      if (!c.calm) {
        const dx = player.x - h.position.x, dz = player.z - h.position.z, d = Math.hypot(dx, dz);
        const V = playerVisibility(h.position.x, h.position.z, player, c.playerSpeed, c.t);
        const sight = (h.state === 'graze' ? SIGHT_GRAZE : SIGHT) * V;
        if (d < sight && Math.abs(angDiff(Math.atan2(dx, dz), h.yaw)) < CONE) rate = Math.max(rate, 0.4 * (2 - d / sight));
        const hear = hearingRadius(HEAR, player, c.playerSpeed);
        if (d < hear) rate = Math.max(rate, 0.5 * (2 - d / hear));
        if (h === this.stallion && d < 40 && downwindOf(h.position.x, h.position.z, player)) rate = Math.max(rate, 0.3 * (2 - d / 40));
        // a rider galloping into the herd: stampede
        if (wildEnv.playerMounted && c.playerSpeed > 10 && d < 8) this.startFlight(player.x, player.z, true);
        // trust calms them: at 60+ they tolerate you close, at 100 they barely care
        rate *= 1 - this.trust / 125;
        if (d < 10 && this.trust < 60 && h !== this.stallion && c.playerSpeed > 0.5) bolt = true;
      }
      aw = rate > 0 ? Math.min(1, aw + rate * dt) : Math.max(0, aw - 0.12 * dt);
      // the alarm spreads: a head up nudges the neighbours within 20 m after 0.2–0.8 s
      if (aw >= ALERT_AT && (h.mem['alarm'] ?? 0) === 0) {
        h.mem['alarm'] = 1;
        for (const o of this.members) if (o !== h && o.alive && o.position.distanceTo(h.position) < 20) o.mem['alarmT'] = Math.max(o.mem['alarmT'] ?? 0, 0.2 + Math.random() * 0.6);
      }
      if (aw < ALERT_AT * 0.5) h.mem['alarm'] = 0;
      const at = h.mem['alarmT'] ?? 0;
      if (at > 0) { h.mem['alarmT'] = at - dt; if (at - dt <= 0) aw = Math.max(aw, ALERT_AT); }
      h.mem['aw'] = aw;
      if (h !== this.stallion) maxAw = Math.max(maxAw, aw);
      if (aw >= 1 && h !== this.stallion) bolt = true;
    }
    // the stallion's ALERT (0..100): his senses, pushed up by his warnings
    const st = this.stallion;
    if (st?.alive === true && !this.alertOwned) {
      const base = (st.mem['aw'] ?? 0) * 70 + (this.stallionState === 'warn' ? 20 : this.stallionState === 'display' || this.stallionState === 'charge' ? 30 : 0);
      this.alert += (THREE.MathUtils.clamp(base, 0, 100) - this.alert) * Math.min(1, dt * 2);
    }

    // ── wolves ──
    const wolf = this.findWolf?.(this.cx, this.cz, 45) ?? null;
    if (wolf !== null) {
      const wd = Math.hypot(wolf.position.x - this.cx, wolf.position.z - this.cz);
      if (wd < 25 && this.mode !== 'flee') this.startFlight(wolf.position.x, wolf.position.z, false);
      // the stallion goes for a wolf near a foal (or himself)
      if (st !== null && st.alive && this.stallionState !== 'beaten' && this.stallionState !== 'ridden' && this.stallionState !== 'charge') {
        let threat = false;
        for (const f of this.foals) if (f.alive && f.position.distanceTo(wolf.position) < 15) threat = true;
        if (threat || st.position.distanceTo(wolf.position) < 8) { this.chargeTarget = wolf; this.setStallion('charge'); }
      }
    }

    // ── modes ──
    switch (this.mode) {
      case 'graze': case 'drift': {
        if (bolt) { this.startFlight(player.x, player.z, false); break; }
        if (maxAw >= ALERT_AT) { this.mode = 'alert'; this.modeT = 0; break; }
        this.spotT -= dt;
        if (this.spotT <= 0) this.pickSpot(c);
        const lead = this.lead;
        if (lead?.alive === true) this.mode = Math.hypot(this.spotX - lead.position.x, this.spotZ - lead.position.z) > 6 ? 'drift' : 'graze';
        break;
      }
      case 'alert':
        if (bolt) { this.startFlight(player.x, player.z, false); break; }
        if (maxAw < ALERT_AT * 0.6 && this.modeT > 3) { this.mode = 'graze'; this.modeT = 0; }
        break;
      case 'flee': {
        this.fleeRun += moved;
        // bend off the slab edge / steep ground: look 30 m ahead of the herd
        for (let k = 0; k < 6; k++) {
          const ax = this.cx + this.fleeX * 30, az = this.cz + this.fleeZ * 30;
          if (inChunk(ax, az, 28) && normalAt(ax, az)[1] > 0.72) break;
          // turn toward the side that swings us toward the chunk centre
          const toC = Math.atan2(-this.cx, -this.cz), cur = Math.atan2(this.fleeX, this.fleeZ);
          const nu = cur + Math.sign(angDiff(toC, cur) || 1) * 0.35;
          this.fleeX = Math.sin(nu); this.fleeZ = Math.cos(nu);
        }
        if (this.fleeRun > this.fleeLen || this.modeT > 16) { this.mode = 'settle'; this.modeT = 0; this.stampeding = false; }
        break;
      }
      case 'settle':
        if (this.modeT > 7) {
          this.mode = 'graze'; this.modeT = 0; this.pickSpot(c);
          for (const h of this.members) h.mem['aw'] = Math.min(h.mem['aw'] ?? 0, 0.2);
          if (this.stallionState === 'lead') this.setStallion('watch');
        }
        break;
      // no default
    }
    // stallion state machine (distance to the player, standing / crouched, trust)
    if (st?.alive === true) this.stallionTick(c, dt, dCentre);
  }

  private pickSpot(c: ThinkCtx): void {
    const lead = this.lead ?? this.members[0];
    if (lead === undefined) return;
    for (let i = 0; i < 16; i++) {
      const ang = c.rng.range(0, Math.PI * 2), r = c.rng.range(30, 60);
      const x = lead.position.x + Math.cos(ang) * r, z = lead.position.z + Math.sin(ang) * r;
      if (!inChunk(x, z, 35) || normalAt(x, z)[1] < 0.85) continue;
      if (Math.hypot(x - c.player.x, z - c.player.z) < 40) continue;
      this.spotX = x; this.spotZ = z; break;
    }
    this.spotT = c.rng.range(60, 120);
  }

  private stallionTick(c: ThinkCtx, dt: number, _dCentre: number): void {
    const st = this.stallion;
    if (st === null) return;
    if (this.stallionState === 'ridden') return;
    if (this.stallionState === 'charge' && this.sT > 4.5) { this.chargeCd = 5; this.chargeTarget = null; this.setStallion('wheel'); }
    // beaten: under 25 % hp he stops fighting
    if (!this.beaten && st.hp < st.maxHp * 0.25) {
      this.beaten = true; this.beatenT = 90; this.setStallion('beaten');
      this.onBeaten?.(st, this);
      wildEnv.onEvent?.('stallion-beaten', st.position.x, st.position.z);
    }
    if (this.stallionState === 'beaten') {
      this.beatenT -= dt;
      if (this.beatenT <= 0) { this.beaten = false; st.hp = Math.max(st.hp, st.maxHp * 0.3); this.setStallion('watch'); }
      return;
    }
    if (this.mode === 'flee') { if (this.stallionState !== 'charge') this.setStallion('lead'); return; }
    const d = st.position.distanceTo(c.player);
    const standing = !wildEnv.playerCrouched;
    switch (this.stallionState) {
      case 'watch': case 'lead':
        if (d < 30 && (st.mem['aw'] ?? 0) > 0.25) this.setStallion('warn');
        else if (this.stallionState === 'lead') this.setStallion('watch');
        break;
      case 'warn':
        if (d > 36) { this.setStallion('watch'); break; }
        if (d < 20 && standing && this.sT > 1.2) this.setStallion('display');
        break;
      case 'display':
        if (this.sT > 2.2) {
          if (d < 10 && this.trust < 20 && this.chargeCd <= 0) { this.chargeTarget = null; this.setStallion('charge'); }
          else if (d < 20 && this.trust >= 20) this.startFlight(c.player.x, c.player.z, false);   // he leads them away
          else this.setStallion(d < 30 ? 'warn' : 'watch');
        }
        break;
      case 'charge': break;
      case 'wheel':
        if (this.sT > 2.2) this.setStallion('watch');
        break;
      default: break;
    }
  }

  /** steer one horse for this tick (after `tick`) */
  drive(a: Animal, c: ThinkCtx): void {
    const m = a.mem;
    if (a === this.ridden || (m['ridden'] ?? 0) === 1) return;
    // R3 (D8 (c)): a stampede — and the stallion's charge — runs THROUGH a player on foot (the knock-down in `trample` /
    // the charge is the hit, not a pile-up against his capsule), but a rider's horse is a body it collides with (Mount
    // jostles the rider, or throws him at a gallop)
    const through = !wildEnv.playerMounted && ((this.stampeding && this.mode === 'flee') || (a === this.stallion && this.stallionState === 'charge'));
    a.motor?.passThrough(through ? THROUGH_PLAYER : BLOCKED);
    if (a === this.stallion) { this.driveStallion(a, c); c.confine(a); return; }
    const foal = this.foals.includes(a);
    const mother = this.mothers.get(a);
    let vx = 0, vz = 0, speed = 0;
    let headUp = 0;
    const px = a.position.x, pz = a.position.z;
    // boids terms
    let sepX = 0, sepZ = 0, aliX = 0, aliZ = 0, nAli = 0;
    for (const o of this.members) {
      if (o === a || !o.alive || o === this.ridden) continue;
      const ox = px - o.position.x, oz = pz - o.position.z, d = Math.hypot(ox, oz);
      if (d < 2.5 && d > 1e-3) { const f = (2.5 - d) / 2.5; sepX += (ox / d) * f; sepZ += (oz / d) * f; }
      if (d < 8 && o.speed > 0.5) { aliX += Math.sin(o.yaw); aliZ += Math.cos(o.yaw); nAli++; }
    }
    const cdx = this.cx - px, cdz = this.cz - pz, cd = Math.hypot(cdx, cdz);
    const coh = cd > 12 ? Math.min(1, (cd - 12) / 10) : 0;
    switch (this.mode) {
      case 'graze': case 'drift': {
        // a foal sticks to its mother
        if (foal && mother?.alive === true) {
          const md = a.position.distanceTo(mother.position);
          if (md > 4) { vx = mother.position.x - px; vz = mother.position.z - pz; speed = md > 10 ? TROT : WALK * 1.1; break; }
        }
        if (this.mode === 'drift') {
          const lead = this.lead;
          let tx = this.spotX, tz = this.spotZ;
          if (a !== lead && lead?.alive === true) { tx = lead.position.x - Math.sin(lead.yaw) * 4; tz = lead.position.z - Math.cos(lead.yaw) * 4; }
          const td = Math.hypot(tx - px, tz - pz);
          if (a === lead || td > 6 || coh > 0) { const y = td > 8 ? c.pathYaw(a, tx, tz, 2) : Math.atan2(tx - px, tz - pz); vx = Math.sin(y) + sepX * 1.5 + (nAli > 0 ? aliX / nAli * 0.4 : 0); vz = Math.cos(y) + sepZ * 1.5 + (nAli > 0 ? aliZ / nAli * 0.4 : 0); speed = td > 30 ? TROT * 0.8 : WALK; }
          break;
        }
        // grazing: stand and eat, with the odd step; drift back if too far from the herd, step away if crowded
        m['gt'] = (m['gt'] ?? Math.random() * 6) - c.dt;
        if (coh > 0) { vx = cdx / cd; vz = cdz / cd; speed = WALK * (0.6 + coh * 0.6); break; }
        if (Math.hypot(sepX, sepZ) > 0.35) { vx = sepX; vz = sepZ; speed = 0.8; break; }
        if ((m['gt'] ?? 0) <= 0) { m['gt'] = 4 + Math.random() * 10; m['gyaw'] = a.yaw + (Math.random() - 0.5) * 2; m['gs'] = 1.2 + Math.random() * 1.5; }
        if ((m['gs'] ?? 0) > 0) { m['gs'] = (m['gs'] ?? 0) - c.dt; vx = Math.sin(m['gyaw'] ?? a.yaw); vz = Math.cos(m['gyaw'] ?? a.yaw); speed = 0.7; }
        break;
      }
      case 'alert':
        headUp = 1;
        a.lookTarget.copy(c.player); a.lookWeight = 1;
        if (foal && mother !== undefined && mother.alive && a.position.distanceTo(mother.position) > 2.5) { vx = mother.position.x - px; vz = mother.position.z - pz; speed = TROT * 0.7; }
        break;
      case 'flee': {
        vx = this.fleeX + sepX * 0.8 + cdx / (cd || 1) * coh * 0.6;
        vz = this.fleeZ + sepZ * 0.8 + cdz / (cd || 1) * coh * 0.6;
        const k = this.stampeding ? 1.04 : 0.96;
        speed = GALLOP * k * (0.96 + 0.08 * ((a.seed * 13) % 1)) * (foal ? 0.85 : 1);
        if (this.fleeRun > this.fleeLen - 20) speed = TROT * 1.3;
        headUp = 0.3;
        // the stampede runs things down
        if (this.stampeding && a.speed > 6) this.trample(a, c);
        break;
      }
      case 'settle':
        headUp = 1;
        if (this.modeT < 2.5) { vx = this.fleeX; vz = this.fleeZ; speed = TROT * (1 - this.modeT / 3); }
        a.lookTarget.set(this.fleeFromX, a.position.y, this.fleeFromZ); a.lookWeight = 1;
        break;
      // no default
    }
    if (speed > 0.05 && Math.hypot(vx, vz) > 1e-3) {
      a.state = this.mode === 'flee' ? 'flee' : 'wander';
      c.steer(a, Math.atan2(vx, vz), speed * a.mods.speed, this.mode === 'flee' ? 3 : 1.6);
    } else {
      a.state = this.mode === 'graze' ? 'graze' : 'alert';
      a.setMotion(a.yaw, 0, 1.5);
      if (this.mode === 'graze') a.lookWeight = (m['aw'] ?? 0) > 0.15 ? 0.6 : 0;
    }
    if ((this.mode === 'graze' || this.mode === 'drift') && (m['aw'] ?? 0) > 0.2) { a.lookTarget.copy(c.player); a.lookWeight = 0.7; }
    m['headUp'] = headUp;
    c.confine(a);
  }

  private driveStallion(a: Animal, c: ThinkCtx): void {
    const m = a.mem;
    const player = c.player;
    const toP = Math.atan2(player.x - a.position.x, player.z - a.position.z);
    m['headUp'] = 0; m['pin'] = 0; m['rear'] = 0;
    a.lookTarget.copy(player); a.lookWeight = 0;
    switch (this.stallionState) {
      case 'watch': case 'warn': {
        // the guard point: between the herd and you, 10–20 m out from the herd centre
        const tx0 = player.x - this.cx, tz0 = player.z - this.cz, td0 = Math.hypot(tx0, tz0) || 1;
        const out = THREE.MathUtils.clamp(td0 * 0.5, 10, 20);
        const gx = this.cx + (tx0 / td0) * out, gz = this.cz + (tz0 / td0) * out;
        const gd = Math.hypot(gx - a.position.x, gz - a.position.z);
        m['headUp'] = 1; a.lookWeight = 1;
        if (gd > 3) { a.state = 'wander'; c.steer(a, c.pathYaw(a, gx, gz, 1.5), gd > 15 ? TROT : WALK, 1.8); }
        else { a.state = 'alert'; a.setMotion(toP, 0, 1.2); }
        if (this.stallionState === 'warn') {
          m['pin'] = 0.6;
          // a snort and a stamp every 2–4 s
          m['snT'] = (m['snT'] ?? 0) - c.dt;
          if ((m['snT'] ?? 0) <= 0) { m['snT'] = 2 + Math.random() * 2; m['stamp'] = 1; m['toss'] = 1; c.sound('horse_snort'); }
        }
        break;
      }
      case 'display':
        a.state = 'alert'; a.setMotion(toP, 0, 3);
        m['rear'] = this.sT < 1.6 ? 1 : 0; m['pin'] = 1; a.lookWeight = 1;
        if (this.sT < 0.15) c.sound('horse_neigh');
        break;
      case 'charge': {
        const ct = this.chargeTarget;
        const tgt = ct?.alive === true ? ct.position : player;
        const tx = tgt.x - a.position.x, tz = tgt.z - a.position.z, td = Math.hypot(tx, tz);
        a.state = 'charge'; m['pin'] = 1;
        c.steer(a, td > 6 ? c.pathYaw(a, tgt.x, tgt.z, 0.5) : Math.atan2(tx, tz), CHARGE * a.mods.speed, 4.5);
        if (td < 1.9 * a.scale) {
          _t.set(tx, 0, tz).normalize();
          if (ct?.alive === true) {
            const w = ct;
            w.applyDamage(25, w.position, _t); w.stagger(_t, 1);
            const p = Pack.of(w);
            m['kicks'] = (m['kicks'] ?? 0) + 1;
            if (p !== null && (m['kicks'] ?? 0) >= 2) { p.scare(w.position.x, w.position.z, 40); wildEnv.onEvent?.('pack-driven-off', w.position.x, w.position.z); m['kicks'] = 0; }
          } else if (this.knockCd <= 0) {
            c.hurt(a.mods.chargeDamage); this.knockCd = 1.5;
            wildEnv.onKnockdown?.(_t.x, _t.z, 1);
          }
          m['kick'] = 1; c.sound('horse_squeal');
          this.chargeCd = 5; this.chargeTarget = null; this.setStallion('wheel');
        }
        break;
      }
      case 'wheel':
        a.state = 'flee';
        c.steer(a, toP + Math.PI + 0.6, TROT * 1.6, 3);
        break;
      case 'lead': {
        // run the flight at the herd's flank, between it and what it runs from
        const lx = this.cx - this.fleeX * 5 + this.fleeZ * 6, lz = this.cz - this.fleeZ * 5 - this.fleeX * 6;
        const ld = Math.hypot(lx - a.position.x, lz - a.position.z);
        a.state = 'flee';
        const speed = this.mode === 'flee' ? GALLOP * (ld > 6 ? 1.08 : 0.98) : TROT;
        c.steer(a, Math.atan2(lx - a.position.x + this.fleeX * 10, lz - a.position.z + this.fleeZ * 10), speed, 3);
        if (this.stampeding && a.speed > 6) this.trample(a, c);
        break;
      }
      case 'beaten':
        a.state = 'graze'; a.setMotion(a.yaw, 0, 1);   // head down, spent
        m['headUp'] = 0; m['toss'] = 0;
        break;
      case 'ridden': break;
      // no default
    }
  }

  /** a stampeding horse runs down the player / wolves in its path */
  private trample(a: Animal, c: ThinkCtx): void {
    const m = a.mem;
    if ((m['hitP'] ?? 0) === 0 && this.knockCd <= 0 && a.position.distanceTo(c.player) < 1.7 * a.scale && !wildEnv.playerMounted) {
      m['hitP'] = 1; this.knockCd = 1.2;
      c.hurt(30);
      _t.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
      wildEnv.onKnockdown?.(_t.x, _t.z, 1);
    }
    const w = this.findWolf?.(a.position.x, a.position.z, 1.8) ?? null;
    if (w !== null) { _t.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)); w.applyDamage(30, w.position, _t); w.stagger(_t, 1); }
  }
}

/** SpeciesDef.think for the horse */
export function thinkHorse(a: Animal, c: ThinkCtx): void {
  // ridden (Mount.ts drives it) or owned (a camp horse / Tulpar: Mount.ts's companion logic) — no herd AI at all
  if ((a.mem['ridden'] ?? 0) === 1 || (a.mem['owned'] ?? 0) === 1) return;
  const h = HorseHerd.forThink(a, c);
  if (h === null || !a.alive) { a.setMotion(a.yaw, 0, 1); return; }
  h.tick(c);
  h.drive(a, c);
}

/** SpeciesDef.damageMul: the stallion cannot be killed outright — hits shrink as his hp falls toward 20 % (he is BEATEN at 25 %) */
export function horseDamageMul(a: Animal): number {
  const f = a.hp / a.maxHp;
  // the rideable horses (camp horses, Tulpar — `mem.owned`) can't die: they bolt at 20 % (Mount.ts) and hits shrink toward 10 %
  if ((a.mem['owned'] ?? 0) === 1) return THREE.MathUtils.clamp((f - 0.1) / 0.9, 0, 1);
  if (a.variant !== 'stallion') return 1;
  return THREE.MathUtils.clamp((f - 0.2) / 0.8, 0, 1);
}

// E155 (src/core/shardState.ts): the running shard's herds (a rebuilt Nalati's, not the evicted one's)
listSlot('herds.all', HorseHerd.all);
