import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from './Player';
import type { Forest } from '../world/Forest';
import { heightAt, normalAt } from '../world/Heightfield';
import { CHUNK_HALF } from '../core/config';
import { Puffs, type ImpactSurface, type TargetAnimal, type TargetHit, type Targets } from './Crossbow';

/**
 * Projectiles — Nalati's shared flight model for thrown / loosed things (the bow's arrows today, the spear slot's
 * javelins if the melee rig wants them). It is a SEPARATE module from the crossbow's bolt code on purpose: the
 * crossbow (Pine Hollow) keeps its own flight, stuck-bolt and tracer code byte-for-byte, and nothing here is
 * imported by it. What it borrows from Crossbow.ts is read-only: the `Targets` interface and the impact `Puffs`.
 *
 *   const arrows = new Projectiles({ game, sky, player, forest }, targets, ARROW);   // one pool per kind
 *   arrows.wind = wind;                                  // optional: src/world/Wind.ts's `wind` (m/s in XZ, see WindField)
 *   arrows.launch(origin, velocity, { damageScale: 1.2 });
 *   arrows.update(dt, t);                                // every frame (the Bow calls it from its own update)
 *   arrows.predict(origin, velocity, pts, 64, 1.4)       // the drop-arc preview: the SAME integrator (terrain, trunks, colliders)
 *   arrows.onHit / onImpact / onRecover                  // hooks
 *   arrows.canRecover = () => quiver < max;              // walk-over pickup of stuck ones (only while it says yes)
 *
 * Flight (per kind): gravity, quadratic-ish drag (`v *= 1 − drag·h·|v|·0.1`, the crossbow's form), and a wind
 * coupling that pushes the projectile SIDEWAYS toward the wind: a = coupling × (wind − v)⊥v̂ (combat.md: 0.25 /s for
 * arrows → 0.75 m drift at 60 m in a 6 m/s breeze). Four substeps a frame; each substep's segment is tested against
 * animals (`targets.raycast`), tree trunks (`forest.nearby`), the player's oriented-box colliders (yurts, fences,
 * targets — `player.colliders`) and the terrain.
 *
 * Stuck projectiles (terrain, trunks, colliders, animals) are ONE InstancedMesh with the flying ones — a single draw
 * call for every arrow in the shard (no shadow pass: they are 9 mm thick). An arrow in a LIVE animal rides with it
 * (offset kept in the animal's yaw frame); when the animal dies the arrow drops into the ground beside the carcass.
 * A stuck arrow within reach of the player's feet is recovered: `recover` of them survive (+1 via `onRecover(true)`),
 * the rest break (`onRecover(false)`) and just vanish. Only the cap evicts un-recovered ones, oldest first.
 *
 * Geometry convention: the projectile's TIP is at the origin and the shaft runs along +Z (flight is −Z), so a stuck
 * instance is simply placed at `hit + dir × bury`.
 */

/** the wind the projectiles drift in: metres / second in XZ at a world point (y is ignored). `src/world/Wind.ts`'s
 *  `wind` fits as it is (`vecAt`, gusts included) — one wind object, so grass, clouds and arrows agree. */
export interface WindField { vecAt: (x: number, z: number, out: THREE.Vector3) => THREE.Vector3 }

export interface ProjectileKind {
  /** tip at the origin, shaft along +Z */
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  /** metres from the tip to the nock */
  length: number;
  gravity: number;
  drag: number;
  /** /s — sideways pull toward the wind velocity */
  windCoupling: number;
  /** how deep the tip sits in wood / ground (m) */
  bury: number;
  /** chance a stuck one survives being picked up */
  recover: number;
  /** flying at once (older ones are recycled) */
  maxFlying: number;
  /** stuck ones kept (oldest evicted) */
  maxStuck: number;
}

export interface ProjectileWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface ShotOpts {
  /** × the animal's own `damageFor(headshot, distance)` (the crossbow's 32–40 body model) */
  damageScale: number;
  /** optional extra multiplier decided at the hit (the sneak shot from HIDDEN, a Parthian stagger …) */
  onHitScale?: ((hit: TargetHit) => number) | undefined;
}

interface Flying { slot: number; pos: THREE.Vector3; vel: THREE.Vector3; origin: THREE.Vector3; active: boolean; age: number; roll: number; scale: number; hitScale: ((hit: TargetHit) => number) | undefined }
interface Stuck {
  slot: number; pos: THREE.Vector3; dir: THREE.Vector3; roll: number;
  /** riding a live animal: offset + direction in its yaw frame */
  animal: TargetAnimal | null; local: THREE.Vector3; localDir: THREE.Vector3;
  /** reachable from the ground (not 4 m up a trunk) */
  recoverable: boolean;
}

const TRUNK_PAD = 0.15; // Forest pads every trunk's collision radius by this much (Forest.ts)
const RECOVER_R = 1.25; // m, horizontal reach from the feet
const RECOVER_UP = 2.1; // m, highest point of a stuck arrow's midpoint the player can pull out
const NEG_Z = new THREE.Vector3(0, 0, -1), POS_Z = new THREE.Vector3(0, 0, 1), Y_AXIS = new THREE.Vector3(0, 1, 0);
const _cp = new THREE.Vector3(), _chord = new THREE.Vector3();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3(), _wind = new THREE.Vector3(), _side = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

/** the animal's heading if it has one (every `Animal` does; a stub target may not) */
function yawOf(a: TargetAnimal): number { return 'yaw' in a && typeof a.yaw === 'number' ? a.yaw : 0; }
/** a hidden (harvested, faded) carcass */
function hiddenOf(a: TargetAnimal): boolean { return 'hidden' in a && a.hidden === true; }

export class Projectiles {
  wind: WindField | null = null;
  onHit?: ((kind: string, headshot: boolean, killed: boolean, point: THREE.Vector3, damage: number) => void) | undefined;
  onImpact?: ((surface: ImpactSurface, point: THREE.Vector3) => void) | undefined;
  /** a stuck one was picked up: survived → +1 in the quiver; false = it broke */
  onRecover?: ((survived: boolean) => void) | undefined;
  /** the pickup only happens while this says yes (quiver not full) */
  canRecover: () => boolean = () => true;
  readonly mesh: THREE.InstancedMesh;

  private readonly kind: ProjectileKind;
  private readonly game: Game; private readonly player: Player; private readonly forest: Forest;
  private readonly targets: Targets | undefined;
  private readonly flying: Flying[] = [];
  private readonly stuck: Stuck[] = [];
  private readonly freeStuckSlots: number[] = [];
  private readonly puffs = new Puffs();
  private recoverFrame = 0;
  private dirty = false;

  constructor(world: ProjectileWorld, targets: Targets | undefined, kind: ProjectileKind) {
    this.game = world.game; this.player = world.player; this.forest = world.forest;
    this.targets = targets; this.kind = kind;
    const cap = kind.maxFlying + kind.maxStuck;
    this.mesh = new THREE.InstancedMesh(kind.geometry, kind.material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.name = 'projectiles';
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO_M);
    for (let i = 0; i < kind.maxFlying; i++) this.flying.push({ slot: i, pos: new THREE.Vector3(), vel: new THREE.Vector3(), origin: new THREE.Vector3(), active: false, age: 0, roll: 0, scale: 1, hitScale: undefined });
    for (let i = cap - 1; i >= kind.maxFlying; i--) this.freeStuckSlots.push(i);
    world.game.scene.add(this.mesh, this.puffs.points);
  }

  // ── launching ──

  /** loose one: from `origin` (world) with `velocity` (m/s, world — any carrier velocity already added) */
  launch(origin: THREE.Vector3, velocity: THREE.Vector3, opts: ShotOpts): void {
    let f = this.flying.find((x) => !x.active);
    f ??= this.flying.reduce((a, x) => (x.age > a.age ? x : a));
    f.pos.copy(origin); f.origin.copy(origin); f.vel.copy(velocity);
    f.active = true; f.age = 0; f.roll = Math.random() * Math.PI * 2;
    f.scale = opts.damageScale; f.hitScale = opts.onHitScale;
    this.writeFlying(f);
  }

  get inFlight(): number { let n = 0; for (const f of this.flying) if (f.active) n++; return n; }
  get stuckCount(): number { return this.stuck.length; }
  /** world positions of the stuck ones (dev / screenshots) */
  stuckPositions(): THREE.Vector3[] { return this.stuck.map((s) => s.pos.clone()); }
  clearStuck(): void { while (this.stuck.length > 0) this.removeStuck(0); }

  // ── the one integrator (flight and the preview share it) ──

  private step(pos: THREE.Vector3, vel: THREE.Vector3, h: number): void {
    const k = this.kind;
    vel.y -= k.gravity * h;
    if (this.wind !== null && k.windCoupling > 0) {
      this.wind.vecAt(pos.x, pos.z, _wind); _wind.y = 0;
      // sideways only: the part of (wind − v) across the flight direction
      const sp = vel.length();
      if (sp > 1e-3) {
        _side.copy(_wind).sub(vel);
        _side.addScaledVector(vel, -_side.dot(vel) / (sp * sp));
        vel.addScaledVector(_side, k.windCoupling * h);
      }
    }
    vel.multiplyScalar(1 - k.drag * h * vel.length() * 0.1);
    pos.addScaledVector(vel, h);
  }

  /**
   * The drop-arc preview: integrate from `origin` / `velocity` with the flight model (wind included) and write a dot
   * every `spacing` metres of arc into `out` (xyz triples, up to `max` dots). Stops at the terrain, a trunk or a collider
   * (not animals — the preview shows where the arrow goes, not who is in the way). Returns the dot count; `landing` /
   * `landingNormal` get the hit point and the surface's facing (or the last point when it flew past 4 s), `landed` says which.
   */
  readonly landing = new THREE.Vector3(); readonly landingNormal = new THREE.Vector3(0, 1, 0); landed = false;
  predict(origin: THREE.Vector3, velocity: THREE.Vector3, out: Float32Array, max: number, spacing: number, skip = 0): number {
    const pos = _v1.copy(origin), vel = _v2.copy(velocity);
    const h = 1 / 90;
    let n = 0, arc = 0, nextDot = skip, px = pos.x, py = pos.y, pz = pos.z;
    this.landed = false;
    _cp.copy(origin);
    for (let i = 0; i < 360 && n < max; i++) {
      this.step(pos, vel, h);
      if (i % 6 === 5) {
        _chord.subVectors(pos, _cp);
        const len = _chord.length();
        if (len > 1e-4) {
          _chord.multiplyScalar(1 / len);
          const t = this.solidAlong(_cp, _chord, len);
          if (t >= 0) {
            this.landing.copy(_cp).addScaledVector(_chord, t);
            this.landingNormal.copy(_chord).negate();
            this.landed = true;
            const reach = this.landing.distanceToSquared(origin);
            while (n > 0) { // drop the dots written past the hit (up to a chord's worth)
              const j = (n - 1) * 3;
              const dx = (out[j] ?? 0) - origin.x, dy = (out[j + 1] ?? 0) - origin.y, dz = (out[j + 2] ?? 0) - origin.z;
              if (dx * dx + dy * dy + dz * dz <= reach) break;
              n--;
            }
            return n;
          }
        }
        _cp.copy(pos);
      }
      const ground = heightAt(pos.x, pos.z);
      const seg = Math.hypot(pos.x - px, pos.y - py, pos.z - pz);
      if (pos.y < ground) {
        // bisect the last segment onto the ground
        let lo = 0, hi = 1;
        for (let b = 0; b < 5; b++) {
          const mid = (lo + hi) / 2;
          const x = px + (pos.x - px) * mid, y = py + (pos.y - py) * mid, z = pz + (pos.z - pz) * mid;
          if (y < heightAt(x, z)) hi = mid; else lo = mid;
        }
        this.landing.set(px + (pos.x - px) * lo, py + (pos.y - py) * lo, pz + (pos.z - pz) * lo);
        { const nrm = normalAt(this.landing.x, this.landing.z); this.landingNormal.set(nrm[0], nrm[1], nrm[2]); }
        this.landed = true;
        return n;
      }
      arc += seg;
      while (arc >= nextDot && n < max) {
        const back = arc - nextDot, t = seg > 1e-6 ? 1 - back / seg : 1;
        out[n * 3] = px + (pos.x - px) * t; out[n * 3 + 1] = py + (pos.y - py) * t; out[n * 3 + 2] = pz + (pos.z - pz) * t;
        n++; nextDot += spacing * (1 + nextDot / 7); // wider apart with distance, so far dots stay dots on screen
      }
      px = pos.x; py = pos.y; pz = pos.z;
      if (Math.abs(pos.x) > CHUNK_HALF + 80 || Math.abs(pos.z) > CHUNK_HALF + 80) break;
    }
    this.landing.set(px, py, pz); this.landingNormal.set(0, 1, 0);
    return n;
  }

  // ── per frame ──

  update(dt: number): void {
    for (const f of this.flying) {
      if (!f.active) continue;
      f.age += dt;
      const sub = 4, h = dt / sub;
      let stopped = false;
      for (let s = 0; s < sub; s++) {
        const prev = _v1.copy(f.pos);
        this.step(f.pos, f.vel, h);
        if (this.testHit(f, prev)) { stopped = true; break; }
      }
      if (stopped) continue;
      if (Math.abs(f.pos.x) > CHUNK_HALF + 80 || Math.abs(f.pos.z) > CHUNK_HALF + 80 || f.pos.y < -150 || f.age > 12) { this.endFlying(f); continue; }
      f.roll += dt * 9;
      this.writeFlying(f);
    }
    // arrows riding animals follow them; a dead (or harvested) one drops its arrows into the ground beside it
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      const a = s?.animal;
      if (s === undefined || a === null || a === undefined) continue;
      if (!a.alive || hiddenOf(a)) { this.dropToGround(s); continue; }
      const yaw = yawOf(a);
      s.pos.copy(s.local).applyAxisAngle(Y_AXIS, yaw).add(a.position);
      s.dir.copy(s.localDir).applyAxisAngle(Y_AXIS, yaw);
      this.writeStuck(s);
    }
    // walk-over recovery (4× a second is plenty for a walking player)
    if ((++this.recoverFrame & 7) === 0) this.recoverNear();
    if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.dirty = false; }
    this.puffs.update(dt, this.game.renderer, this.game.camera);
  }

  private recoverNear(): void {
    const p = this.player.position;
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      if (s === undefined || s.animal !== null || !s.recoverable) continue;
      // the shaft's middle: tip + dir·(−length/2) (dir points along the flight, into the surface)
      const mx = s.pos.x - s.dir.x * this.kind.length * 0.5, my = s.pos.y - s.dir.y * this.kind.length * 0.5, mz = s.pos.z - s.dir.z * this.kind.length * 0.5;
      if (Math.hypot(mx - p.x, mz - p.z) > RECOVER_R || my - p.y > RECOVER_UP || my - p.y < -1.2) continue;
      if (!this.canRecover()) return;
      this.removeStuck(i);
      this.onRecover?.(Math.random() < this.kind.recover);
    }
  }

  // ── hits ──

  /** segment prev → f.pos vs animals, trunks, colliders, terrain; true when it stopped */
  private testHit(f: Flying, prev: THREE.Vector3): boolean {
    _dir.subVectors(f.pos, prev);
    const segLen = _dir.length();
    if (segLen < 1e-6) return false;
    _dir.multiplyScalar(1 / segLen);

    if (this.targets) {
      const hit = this.targets.raycast(prev, _dir, segLen);
      if (hit) {
        const a = hit.animal;
        const dmg = Math.max(1, Math.round(a.damageFor(hit.headshot, hit.point.distanceTo(f.origin)) * f.scale * (f.hitScale?.(hit) ?? 1)));
        const killed = a.applyDamage(dmg, hit.point, _dir);
        this.onHit?.(a.kind, hit.headshot, killed, hit.point, dmg);
        this.stop(f, hit.point, _dir, 'flesh', a.alive ? a : null, true);
        if (!a.alive) { const s = this.stuck[this.stuck.length - 1]; if (s !== undefined) this.dropToGround(s); } // a kill: into the grass beside it
        return true;
      }
    }
    // tree trunks, yurts, fences, the practice butts
    const ts = this.solidAlong(prev, _dir, segLen);
    if (ts >= 0) {
      _v2.copy(prev).addScaledVector(_dir, ts);
      this.stop(f, _v2, _dir, 'wood', null, true);
      return true;
    }
    // terrain
    if (f.pos.y < heightAt(f.pos.x, f.pos.z)) {
      let lo = 0, hi = 1;
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        _v2.copy(prev).addScaledVector(_dir, segLen * mid);
        if (_v2.y < heightAt(_v2.x, _v2.z)) hi = mid; else lo = mid;
      }
      _v2.copy(prev).addScaledVector(_dir, segLen * lo);
      this.stop(f, _v2, _dir, 'ground', null, true);
      return true;
    }
    return false;
  }

  /** where along prev + dir·[0, len] the segment first meets a tree trunk or an oriented-box collider, or −1. Trunks: the
   *  padded collision radius, then the real bark a little further on (Crossbow.ts does the same). */
  private solidAlong(prev: THREE.Vector3, dir: THREE.Vector3, len: number): number {
    let best = -1;
    const mx = prev.x + dir.x * len * 0.5, mz = prev.z + dir.z * len * 0.5;
    for (const tr of this.forest.nearby(mx, mz, len * 0.5 + 1)) {
      const tf = segmentCylinder(prev, dir, len, tr.x, tr.z, tr.r, tr.y, tr.y + tr.height);
      if (tf < 0) continue;
      const tb = segmentCylinder(prev, dir, len + TRUNK_PAD * 4, tr.x, tr.z, Math.max(0.05, tr.r - TRUNK_PAD), tr.y, tr.y + tr.height);
      const t = tb >= 0 ? tb : tf;
      if (best < 0 || t < best) best = t;
    }
    for (const c of this.player.colliders) {
      if (Math.abs(c.x - mx) > c.hw + c.hd + len * 0.5 + 1 || Math.abs(c.z - mz) > c.hw + c.hd + len * 0.5 + 1) continue;
      const t = segmentBox(prev, dir, len, c.x, c.z, c.hw, c.hd, c.rot, c.yBottom, c.yTop);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
    return best;
  }

  private stop(f: Flying, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, animal: TargetAnimal | null, stick: boolean): void {
    const roll = f.roll;
    this.endFlying(f);
    this.puffs.emit(point, dir, surface);
    this.onImpact?.(surface, point);
    if (!stick) return;
    if (this.stuck.length >= this.kind.maxStuck) this.removeStuck(0);
    const slot = this.freeStuckSlots.pop();
    if (slot === undefined) return;
    const bury = surface === 'flesh' ? this.kind.bury * 2.2 : this.kind.bury;
    const pos = new THREE.Vector3().copy(point).addScaledVector(dir, bury);
    const s: Stuck = { slot, pos, dir: dir.clone(), roll, animal, local: new THREE.Vector3(), localDir: new THREE.Vector3(), recoverable: true };
    if (animal !== null) {
      const yaw = yawOf(animal);
      s.local.copy(pos).sub(animal.position).applyAxisAngle(Y_AXIS, -yaw);
      s.localDir.copy(dir).applyAxisAngle(Y_AXIS, -yaw);
    } else {
      // too high up a trunk / a yurt roof to reach: it stays as a trophy until the cap evicts it
      const midY = pos.y - dir.y * this.kind.length * 0.5;
      s.recoverable = midY - heightAt(pos.x, pos.z) < RECOVER_UP - 0.2;
    }
    this.stuck.push(s);
    this.writeStuck(s);
  }

  /** an arrow from a dead / vanished animal: into the ground where it hung, tilted a little off vertical */
  private dropToGround(s: Stuck): void {
    s.animal = null;
    const g = heightAt(s.pos.x, s.pos.z);
    s.dir.set(s.dir.x * 0.35, -1, s.dir.z * 0.35).normalize();
    s.pos.set(s.pos.x, g, s.pos.z).addScaledVector(s.dir, this.kind.bury * 1.5);
    s.recoverable = true;
    this.writeStuck(s);
  }

  private endFlying(f: Flying): void {
    f.active = false;
    this.mesh.setMatrixAt(f.slot, ZERO_M); this.dirty = true;
  }

  private removeStuck(i: number): void {
    const s = this.stuck.splice(i, 1)[0];
    if (s === undefined) return;
    this.mesh.setMatrixAt(s.slot, ZERO_M); this.dirty = true;
    this.freeStuckSlots.push(s.slot);
  }

  private writeFlying(f: Flying): void {
    _dir.copy(f.vel).normalize();
    _q.setFromUnitVectors(NEG_Z, _dir).multiply(_q2.setFromAxisAngle(POS_Z, f.roll));
    _m.compose(f.pos, _q, _s);
    this.mesh.setMatrixAt(f.slot, _m); this.dirty = true;
  }

  private writeStuck(s: Stuck): void {
    _q.setFromUnitVectors(NEG_Z, s.dir).multiply(_q2.setFromAxisAngle(POS_Z, s.roll));
    _m.compose(s.pos, _q, _s);
    this.mesh.setMatrixAt(s.slot, _m); this.dirty = true;
  }
}

/** distance along the segment where it enters a cylinder whose radius tapers to 20 % at yTop, or −1 (Crossbow.ts's test) */
function segmentCylinder(o: THREE.Vector3, d: THREE.Vector3, len: number, cx: number, cz: number, r: number, yBot: number, yTop: number): number {
  const ox = o.x - cx, oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return -1;
  const bq = 2 * (ox * d.x + oz * d.z);
  let rr = r;
  for (let pass = 0; pass < 2; pass++) {
    const c = ox * ox + oz * oz - rr * rr;
    const disc = bq * bq - 4 * a * c;
    if (disc < 0) return -1;
    const t = (-bq - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > len) return -1;
    const y = o.y + d.y * t;
    if (y < yBot || y > yTop) return -1;
    if (pass === 1) return t;
    rr = r * (1 - 0.8 * Math.min(1, Math.max(0, (y - yBot) / (yTop - yBot))));
  }
  return -1;
}

/** slab test of the segment against an oriented box (Player.ts's collider: centre, half sizes, rotation about Y, y range); t or −1 */
function segmentBox(o: THREE.Vector3, d: THREE.Vector3, len: number, cx: number, cz: number, hw: number, hd: number, rot: number, yBot: number, yTop: number): number {
  // into the box frame (Player.ts: local = R(−rot)·(p − c))
  const cos = Math.cos(-rot), sin = Math.sin(-rot);
  const px = o.x - cx, pz = o.z - cz;
  const lx = px * cos - pz * sin, lz = px * sin + pz * cos;
  const dx = d.x * cos - d.z * sin, dz = d.x * sin + d.z * cos;
  let t0 = 0, t1 = len;
  const slab = (p: number, v: number, lo: number, hi: number): boolean => {
    if (Math.abs(v) < 1e-9) return p >= lo && p <= hi;
    let a = (lo - p) / v, b = (hi - p) / v;
    if (a > b) { const t = a; a = b; b = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  if (!slab(lx, dx, -hw, hw) || !slab(lz, dz, -hd, hd) || !slab(o.y, d.y, yBot, yTop)) return -1;
  return t0;
}
