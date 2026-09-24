import * as THREE from 'three';
import type { Game } from '../core/Game';
import type { Sky } from '../world/Sky';
import type { Player } from './Player';
import type { Forest } from '../world/Forest';
import { heightAt } from '../world/Heightfield';
import { CHUNK_HALF } from '../core/config';
import { Puffs, impactSurfaceOf, worldHit, type ImpactSurface, type TargetAnimal, type TargetHit, type Targets } from './Crossbow';
import { floorBelow, sticksIn } from '../physics/query';
import { activePhysics } from '../physics/active';

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
 *   arrows.predict(origin, velocity, pts, 64, 1.4)       // the drop-arc preview: the SAME integrator + the same world query
 *   arrows.onHit / onImpact / onRecover                  // hooks
 *   arrows.canRecover = () => quiver < max;              // walk-over pickup of stuck ones (only while it says yes)
 *
 * Flight (per kind): gravity, quadratic-ish drag (`v *= 1 − drag·h·|v|·0.1`, the crossbow's form), and a wind
 * coupling that pushes the projectile SIDEWAYS toward the wind: a = coupling × (wind − v)⊥v̂ (combat.md: 0.25 /s for
 * arrows → 0.75 m drift at 60 m in a 6 m/s breeze). Four substeps a frame; each substep sweeps a small ball through the
 * physics world (NALATI-MERGE P2: `worldHit` — src/physics/query.ts's sweepBall, the crossbow's call: terrain, trunks,
 * rocks, yurts, fences, decks, every registered piece) and asks the animals (`targets.raycast`) short of that wall. By
 * the wall's material it sticks (wood, planks, felt, earth, ground, grass) or glances off (stone, rock, metal): a short
 * skip with most of its speed gone, then it lies where it lands.
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
  /** false = it never sticks (a ghost arrow comes apart on impact) — default true */
  stick?: boolean;
  /** false = it flies through animals (an enemy's arrow) — default true */
  hitsAnimals?: boolean;
  /** false = no impact dust puff (the owner draws its own) — default true */
  puffs?: boolean;
  /** an ENEMY projectile: it hits the player's body (a vertical capsule from the feet, this radius / height) and calls
   *  `onPlayerHit` — the ghost riders' arrows (src/nalati/ghostRiders.ts) */
  hurtsPlayer?: { radius: number; height: number };
  /** the ball swept through the world each substep (m; default 0.02 — a broadhead) */
  radius?: number;
}

export interface ProjectileWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface ShotOpts {
  /** × the animal's own `damageFor(headshot, distance)` (the crossbow's 32–40 body model) */
  damageScale: number;
  /** optional extra multiplier decided at the hit (the sneak shot from HIDDEN, a Parthian stagger …) */
  onHitScale?: ((hit: TargetHit) => number) | undefined;
}

interface Flying { slot: number; pos: THREE.Vector3; vel: THREE.Vector3; origin: THREE.Vector3; active: boolean; age: number; roll: number; scale: number; hitScale: ((hit: TargetHit) => number) | undefined; /** it has glanced off stone: the next surface it meets, it lies on */ glanced: boolean }
interface Stuck {
  slot: number; pos: THREE.Vector3; dir: THREE.Vector3; roll: number;
  /** riding a live animal: offset + direction in its yaw frame */
  animal: TargetAnimal | null; local: THREE.Vector3; localDir: THREE.Vector3;
  /** reachable from the ground (not 4 m up a trunk) */
  recoverable: boolean;
}

/** the ball an arrow sweeps through the world (the broadhead) */
const ARROW_RADIUS = 0.02;
/** a glance (Crossbow.ts's numbers): lift off the surface, the speed kept along it, the bounce off it, the most it keeps */
const GLANCE_LIFT = 0.03, GLANCE_KEEP = 0.35, GLANCE_BOUNCE = 0.25, GLANCE_MAX = 9;
const RECOVER_R = 1.25; // m, horizontal reach from the feet
const RECOVER_UP = 2.1; // m, highest point of a stuck arrow's midpoint the player can pull out
const NEG_Z = new THREE.Vector3(0, 0, -1), POS_Z = new THREE.Vector3(0, 0, 1), Y_AXIS = new THREE.Vector3(0, 1, 0), X_AXIS = new THREE.Vector3(1, 0, 0);
const _cp = new THREE.Vector3(), _chord = new THREE.Vector3();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3(), _wind = new THREE.Vector3(), _side = new THREE.Vector3(), _nrm = new THREE.Vector3();
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
  /** an enemy projectile (`kind.hurtsPlayer`) struck the player at `point`, flying along `dir` */
  onPlayerHit?: ((point: THREE.Vector3, dir: THREE.Vector3) => void) | undefined;
  /** the pickup only happens while this says yes (quiver not full) */
  canRecover: () => boolean = () => true;
  readonly mesh: THREE.InstancedMesh;

  private readonly kind: ProjectileKind;
  private readonly game: Game; private readonly player: Player;
  private readonly targets: Targets | undefined;
  private readonly flying: Flying[] = [];
  private readonly stuck: Stuck[] = [];
  private readonly freeStuckSlots: number[] = [];
  private readonly puffs = new Puffs();
  private recoverFrame = 0;
  private dirty = false;

  constructor(world: ProjectileWorld, targets: Targets | undefined, kind: ProjectileKind) {
    this.game = world.game; this.player = world.player;
    this.targets = targets; this.kind = kind;
    const cap = kind.maxFlying + kind.maxStuck;
    this.mesh = new THREE.InstancedMesh(kind.geometry, kind.material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.name = 'projectiles';
    for (let i = 0; i < cap; i++) this.mesh.setMatrixAt(i, ZERO_M);
    for (let i = 0; i < kind.maxFlying; i++) this.flying.push({ slot: i, pos: new THREE.Vector3(), vel: new THREE.Vector3(), origin: new THREE.Vector3(), active: false, age: 0, roll: 0, scale: 1, hitScale: undefined, glanced: false });
    for (let i = cap - 1; i >= kind.maxFlying; i--) this.freeStuckSlots.push(i);
    world.game.scene.add(this.mesh, this.puffs.points);
  }

  // ── launching ──

  /** loose one: from `origin` (world) with `velocity` (m/s, world — any carrier velocity already added) */
  launch(origin: THREE.Vector3, velocity: THREE.Vector3, opts: ShotOpts): void {
    let f = this.flying.find((x) => !x.active);
    f ??= this.flying.reduce((a, x) => (x.age > a.age ? x : a));
    f.pos.copy(origin); f.origin.copy(origin); f.vel.copy(velocity);
    f.active = true; f.age = 0; f.roll = Math.random() * Math.PI * 2; f.glanced = false;
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
        // every 6 steps, the chord since the last test through the physics world (terrain, trunks, every piece)
        const wall = worldHit(_cp, pos, 0);
        if (wall) {
          this.landing.set(wall.point.x, wall.point.y, wall.point.z);
          this.landingNormal.set(wall.normal.x, wall.normal.y, wall.normal.z);
          if (this.landingNormal.dot(_chord.subVectors(pos, _cp)) > 0) this.landingNormal.negate();
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
        _cp.copy(pos);
      }
      const seg = Math.hypot(pos.x - px, pos.y - py, pos.z - pz);
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

    const hp = this.kind.hurtsPlayer;
    if (hp !== undefined) {
      const t = segmentCapsule(prev, _dir, segLen, this.player.position, hp.radius, hp.height);
      if (t >= 0) {
        _v2.copy(prev).addScaledVector(_dir, t);
        this.onPlayerHit?.(_v2, _dir);
        this.stop(f, _v2, _dir, 'flesh', null, false);
        return true;
      }
    }
    const r = this.kind.radius ?? ARROW_RADIUS;
    const wall = worldHit(prev, f.pos, r);
    if (this.targets && this.kind.hitsAnimals !== false) {
      const hit = this.targets.raycast(prev, _dir, wall ? wall.distance : segLen);   // an animal short of the wall
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
    if (!wall) return false;
    const n = _nrm.set(wall.normal.x, wall.normal.y, wall.normal.z);
    if (n.dot(_dir) > 0) n.negate(); // facing the arrow
    const at = _v2.set(wall.point.x, wall.point.y, wall.point.z); // the ball's centre, touching the surface
    const surface = impactSurfaceOf(wall.material);
    if (f.glanced) { this.rest(f, at, n); return true; } // a spent arrow lies where it lands
    if (sticksIn(wall.material)) {
      // the ball touches one radius off the surface: the tip carries on along the flight to it
      at.addScaledVector(_dir, r / Math.max(0.25, -n.dot(_dir)));
      this.stop(f, at, _dir, surface, null, true);
      return true;
    }
    // glance (stone, rock, metal): off the surface with little of the speed left, then gravity has it
    if (this.kind.puffs !== false) this.puffs.emit(at, _dir, surface);
    this.onImpact?.(surface, at);
    if (this.kind.stick === false) { this.endFlying(f); return true; }
    at.addScaledVector(n, GLANCE_LIFT);
    const vn = f.vel.dot(n);
    f.vel.addScaledVector(n, -vn).multiplyScalar(GLANCE_KEEP).addScaledVector(n, -vn * GLANCE_BOUNCE);
    if (f.vel.length() > GLANCE_MAX) f.vel.setLength(GLANCE_MAX);
    f.pos.copy(at);
    f.glanced = true;
    return false;
  }

  /** a spent (glanced) arrow comes to rest lying on what it fell onto: along its travel, flat to the surface */
  private rest(f: Flying, at: THREE.Vector3, n: THREE.Vector3): void {
    const along = _v1.copy(_dir).addScaledVector(n, -_dir.dot(n));
    if (along.lengthSq() < 1e-6) along.crossVectors(n, Math.abs(n.y) < 0.9 ? Y_AXIS : X_AXIS);
    along.normalize();
    // the tip half a shaft ahead of the contact, so the shaft lies across it
    at.addScaledVector(n, -(this.kind.radius ?? ARROW_RADIUS) * 0.8).addScaledVector(along, this.kind.length * 0.5);
    this.endFlying(f);
    if (this.stuck.length >= this.kind.maxStuck) this.removeStuck(0);
    const slot = this.freeStuckSlots.pop();
    if (slot === undefined) return;
    const s: Stuck = { slot, pos: at.clone(), dir: along.clone(), roll: f.roll, animal: null, local: new THREE.Vector3(), localDir: new THREE.Vector3(), recoverable: true };
    this.stuck.push(s);
    this.writeStuck(s);
  }

  private stop(f: Flying, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, animal: TargetAnimal | null, stick: boolean): void {
    const roll = f.roll;
    this.endFlying(f);
    if (this.kind.puffs !== false) this.puffs.emit(point, dir, surface);
    this.onImpact?.(surface, point);
    if (!stick || this.kind.stick === false) return;
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
      s.recoverable = midY - floorUnder(pos.x, midY, pos.z) < RECOVER_UP - 0.2;
    }
    this.stuck.push(s);
    this.writeStuck(s);
  }

  /** an arrow from a dead / vanished animal: into the ground where it hung, tilted a little off vertical */
  private dropToGround(s: Stuck): void {
    s.animal = null;
    const g = floorUnder(s.pos.x, s.pos.y, s.pos.z);   // the ground, a deck, a rock — whatever it hangs over
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

/** the top of the world under (x, z) from just above y (terrain, a deck, a rock); the terrain when there is no physics */
function floorUnder(x: number, y: number, z: number): number {
  const ph = activePhysics();
  return (ph ? floorBelow(ph, x, z, y + 0.3, 60) : undefined) ?? heightAt(x, z);
}

/** where along o + d·[0, len] the segment first comes within `r` of the vertical axis from `feet` to `feet + h`, or −1 */
function segmentCapsule(o: THREE.Vector3, d: THREE.Vector3, len: number, feet: THREE.Vector3, r: number, h: number): number {
  // horizontal: solve |(o + d t − feet)_xz| = r; then check the height at that t (the caps are ignored: a body, not a pill)
  const ox = o.x - feet.x, oz = o.z - feet.z;
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-8) return -1;
  const b = 2 * (ox * d.x + oz * d.z), c = ox * ox + oz * oz - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc);
  let t = (-b - sq) / (2 * a);
  if (t < 0) t = c < 0 ? 0 : -1;                       // starts inside the body's circle
  if (t < 0 || t > len) return -1;
  const y = o.y + d.y * t - feet.y;
  return y >= 0 && y <= h ? t : -1;
}
