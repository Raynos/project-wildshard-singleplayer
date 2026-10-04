import { Vector3, MathUtils } from 'three';
import * as v from 'valibot';
import type { AnimalSim } from '../entities/AnimalSim';
import type { Rng } from '../core/rng';
import { GroupBrain } from './GroupBrain';

/** Shared grazing, alert and flight modes of a guarded herd. */
export type HerdMode = 'graze' | 'drift' | 'alert' | 'flee' | 'settle';
/** Guard animal decisions; riding and taming remain host-owned recipes. */
export type StallionState = 'watch' | 'warn' | 'display' | 'charge' | 'wheel' | 'lead' | 'beaten' | 'ridden';
/** Declared guarded-herd tuning, independent of any particular species rig. */
export interface HerdSpec {
  walkSpeed: number; trotSpeed: number; gallopSpeed: number; chargeSpeed: number;
  sightRadius: number; grazingSightRadius: number; coneAngle: number; hearing: readonly [number, number, number, number];
  alertThreshold: number; flightMinDistance: number; flightMaxDistance: number;
  stallionVariant: string; foalPrefix: string; snortCue: string; neighCue: string; squealCue: string;
}
/** Host-owned clock, steering and player observations for one AI or body tick. */
export interface HerdContext<A extends AnimalSim> {
  dt: number; t: number; player: Vector3; playerSpeed: number; calm: boolean; rng: Rng;
  sound: (cue: string) => void; hurt: (damage: number) => void;
  steer: (actor: A, yaw: number, speed: number, turn: number) => void;
  pathYaw: (actor: A, x: number, z: number, every?: number) => number; confine: (actor: A) => void;
}
/** Native sensing, terrain, pass-through, contact and shared-RNG recipes; no renderer or app singleton. */
export interface HerdPorts<A extends AnimalSim> {
  sharedRng: () => Rng; environment: () => { playerMounted: boolean; playerCrouched: boolean };
  visibility: (x: number, z: number, player: Vector3, speed: number, time: number) => number;
  hearing: (radii: readonly [number, number, number, number], player: Vector3, speed: number) => number;
  downwind: (x: number, z: number, player: Vector3) => boolean;
  inBounds: (x: number, z: number, margin: number) => boolean; normalY: (x: number, z: number) => number;
  passThrough: (actor: A, player: boolean) => void; chargeContact: (actor: A, context: HerdContext<A>, radius: number) => void;
  scarePack: (actor: A, radius: number) => boolean; resolveActor?: (id: string) => A | null;
  onEvent?: (event: string, x: number, z: number) => void; onKnockdown?: (x: number, z: number, strength: number) => void;
}
const _t = new Vector3();
const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function validateHerd(spec: HerdSpec): HerdSpec {
  const numbers = [spec.walkSpeed, spec.trotSpeed, spec.gallopSpeed, spec.chargeSpeed, spec.sightRadius, spec.grazingSightRadius,
    spec.coneAngle, ...spec.hearing, spec.alertThreshold, spec.flightMinDistance, spec.flightMaxDistance];
  if (numbers.some(value => !Number.isFinite(value) || value < 0 || value > 600) || Math.max(spec.walkSpeed, spec.trotSpeed, spec.gallopSpeed, spec.chargeSpeed) > 15
    || spec.walkSpeed > spec.trotSpeed || spec.trotSpeed > spec.gallopSpeed || spec.grazingSightRadius > spec.sightRadius
    || spec.coneAngle > Math.PI || spec.alertThreshold <= 0 || spec.alertThreshold > 1 || spec.flightMinDistance > spec.flightMaxDistance
    || [spec.stallionVariant, spec.foalPrefix, spec.snortCue, spec.neighCue, spec.squealCue].some(value => value.length === 0 || value.length > 128)) throw new Error('Invalid herd parameters');
  return { ...spec, hearing: [...spec.hearing] };
}
const finite = v.pipe(v.number(), v.finite());
const continuation = v.strictObject({ contract: v.string(), group: v.string(), lead: v.nullable(v.string()), stallion: v.nullable(v.string()),
  ridden: v.nullable(v.string()), chargeTarget: v.nullable(v.string()), foals: v.array(v.string()), mothers: v.array(v.tuple([v.string(), v.string()])),
  state: v.strictObject({ initialized: v.boolean(), mode: v.picklist(['graze', 'drift', 'alert', 'flee', 'settle']), stampeding: v.boolean(),
    stallionState: v.picklist(['watch', 'warn', 'display', 'charge', 'wheel', 'lead', 'beaten', 'ridden']), trust: finite, alert: finite,
    alertOwned: v.boolean(), cx: finite, cz: finite, spotX: finite, spotZ: finite, spotT: finite, fleeX: finite, fleeZ: finite,
    fleeRun: finite, fleeLen: finite, fleeFromX: finite, fleeFromZ: finite, modeT: finite, sT: finite, chargeCd: finite,
    beatenT: finite, beaten: v.boolean(), knockCd: finite }) });
/** Renderer-free guarded-herd decisions, boids and contact timing; unique taming and combat recipes are injected. */
export class HerdBrain<A extends AnimalSim> extends GroupBrain<A> {
  private initialized = false;
  private readonly spec: HerdSpec; private readonly ports: HerdPorts<A>; private readonly contract: string;
  lead: A | null = null;
  stallion: A | null = null;
  readonly foals: A[] = [];
  mode: HerdMode = 'graze';
  stampeding = false;
  stallionState: StallionState = 'watch';
  /** taming (B8): 0..100 */
  trust = 0;
  /** the stallion's ALERT, 0..100 */
  alert = 0;
  /** true while taming (B8, src/shards/nalati-grasslands/ride/Taming.ts) owns `alert` — the herd stops writing it */
  alertOwned = false;
  get calm(): number { return 1 - this.alert / 100; }
  ridden: A | null = null;
  onBeaten?: ((stallion: A, herd: HerdBrain<A>) => void) | undefined;
  onStallionState?: ((state: StallionState, herd: HerdBrain<A>) => void) | undefined;
  onFlight?: ((stampede: boolean, herd: HerdBrain<A>) => void) | undefined;
  /** nearest living threat to (x, z) within r (Wildlife wires it to the packs) */
  findThreat?: ((x: number, z: number, r: number) => A | null) | undefined;

  cx = 0; cz = 0;
  private spotX = 0; private spotZ = 0; private spotT = 0;
  private fleeX = 0; private fleeZ = 1; private fleeRun = 0; private fleeLen = 100; private fleeFromX = 0; private fleeFromZ = 0;
  private modeT = 0;
  private mothers = new Map<A, A>();
  private sT = 0; private chargeCd = 0; private beatenT = 0; private beaten = false; private chargeTarget: A | null = null;
  private knockCd = 0;

  constructor(members: A[], spec: HerdSpec, ports: HerdPorts<A>) {
    super(members);
    this.ports = ports; this.spec = validateHerd(spec); this.contract = JSON.stringify(this.spec);
    if (members.length === 0 || members.length > 128 || new Set(members.map(actor => actor.entityId)).size !== members.length) throw new Error('Invalid herd roster');
    for (const h of members) {
      if (h.variant === this.spec.stallionVariant) this.stallion = h;
      else if (h.variant.startsWith(this.spec.foalPrefix)) this.foals.push(h);
    }
    // the lead mare: the biggest adult mare
    for (const h of members) if (h !== this.stallion && !this.foals.includes(h) && (this.lead === null || h.scale > this.lead.scale)) this.lead = h;
    // each foal gets the nearest adult mare as its mother
    for (const f of this.foals) {
      let best: A | null = null, bd = Infinity;
      for (const h of members) {
        if (h === this.stallion || this.foals.includes(h)) continue;
        if ([...this.mothers.values()].includes(h)) continue;
        const d = h.position.distanceToSquared(f.position);
        if (d < bd) { bd = d; best = h; }
      }
      if (best !== null) this.mothers.set(f, best);
    }
    this.centre();
    this.spotX = this.cx; this.spotZ = this.cz; this.spotT = 0;
  }

  /** Perform only the shipping initial graze-timer draw, exactly once after complete controller preflight. */
  initialize(): void {
    if (this.initialized) throw new Error('Herd already initialized');
    this.spotT = 20 + this.ports.sharedRng().next() * 40; this.initialized = true;
  }

  /** Snapshot shared boids/taming timers and stable actor references; the world owner snapshots actors and RNG separately. */
  snapshot(): string {
    const id = (actor: A | null): string | null => actor?.entityId ?? null;
    return JSON.stringify({ contract: this.contract, group: this.snapshotGroup(actor => actor.entityId), lead: id(this.lead),
      stallion: id(this.stallion), ridden: id(this.ridden), chargeTarget: id(this.chargeTarget), foals: this.foals.map(actor => actor.entityId),
      mothers: [...this.mothers].map(([foal, mother]) => [foal.entityId, mother.entityId]), state: {
        initialized: this.initialized, mode: this.mode, stampeding: this.stampeding, stallionState: this.stallionState, trust: this.trust, alert: this.alert,
        alertOwned: this.alertOwned, cx: this.cx, cz: this.cz, spotX: this.spotX, spotZ: this.spotZ, spotT: this.spotT,
        fleeX: this.fleeX, fleeZ: this.fleeZ, fleeRun: this.fleeRun, fleeLen: this.fleeLen, fleeFromX: this.fleeFromX,
        fleeFromZ: this.fleeFromZ, modeT: this.modeT, sT: this.sT, chargeCd: this.chargeCd, beatenT: this.beatenT,
        beaten: this.beaten, knockCd: this.knockCd } });
  }
  /** Preflight tuning, roster, mothers and external threats before restoring; no body, taming callback or RNG executes. */
  restore(saved: string): void {
    const data = v.parse(continuation, JSON.parse(saved));
    if (data.contract !== this.contract) throw new Error('Incompatible herd continuation');
    const member = (id: string | null): A | null => {
      if (id === null) return null;
      const actor = this.members.find(value => value.entityId === id);
      if (actor === undefined) throw new Error('Unresolved herd member'); return actor;
    };
    const lead = member(data.lead), stallion = member(data.stallion), ridden = member(data.ridden);
    const foals = data.foals.map(id => member(id)), mothers = new Map<A, A>();
    if (new Set(data.foals).size !== data.foals.length || data.mothers.length > foals.length) throw new Error('Invalid herd roles');
    for (const [foalId, motherId] of data.mothers) {
      const foal = member(foalId), mother = member(motherId);
      if (foal === null || mother === null || !foals.includes(foal) || foals.includes(mother) || mothers.has(foal)
        || [...mothers.values()].includes(mother)) throw new Error('Invalid herd mothers'); mothers.set(foal, mother);
    }
    const chargeTarget = data.chargeTarget === null ? null : this.members.find(actor => actor.entityId === data.chargeTarget) ?? this.ports.resolveActor?.(data.chargeTarget);
    if (chargeTarget === undefined || (data.chargeTarget !== null && (chargeTarget === null || chargeTarget.entityId !== data.chargeTarget))) throw new Error('Unresolved herd threat');
    this.restoreGroup(data.group, actor => actor.entityId);
    this.lead = lead; this.stallion = stallion; this.ridden = ridden; this.chargeTarget = chargeTarget;
    this.foals.length = 0; for (const foal of foals) if (foal !== null) this.foals.push(foal);
    this.mothers = mothers; Object.assign(this, data.state);
  }

  /** B7: this horse is being ridden — the herd lets go of it (null hands it back) */
  setRidden(a: A | null): void {
    if (this.ridden !== null) this.ridden.mem['ridden'] = 0;
    this.ridden = a;
    if (a !== null) { a.mem['ridden'] = 1; if (a === this.stallion) this.setStallion('ridden'); }
    else if (this.stallionState === 'ridden') this.setStallion('watch');
  }
  addTrust(n: number): void { this.trust = MathUtils.clamp(this.trust + n, 0, 100); }

  /** a shot / a loud thing landed at (x, z): within 15 m of a horse → stampede, within 40 m → heads up */
  disturb(x: number, z: number): void {
    let near = Infinity;
    for (const h of this.members) if (h.alive) near = Math.min(near, Math.hypot(h.position.x - x, h.position.z - z));
    if (near < 15) this.stampede(x, z);
    else if (near < 40) for (const h of this.members) h.mem['aw'] = Math.max(h.mem['aw'] ?? 0, this.spec.alertThreshold);
  }

  /** the flight becomes a stampede, away from (x, z) */
  stampede(x: number, z: number): void { this.startFlight(x, z, true); }
  /** the stallion leads the herd away from (x, z) at a gallop (taming: ALERT maxed with some trust) — not a stampede */
  leadAway(x: number, z: number): void { this.startFlight(x, z, false); }
  /** the stallion leaves the herd for good (tamed): the herd grazes on without a guard */
  /** a stallion of another kind joins this herd as its stallion (the elite Argymaq, src/shards/nalati-grasslands/combat/elites.ts). Without the
   *  registration his brain (thinkHorse → forThink) found no herd and built a fresh one every tick — he was never BEATEN
   *  and the mares were re-homed into throwaway herds (HerdBrain<A>.all grew at 10 Hz) */
  adoptStallion(a: A): void { if (!this.members.includes(a)) this.members.push(a); this.stallion = a; this.setStallion('watch'); }
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
    if (s === 'display' && this.stallion !== null) this.ports.onEvent?.('stallion-display', this.stallion.position.x, this.stallion.position.z);
  }

  private startFlight(fromX: number, fromZ: number, stampede: boolean): void {
    if (this.mode === 'flee' && (!stampede || this.stampeding)) return;
    let dx = this.cx - fromX, dz = this.cz - fromZ;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    this.fleeX = dx; this.fleeZ = dz; this.fleeFromX = fromX; this.fleeFromZ = fromZ;
    this.fleeRun = 0; this.fleeLen = this.spec.flightMinDistance + this.ports.sharedRng().next() * (this.spec.flightMaxDistance - this.spec.flightMinDistance);
    this.mode = 'flee'; this.modeT = 0; this.stampeding = stampede;
    this.trust = Math.max(0, this.trust - 30);
    for (const h of this.members) { h.mem['hitP'] = 0; h.mem['aw'] = 1; }
    if (this.stallionState !== 'beaten' && this.stallionState !== 'ridden') this.setStallion('lead');
    this.onFlight?.(stampede, this);
    if (stampede) this.ports.onEvent?.('stampede', this.cx, this.cz);
  }

  /** the herd-level tick: senses, alarms, mode changes (once per AI tick) */
  tick(c: HerdContext<A>): void {
    if (!this.initialized) throw new Error('Herd is not initialized');
    const dt = this.groupDelta(c.t, c.dt);
    if (dt <= 0) return;
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
        const V = this.ports.visibility(h.position.x, h.position.z, player, c.playerSpeed, c.t);
        const sight = (h.state === 'graze' ? this.spec.grazingSightRadius : this.spec.sightRadius) * V;
        if (d < sight && Math.abs(angDiff(Math.atan2(dx, dz), h.yaw)) < this.spec.coneAngle) rate = Math.max(rate, 0.4 * (2 - d / sight));
        const hear = this.ports.hearing(this.spec.hearing, player, c.playerSpeed);
        if (d < hear) rate = Math.max(rate, 0.5 * (2 - d / hear));
        if (h === this.stallion && d < 40 && this.ports.downwind(h.position.x, h.position.z, player)) rate = Math.max(rate, 0.3 * (2 - d / 40));
        // a rider galloping into the herd: stampede
        if (this.ports.environment().playerMounted && c.playerSpeed > 10 && d < 8) this.startFlight(player.x, player.z, true);
        // trust calms them: at 60+ they tolerate you close, at 100 they barely care
        rate *= 1 - this.trust / 125;
        if (d < 10 && this.trust < 60 && h !== this.stallion && c.playerSpeed > 0.5) bolt = true;
      }
      aw = rate > 0 ? Math.min(1, aw + rate * dt) : Math.max(0, aw - 0.12 * dt);
      // the alarm spreads: a head up nudges the neighbours within 20 m after 0.2–0.8 s
      if (aw >= this.spec.alertThreshold && (h.mem['alarm'] ?? 0) === 0) {
        h.mem['alarm'] = 1;
        for (const o of this.members) if (o !== h && o.alive && o.position.distanceTo(h.position) < 20) o.mem['alarmT'] = Math.max(o.mem['alarmT'] ?? 0, 0.2 + this.ports.sharedRng().next() * 0.6);
      }
      if (aw < this.spec.alertThreshold * 0.5) h.mem['alarm'] = 0;
      const at = h.mem['alarmT'] ?? 0;
      if (at > 0) { h.mem['alarmT'] = at - dt; if (at - dt <= 0) aw = Math.max(aw, this.spec.alertThreshold); }
      h.mem['aw'] = aw;
      if (h !== this.stallion) maxAw = Math.max(maxAw, aw);
      if (aw >= 1 && h !== this.stallion) bolt = true;
    }
    // the stallion's ALERT (0..100): his senses, pushed up by his warnings
    const st = this.stallion;
    if (st?.alive === true && !this.alertOwned) {
      const base = (st.mem['aw'] ?? 0) * 70 + (this.stallionState === 'warn' ? 20 : this.stallionState === 'display' || this.stallionState === 'charge' ? 30 : 0);
      this.alert += (MathUtils.clamp(base, 0, 100) - this.alert) * Math.min(1, dt * 2);
    }

    // ── wolves ──
    const threat = this.findThreat?.(this.cx, this.cz, 45) ?? null;
    if (threat !== null) {
      const wd = Math.hypot(threat.position.x - this.cx, threat.position.z - this.cz);
      if (wd < 25 && this.mode !== 'flee') this.startFlight(threat.position.x, threat.position.z, false);
      // the stallion goes for a threat near a foal (or himself)
      if (st !== null && st.alive && this.stallionState !== 'beaten' && this.stallionState !== 'ridden' && this.stallionState !== 'charge') {
        let threatened = false;
        for (const f of this.foals) if (f.alive && f.position.distanceTo(threat.position) < 15) threatened = true;
        if (threatened || st.position.distanceTo(threat.position) < 8) { this.chargeTarget = threat; this.setStallion('charge'); }
      }
    }

    // ── modes ──
    switch (this.mode) {
      case 'graze': case 'drift': {
        if (bolt) { this.startFlight(player.x, player.z, false); break; }
        if (maxAw >= this.spec.alertThreshold) { this.mode = 'alert'; this.modeT = 0; break; }
        this.spotT -= dt;
        if (this.spotT <= 0) this.pickSpot(c);
        const lead = this.lead;
        if (lead?.alive === true) this.mode = Math.hypot(this.spotX - lead.position.x, this.spotZ - lead.position.z) > 6 ? 'drift' : 'graze';
        break;
      }
      case 'alert':
        if (bolt) { this.startFlight(player.x, player.z, false); break; }
        if (maxAw < this.spec.alertThreshold * 0.6 && this.modeT > 3) { this.mode = 'graze'; this.modeT = 0; }
        break;
      case 'flee': {
        this.fleeRun += moved;
        // bend off the slab edge / steep ground: look 30 m ahead of the herd
        for (let k = 0; k < 6; k++) {
          const ax = this.cx + this.fleeX * 30, az = this.cz + this.fleeZ * 30;
          if (this.ports.inBounds(ax, az, 28) && this.ports.normalY(ax, az) > 0.72) break;
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

  private pickSpot(c: HerdContext<A>): void {
    const lead = this.lead ?? this.members[0];
    if (lead === undefined) return;
    for (let i = 0; i < 16; i++) {
      const ang = c.rng.range(0, Math.PI * 2), r = c.rng.range(30, 60);
      const x = lead.position.x + Math.cos(ang) * r, z = lead.position.z + Math.sin(ang) * r;
      if (!this.ports.inBounds(x, z, 35) || this.ports.normalY(x, z) < 0.85) continue;
      if (Math.hypot(x - c.player.x, z - c.player.z) < 40) continue;
      this.spotX = x; this.spotZ = z; break;
    }
    this.spotT = c.rng.range(60, 120);
  }

  private stallionTick(c: HerdContext<A>, dt: number, _dCentre: number): void {
    const st = this.stallion;
    if (st === null) return;
    if (this.stallionState === 'ridden') return;
    if (this.stallionState === 'charge' && this.sT > 4.5) { this.chargeCd = 5; this.chargeTarget = null; this.setStallion('wheel'); }
    // beaten: under 25 % hp he stops fighting
    if (!this.beaten && st.hp < st.maxHp * 0.25) {
      this.beaten = true; this.beatenT = 90; this.setStallion('beaten');
      this.onBeaten?.(st, this);
      this.ports.onEvent?.('stallion-beaten', st.position.x, st.position.z);
    }
    if (this.stallionState === 'beaten') {
      this.beatenT -= dt;
      if (this.beatenT <= 0) { this.beaten = false; st.hp = Math.max(st.hp, st.maxHp * 0.3); this.setStallion('watch'); }
      return;
    }
    if (this.mode === 'flee') { if (this.stallionState !== 'charge') this.setStallion('lead'); return; }
    const d = st.position.distanceTo(c.player);
    const standing = !this.ports.environment().playerCrouched;
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
  drive(a: A, c: HerdContext<A>, body = false): void {
    if (!this.initialized) throw new Error('Herd is not initialized');
    const m = a.mem;
    const committed = a === this.stallion && this.stallionState === 'charge';
    if (body !== committed) return;
    if (a === this.ridden || (m['ridden'] ?? 0) === 1) return;
    // R3 (D8 (c)): a stampede — and the stallion's charge — runs THROUGH a player on foot (the knock-down in `trample` /
    // the charge is the hit, not a pile-up against his capsule), but a rider's horse is a body it collides with (Mount
    // jostles the rider, or throws him at a gallop)
    const through = !this.ports.environment().playerMounted && ((this.stampeding && this.mode === 'flee') || (a === this.stallion && this.stallionState === 'charge'));
    this.ports.passThrough(a, through);
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
          if (md > 4) { vx = mother.position.x - px; vz = mother.position.z - pz; speed = md > 10 ? this.spec.trotSpeed : this.spec.walkSpeed * 1.1; break; }
        }
        if (this.mode === 'drift') {
          const lead = this.lead;
          let tx = this.spotX, tz = this.spotZ;
          if (a !== lead && lead?.alive === true) { tx = lead.position.x - Math.sin(lead.yaw) * 4; tz = lead.position.z - Math.cos(lead.yaw) * 4; }
          const td = Math.hypot(tx - px, tz - pz);
          if (a === lead || td > 6 || coh > 0) { const y = td > 8 ? c.pathYaw(a, tx, tz, 2) : Math.atan2(tx - px, tz - pz); vx = Math.sin(y) + sepX * 1.5 + (nAli > 0 ? aliX / nAli * 0.4 : 0); vz = Math.cos(y) + sepZ * 1.5 + (nAli > 0 ? aliZ / nAli * 0.4 : 0); speed = td > 30 ? this.spec.trotSpeed * 0.8 : this.spec.walkSpeed; }
          break;
        }
        // grazing: stand and eat, with the odd step; drift back if too far from the herd, step away if crowded
        m['gt'] = (m['gt'] ?? this.ports.sharedRng().next() * 6) - c.dt;
        if (coh > 0) { vx = cdx / cd; vz = cdz / cd; speed = this.spec.walkSpeed * (0.6 + coh * 0.6); break; }
        if (Math.hypot(sepX, sepZ) > 0.35) { vx = sepX; vz = sepZ; speed = 0.8; break; }
        if ((m['gt'] ?? 0) <= 0) { m['gt'] = 4 + this.ports.sharedRng().next() * 10; m['gyaw'] = a.yaw + (this.ports.sharedRng().next() - 0.5) * 2; m['gs'] = 1.2 + this.ports.sharedRng().next() * 1.5; }
        if ((m['gs'] ?? 0) > 0) { m['gs'] = (m['gs'] ?? 0) - c.dt; vx = Math.sin(m['gyaw'] ?? a.yaw); vz = Math.cos(m['gyaw'] ?? a.yaw); speed = 0.7; }
        break;
      }
      case 'alert':
        headUp = 1;
        a.lookTarget.copy(c.player); a.lookWeight = 1;
        if (foal && mother !== undefined && mother.alive && a.position.distanceTo(mother.position) > 2.5) { vx = mother.position.x - px; vz = mother.position.z - pz; speed = this.spec.trotSpeed * 0.7; }
        break;
      case 'flee': {
        vx = this.fleeX + sepX * 0.8 + cdx / (cd || 1) * coh * 0.6;
        vz = this.fleeZ + sepZ * 0.8 + cdz / (cd || 1) * coh * 0.6;
        const k = this.stampeding ? 1.04 : 0.96;
        speed = this.spec.gallopSpeed * k * (0.96 + 0.08 * ((a.seed * 13) % 1)) * (foal ? 0.85 : 1);
        if (this.fleeRun > this.fleeLen - 20) speed = this.spec.trotSpeed * 1.3;
        headUp = 0.3;
        // the stampede runs things down
        if (this.stampeding && a.speed > 6) this.trample(a, c);
        break;
      }
      case 'settle':
        headUp = 1;
        if (this.modeT < 2.5) { vx = this.fleeX; vz = this.fleeZ; speed = this.spec.trotSpeed * (1 - this.modeT / 3); }
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

  private driveStallion(a: A, c: HerdContext<A>): void {
    const m = a.mem;
    const player = c.player;
    const toP = Math.atan2(player.x - a.position.x, player.z - a.position.z);
    m['headUp'] = 0; m['pin'] = 0; m['rear'] = 0;
    a.lookTarget.copy(player); a.lookWeight = 0;
    switch (this.stallionState) {
      case 'watch': case 'warn': {
        // the guard point: between the herd and you, 10–20 m out from the herd centre
        const tx0 = player.x - this.cx, tz0 = player.z - this.cz, td0 = Math.hypot(tx0, tz0) || 1;
        const out = MathUtils.clamp(td0 * 0.5, 10, 20);
        const gx = this.cx + (tx0 / td0) * out, gz = this.cz + (tz0 / td0) * out;
        const gd = Math.hypot(gx - a.position.x, gz - a.position.z);
        m['headUp'] = 1; a.lookWeight = 1;
        if (gd > 3) { a.state = 'wander'; c.steer(a, c.pathYaw(a, gx, gz, 1.5), gd > 15 ? this.spec.trotSpeed : this.spec.walkSpeed, 1.8); }
        else { a.state = 'alert'; a.setMotion(toP, 0, 1.2); }
        if (this.stallionState === 'warn') {
          m['pin'] = 0.6;
          // a snort and a stamp every 2–4 s
          m['snT'] = (m['snT'] ?? 0) - c.dt;
          if ((m['snT'] ?? 0) <= 0) { m['snT'] = 2 + this.ports.sharedRng().next() * 2; m['stamp'] = 1; m['toss'] = 1; c.sound(this.spec.snortCue); }
        }
        break;
      }
      case 'display':
        a.state = 'alert'; a.setMotion(toP, 0, 3);
        m['rear'] = this.sT < 1.6 ? 1 : 0; m['pin'] = 1; a.lookWeight = 1;
        if (this.sT < 0.15) c.sound(this.spec.neighCue);
        break;
      case 'charge': {
        const ct = this.chargeTarget;
        const tgt = ct?.alive === true ? ct.position : player;
        const tx = tgt.x - a.position.x, tz = tgt.z - a.position.z, td = Math.hypot(tx, tz);
        a.state = 'charge'; m['pin'] = 1;
        c.steer(a, td > 6 ? c.pathYaw(a, tgt.x, tgt.z, 0.5) : Math.atan2(tx, tz), this.spec.chargeSpeed * a.mods.speed, 4.5);
        if (td < 1.9 * a.scale) {
          _t.set(tx, 0, tz).normalize();
          if (ct?.alive === true) {
            const w = ct;
            w.applyDamage(25, w.position, _t); w.stagger(_t, 1);
            m['kicks'] = (m['kicks'] ?? 0) + 1;
            if ((m['kicks'] ?? 0) >= 2 && this.ports.scarePack(w, 40)) { this.ports.onEvent?.('pack-driven-off', w.position.x, w.position.z); m['kicks'] = 0; }
          } else if (this.knockCd <= 0) {
            this.ports.chargeContact(a, c, 1.9 * a.scale); this.knockCd = 1.5;
            this.ports.onKnockdown?.(_t.x, _t.z, 1);
          }
          m['kick'] = 1; c.sound(this.spec.squealCue);
          this.chargeCd = 5; this.chargeTarget = null; this.setStallion('wheel');
        }
        break;
      }
      case 'wheel':
        a.state = 'flee';
        c.steer(a, toP + Math.PI + 0.6, this.spec.trotSpeed * 1.6, 3);
        break;
      case 'lead': {
        // run the flight at the herd's flank, between it and what it runs from
        const lx = this.cx - this.fleeX * 5 + this.fleeZ * 6, lz = this.cz - this.fleeZ * 5 - this.fleeX * 6;
        const ld = Math.hypot(lx - a.position.x, lz - a.position.z);
        a.state = 'flee';
        const speed = this.mode === 'flee' ? this.spec.gallopSpeed * (ld > 6 ? 1.08 : 0.98) : this.spec.trotSpeed;
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
  private trample(a: A, c: HerdContext<A>): void {
    const m = a.mem;
    if ((m['hitP'] ?? 0) === 0 && this.knockCd <= 0 && a.position.distanceTo(c.player) < 1.7 * a.scale && !this.ports.environment().playerMounted) {
      m['hitP'] = 1; this.knockCd = 1.2;
      c.hurt(30);
      _t.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
      this.ports.onKnockdown?.(_t.x, _t.z, 1);
    }
    const w = this.findThreat?.(a.position.x, a.position.z, 1.8) ?? null;
    if (w !== null) { _t.set(Math.sin(a.yaw), 0, Math.cos(a.yaw)); w.applyDamage(30, w.position, _t); w.stagger(_t, 1); }
  }
}
