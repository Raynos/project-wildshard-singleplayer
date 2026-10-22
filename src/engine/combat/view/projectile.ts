import * as THREE from 'three';
import { RangedTrace, type RangedTraceRow } from '../../render/viewmodelFeel';
import type { Game } from '../../core/Game';
import type { SkyRig as Sky } from '../../world/skyRig';
import type { Player } from '../../player/Player';
import type { Forest } from '../../world/forest/Forest';
import { terrainHeight as heightAt } from '../../world/terrainHeight';
import { CHUNK_HALF } from '../../core/config';
import { Puffs, impactSurfaceOf, worldHit } from './ranged';
import type { ImpactSurface } from '../Weapon';
import type { TargetAnimal, TargetHit, Targets } from '../types';
import { floorBelow } from '../../physics/query';
import { app, gameplayRandom } from '../../app/runtime';
import { projectileFlightStep, ProjectileSlots, type FlightSlot } from '../projectileFlight';
import { ProjectileContact, StoppedProjectileSlots, type StoppedProjectile } from '../projectileContact';



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
  /** Authored integration subdivisions and lifetime; omitted retains four steps and twelve seconds. */
  substeps?: number; lifetime?: number;
  /** stuck ones kept (oldest evicted) */
  maxStuck: number;
  /** false = it never sticks (a ghost arrow comes apart on impact) — default true */
  stick?: boolean;
  /** false = it flies through animals (an enemy's arrow) — default true */
  hitsAnimals?: boolean;
  /** false = no impact dust puff (the owner draws its own) — default true */
  puffs?: boolean;
  
  hurtsPlayer?: { radius: number; height: number };
  /** the ball swept through the world each substep (m; default 0.02 — a broadhead) */
  radius?: number;
}

export interface ProjectileWorld { game: Game; sky: Sky; player: Player; forest: Forest }
export interface ShotOpts {
  
  damageScale: number;
  /** optional extra multiplier decided at the hit (the sneak shot from HIDDEN, a Parthian stagger …) */
  onHitScale?: ((hit: TargetHit) => number) | undefined;
}

interface FlyingData { slot: number; origin: THREE.Vector3; roll: number; scale: number; hitScale: ((hit: TargetHit) => number) | undefined }
type Flying = FlightSlot<FlyingData>;

type Stuck = StoppedProjectile<{ slot: number; roll: number }, TargetAnimal>;

/** the ball an arrow sweeps through the world (the broadhead) */
const ARROW_RADIUS = 0.02;

const GLANCE_LIFT = 0.03, GLANCE_KEEP = 0.35, GLANCE_BOUNCE = 0.25, GLANCE_MAX = 9;
const RECOVER_R = 1.25; // m, horizontal reach from the feet
const RECOVER_UP = 2.1; // m, highest point of a stuck arrow's midpoint the player can pull out
const RECOVER_REACH = { radius: RECOVER_R, up: RECOVER_UP, down: 1.2 };
const GLANCE = { lift: GLANCE_LIFT, keep: GLANCE_KEEP, bounce: GLANCE_BOUNCE, maxSpeed: GLANCE_MAX };
const NEG_Z = new THREE.Vector3(0, 0, -1), POS_Z = new THREE.Vector3(0, 0, 1);
const _cp = new THREE.Vector3(), _chord = new THREE.Vector3();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _dir = new THREE.Vector3(), _wind = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3(1, 1, 1);
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

export class Projectiles {
  wind: WindField | null = null;
  onTargetHit?: ((hit: TargetHit) => void) | undefined;
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
  private readonly pool: ProjectileSlots<FlyingData>;
  private get flying(): Flying[] { return this.pool.slots; }
  private readonly stopped: StoppedProjectileSlots<{ slot: number; roll: number }, TargetAnimal>;
  private get stuck(): Stuck[] { return this.stopped.slots; }
  private readonly puffs = new Puffs();
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
    this.pool = new ProjectileSlots<FlyingData>(kind.maxFlying, slot => ({ slot, origin: new THREE.Vector3(), roll: 0, scale: 1, hitScale: undefined }), {
      substeps: kind.substeps ?? 4, extent: CHUNK_HALF + 80, floor: -150, lifetime: kind.lifetime ?? 12,
      integrate: (slot, h) => { this.step(slot.pos, slot.vel, h); }, contact: (slot, previous) => this.testHit(slot, previous),
      expired: slot => { this.endFlying(slot); }, moved: (slot, dt) => { slot.roll += dt * 9; this.writeFlying(slot); },
    });
    this.stopped = new StoppedProjectileSlots({ capacity: kind.maxStuck, length: kind.length, bury: kind.bury,
      radius: kind.radius ?? ARROW_RADIUS, reach: RECOVER_REACH, recover: kind.recover, recoveryStride: 8 }, {
      feet: this.player.position, floorAt: floorUnder,
      body: animal => animal,
      attachment: (animal, point) => animal.stuckFrame?.(point) ?? null,
      canRecover: () => this.canRecover(), recover: survived => this.onRecover?.(survived), random: gameplayRandom,
      changed: slot => this.writeStuck(slot), removed: slot => { this.mesh.setMatrixAt(slot.data.slot, ZERO_M); this.dirty = true; },
    }, index => ({ slot: cap - 1 - index, roll: 0 }));
    world.game.scene.add(this.mesh, this.puffs.points);
  }

  // ── launching ──

  /** loose one: from `origin` (world) with `velocity` (m/s, world — any carrier velocity already added) */
  launch(origin: THREE.Vector3, velocity: THREE.Vector3, opts: ShotOpts): void {
    const f = this.pool.take();
    f.pos.copy(origin); f.origin.copy(origin); f.vel.copy(velocity);
    f.roll = app.rng.stream('cosmetic').next() * Math.PI * 2;
    f.scale = opts.damageScale; f.hitScale = opts.onHitScale;
    this.writeFlying(f);
  }

  get inFlight(): number { let n = 0; for (const f of this.flying) if (f.active) n++; return n; }
  get stuckCount(): number { return this.stuck.length; }
  /** world positions of the stuck ones (dev / screenshots) */
  stuckPositions(): THREE.Vector3[] { return this.stuck.map((s) => s.position.clone()); }
  clearStuck(): void { this.stopped.clear(); }

  // ── the one integrator (flight and the preview share it) ──

  private step(pos: THREE.Vector3, vel: THREE.Vector3, h: number): void {
    const k = this.kind;
    const wind = this.wind !== null && k.windCoupling > 0 ? this.wind.vecAt(pos.x, pos.z, _wind) : null;
    projectileFlightStep(pos, vel, h, k, wind);
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
    this.pool.step(dt);
    this.stopped.update();
    if (this.dirty) { this.mesh.instanceMatrix.needsUpdate = true; this.dirty = false; }
    this.puffs.update(dt, this.game.renderer, this.game.camera);
  }

  // ── hits ──

  /** segment prev → f.pos vs animals, trunks, colliders, terrain; true when it stopped */
  private readonly contacts = new ProjectileContact<Flying>({ glance: GLANCE, spentRest: 'any', impactAfterLift: false, impactOnRepeatedGlance: true }, {
    beforeWorld: (flight, from, direction, length) => {
      const hp = this.kind.hurtsPlayer;
      if (hp === undefined) return false;
      const t = segmentCapsule(from, direction, length, this.player.position, hp.radius, hp.height);
      if (!(t >= 0)) return false;
      _v2.copy(from).addScaledVector(direction, t); this.onPlayerHit?.(_v2, direction);
      this.stop(flight, _v2, direction, 'flesh', null, false); return true;
    },
    world: worldHit,
    target: (from, direction, distance) => this.kind.hitsAnimals !== false ? this.targets?.raycast(from, direction, distance) ?? null : null,
    hit: (flight, hit, direction) => {
      this.onTargetHit?.(hit);
      const animal = hit.animal;
      const damage = Math.max(1, Math.round(animal.damageFor(hit.headshot, hit.point.distanceTo(flight.origin)) * flight.scale * (flight.hitScale?.(hit) ?? 1)));
      const killed = animal.applyDamage(damage, hit.point, direction);
      this.onHit?.(animal.kind, hit.headshot, killed, hit.point, damage);
      this.stop(flight, hit.point, direction, 'flesh', animal.alive ? animal : null, true);
      if (!animal.alive) this.stopped.dropLast();
    },
    stop: (flight, at, direction, wall) => { this.stop(flight, at, direction, impactSurfaceOf(wall.material), null, true); },
    rest: (flight, at, direction) => { this.endFlying(flight); this.stopped.settle(at, direction, slot => { slot.data.roll = flight.roll; }); },
    impact: (at, direction, wall) => { const surface = impactSurfaceOf(wall.material); if (this.kind.puffs !== false) this.puffs.emit(at, direction, surface); this.onImpact?.(surface, at); },
    expire: flight => { this.endFlying(flight); },
  });
  private testHit(flight: Flying, from: THREE.Vector3): boolean { return this.contacts.step(flight, from, this.kind.radius ?? ARROW_RADIUS, this.kind.length, this.kind.stick !== false); }

  private stop(f: Flying, point: THREE.Vector3, dir: THREE.Vector3, surface: ImpactSurface, animal: TargetAnimal | null, stick: boolean): void {
    const roll = f.roll;
    this.endFlying(f);
    if (this.kind.puffs !== false) this.puffs.emit(point, dir, surface);
    this.onImpact?.(surface, point);
    if (!stick || this.kind.stick === false) return;
    this.stopped.stop(point, dir, surface === 'flesh', animal, slot => { slot.data.roll = roll; });
  }

  private endFlying(f: Flying): void {
    f.active = false;
    this.mesh.setMatrixAt(f.slot, ZERO_M); this.dirty = true;
  }

  private writeFlying(f: Flying): void {
    _dir.copy(f.vel).normalize();
    _q.setFromUnitVectors(NEG_Z, _dir).multiply(_q2.setFromAxisAngle(POS_Z, f.roll));
    _m.compose(f.pos, _q, _s);
    this.mesh.setMatrixAt(f.slot, _m); this.dirty = true;
  }

  private writeStuck(s: Stuck): void {
    _q.setFromUnitVectors(NEG_Z, s.direction).multiply(_q2.setFromAxisAngle(POS_Z, s.data.roll));
    _m.compose(s.position, _q, _s);
    this.mesh.setMatrixAt(s.data.slot, _m); this.dirty = true;
  }
}

/** the top of the world under (x, z) from just above y (terrain, a deck, a rock); the terrain when there is no physics */
function floorUnder(x: number, y: number, z: number): number {
  const ph = app.physics;
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

/** Bounded drawn-projectile continuation. Flight/contact clocks and damage remain caller-owned.
 * Geometry/materials are borrowed. Solved stopped poses use StoppedProjectileSlots solely as a retained FIFO;
 * recovery is never stepped here. A borrowed publish port can retain an existing instanced writer.
 */
export class ProjectilePresentation {
  readonly traces: RangedTrace[] = [];
  readonly paint = (trace: RangedTrace, time: number, camera: THREE.PerspectiveCamera, resolution: THREE.Vector2): void => { trace.publish(time, camera, resolution); };
  private readonly stopped: StoppedProjectileSlots<{ mesh: THREE.Object3D | null; index: number }, never>[] = [];
  private stopCursor = 0;
  private readonly axis: THREE.Vector3;
  private readonly rotation = new THREE.Quaternion(); private readonly spin = new THREE.Quaternion();
  private readonly direction = new THREE.Vector3(); private readonly at = new THREE.Vector3();
  private made = 0;
  private readonly scene: THREE.Scene; private readonly geometry: THREE.BufferGeometry; private readonly material: THREE.Material;
  private readonly row: ConstructorParameters<typeof ProjectilePresentation>[3];
  private readonly glow: ConstructorParameters<typeof ProjectilePresentation>[4];
  private readonly flights: ConstructorParameters<typeof ProjectilePresentation>[5];
  private readonly writer: ConstructorParameters<typeof ProjectilePresentation>[6];
  constructor(scene: THREE.Scene, geometry: THREE.BufferGeometry, material: THREE.Material,
    row: { readonly flying: number; readonly stopped: number; readonly axis: readonly [number, number, number]; readonly spin: number; readonly tip: number; readonly nock: number; readonly trace: RangedTraceRow; readonly traceCount: number; readonly markerScale: number; readonly order: number },
    glow: { readonly material: THREE.MeshBasicMaterial; readonly flight: THREE.BufferGeometry; readonly stuck: THREE.BufferGeometry; readonly impact: THREE.BufferGeometry; readonly ring: THREE.BufferGeometry },
    flights: () => readonly { tracer: RangedTrace | null }[],
    writer?: { readonly publish: (object: THREE.Object3D, index: number, phase: 'flying' | 'stopped') => void; readonly retire: (index: number) => void }) {
    this.scene = scene; this.geometry = geometry; this.material = material; this.row = row; this.glow = glow; this.flights = flights; this.writer = writer;
    if (!Number.isInteger(row.flying) || row.flying < 1 || row.flying > 1024 || !Number.isInteger(row.traceCount) || row.traceCount < 1 || row.traceCount > 128
      || !Number.isInteger(row.stopped) || row.stopped < 1 || row.stopped > 1024
      || ![row.spin, row.tip, row.nock, row.markerScale, row.order, ...row.axis].every(Number.isFinite)) throw new RangeError('Invalid projectile presentation row');
    this.axis = new THREE.Vector3(...row.axis); if (Math.abs(this.axis.lengthSq() - 1) > 1e-6) throw new RangeError('Projectile axis must be a unit vector');
    // Each retained page keeps the existing 128-slot cap; one cursor preserves FIFO across the full declared roster.
    for (let offset = 0; offset < row.stopped; offset += 128) {
    this.stopped.push(new StoppedProjectileSlots<{ mesh: THREE.Object3D | null; index: number }, never>({ capacity: Math.min(128, row.stopped - offset), length: 0, bury: 0, radius: 0, reach: { radius: 0, up: 0, down: 0 }, recover: 0, recoveryStride: 1 }, {
      feet: new THREE.Vector3(), floorAt: () => 0, body: () => undefined, canRecover: () => false, recover: () => undefined, random: () => { throw new Error('Display roster has no recovery RNG'); },
      removed: slot => { slot.data.mesh?.removeFromParent(); this.writer?.retire(slot.data.index); slot.data.mesh = null; },
    }, index => ({ mesh: null, index: row.flying + offset + index })));
    }
  }
  /** Each call is the data factory of the existing bounded ProjectileSlots owner. */
  flight(): { mesh: THREE.Object3D; glow: THREE.Mesh; roll: number; traced: boolean; tracer: RangedTrace | null; viewIndex: number } {
    if (this.made >= this.row.flying) throw new RangeError('Projectile draw roster exceeded');
    const mesh = this.writer === undefined ? new THREE.Mesh(this.geometry, this.material) : new THREE.Object3D();
    mesh.visible = false; mesh.castShadow = true; mesh.frustumCulled = false;
    const glow = new THREE.Mesh(this.glow.flight, this.glow.material); glow.renderOrder = this.row.order; glow.position.set(0, 0, this.row.tip + .05); glow.visible = false; mesh.add(glow);
    if (this.writer === undefined) this.scene.add(mesh);
    return { mesh, glow, roll: 0, traced: false, tracer: null, viewIndex: this.made++ };
  }
  /** Preserve the caller's original allocation phase, after its flight meshes. */
  prepareTraces(): void {
    if (this.traces.length > 0) throw new Error('Projectile traces already prepared');
    this.traces.push(...RangedTrace.roster(this.scene, this.row.trace, this.row.traceCount, () => {
      const material = this.glow.material.clone(), group = new THREE.Group();
      const ball = new THREE.Mesh(this.glow.impact, material), ring = new THREE.Mesh(this.glow.ring, material);
      ball.renderOrder = this.row.order; ring.renderOrder = this.row.order; group.add(ball, ring); return { group, ring, material };
    }));
  }
  launch(slot: ReturnType<ProjectilePresentation['flight']>, position: THREE.Vector3, direction: THREE.Vector3, material: THREE.Material, traced: boolean, time: number): void {
    if (slot.mesh instanceof THREE.Mesh) slot.mesh.material = material;
    slot.mesh.visible = true; slot.mesh.position.copy(position); slot.mesh.quaternion.setFromUnitVectors(this.axis, direction);
    if (slot.tracer !== null) slot.tracer.finish(position, time);
    slot.traced = traced; slot.tracer = traced ? this.takeTrace() : null; slot.tracer?.begin(position); slot.glow.visible = traced;
    this.writer?.publish(slot.mesh, slot.viewIndex, 'flying');
  }
  move(slot: ReturnType<ProjectilePresentation['flight']>, position: THREE.Vector3, velocity: THREE.Vector3, dt: number, camera: THREE.PerspectiveCamera): void {
    slot.mesh.position.copy(position); this.direction.copy(velocity).normalize(); slot.roll += dt * this.row.spin;
    slot.mesh.quaternion.setFromUnitVectors(this.axis, this.direction).multiply(this.spin.setFromAxisAngle(this.axis, slot.roll));
    if (slot.traced) slot.glow.scale.setScalar(Math.max(1, this.row.markerScale * position.distanceTo(camera.position)));
    this.writer?.publish(slot.mesh, slot.viewIndex, 'flying');
  }
  finishTrace(slot: { tracer: RangedTrace | null }, point: THREE.Vector3, time: number): void { slot.tracer?.finish(point, time); slot.tracer = null; }
  stick(point: THREE.Vector3, direction: THREE.Vector3, roll: number, material: THREE.Material, traced: boolean, bury: number, parent: THREE.Object3D | null): void {
    const mesh = this.writer === undefined ? new THREE.Mesh(this.geometry, material) : new THREE.Object3D(); mesh.castShadow = true;
    mesh.position.copy(point).addScaledVector(direction, bury + this.row.tip);
    mesh.quaternion.setFromUnitVectors(this.axis, direction).multiply(this.rotation.setFromAxisAngle(this.axis, roll));
    if (traced) { const dot = new THREE.Mesh(this.glow.stuck, this.glow.material); dot.renderOrder = this.row.order; dot.position.set(0, 0, this.row.nock); mesh.add(dot); }
    this.at.copy(mesh.position);
    const page = this.stopped[Math.floor(this.stopCursor / 128)]; if (page === undefined) throw new Error('Missing stopped presentation page');
    this.stopCursor = (this.stopCursor + 1) % this.row.stopped;
    page.settle(this.at, direction, slot => {
      slot.data.mesh = mesh; if (this.writer === undefined) { this.scene.add(mesh); parent?.attach(mesh); }
      else this.writer.publish(mesh, slot.data.index, 'stopped');
    });
  }
  static movingFrame(owner: unknown): THREE.Object3D | null {
    if (typeof owner !== 'object' || owner === null || !('follows' in owner)) return null;
    return owner.follows instanceof THREE.Object3D ? owner.follows : null;
  }
  private takeTrace(): RangedTrace | null {
    let best: RangedTrace | null = null;
    for (const trace of this.traces) { if (!trace.active) return trace; if (trace.endTime >= 0 && (best === null || trace.endTime < best.endTime)) best = trace; }
    best ??= this.traces[0] ?? null;
    for (const slot of this.flights()) if (slot.tracer === best) slot.tracer = null;
    return best;
  }
}
