/**
 * Items as bodies (PHYSICS.md P7): the small dynamic-body service. Coconuts, the puzzle barrel and whatever else
 * lies about and gets knocked around is a Rapier dynamic body spawned here, with a shape, a material and an owner
 * (queries and plates read the owner back through `tagOf`).
 *
 *   const b = activeBodies()?.spawn({ shape: { ball: 0.13 }, material: 'wood', owner: this, expendable: true }, from, vel);
 *   b.pose(bodies.alpha, pos, quat);        // the render pose, interpolated between the last two fixed steps
 *   bodies.remove(b);
 *
 * The service runs in `Game`'s fixed phases (`attach(game)`, wired in bootstrap next to `setActivePhysics`): `pre`
 * keeps each body's last pose (for interpolation) and applies the water's lift to floating things; the world steps;
 * `post` reads the new poses, each body's `impact` (a landing / a knock) and enforces the per-tier cap on AWAKE
 * dynamic bodies (the plan's budget: phone ≤ 40, desktop ≤ 150). Past the cap the body farthest from the player goes
 * first (the older one on a tie): an `expendable` one is removed (its `onRemoved` fires), any other is put to sleep —
 * it wakes again when something touches it. `keep` bodies (the puzzle barrel) are never culled.
 *
 * Sleeping is Rapier's own: a body at rest sleeps and costs nothing until it is touched. Water is not a fluid
 * (§Architecture): a body with `float` gets an upward force per step from how deep it sits under the surface its
 * owner describes (still level + the swell), and a drag while wet.
 */
import type { Collider, Cuboid, RigidBody } from '@dimforge/rapier3d-simd';
import type { Physics } from './Physics';
import { groups, queryGroups, type GroupName } from './groups';
import { tagCollider, tagOf, untagCollider, type Material } from './surface';
import { TIER } from '../core/tier';
import { floorBelow } from './query';

interface Vec3 { x: number; y: number; z: number }
interface Quat { x: number; y: number; z: number; w: number }

export type BodyShape =
  | { ball: number }
  | { cylinder: { radius: number; halfHeight: number } }
  | { cuboid: Vec3 };

export interface FloatSpec {
  /** the water surface's height at (x, z) now, or undefined where there is no water (dry land, off the sea) */
  surface: (x: number, z: number) => number | undefined;
  /** lift when fully under, in multiples of the body's weight (> 1 floats) */
  buoyancy: number;
  /** extra linear drag while wet (1/s) */
  drag: number;
}

export interface BodySpec {
  shape: BodyShape;
  material: Material;
  owner: unknown;
  /** ITEM (default: the player pushes it, plates feel it) or DEBRIS (the world only) */
  group?: 'ITEM' | 'DEBRIS';
  /** kg/m³ (default 500) */
  density?: number;
  friction?: number;
  restitution?: number;
  linearDamping?: number;
  angularDamping?: number;
  /** rolling resistance (0‥1, like a tyre's): a round body stops rolling on slopes gentler than atan(this) and slows
   *  on the flat — Rapier has none, so a ball or a barrel on its side would otherwise roll forever (sand ~0.1) */
  rolling?: number;
  /** continuous collision (fast, small things: a thrown coconut) */
  ccd?: boolean;
  /** never culled by the cap */
  keep?: boolean;
  /** over the cap it is removed, not put to sleep */
  expendable?: boolean;
  float?: FloatSpec;
  onRemoved?: (b: Body) => void;
}

const GRAVITY = 9.81;
/** the per-tier cap on awake dynamic bodies (PHYSICS.md §Budgets) */
export const BODY_CAP = { phone: 40, desktop: 150 } as const;

export class Body {
  /** the pose at the previous and at the latest fixed step (render interpolates between them) */
  readonly prev = { x: 0, y: 0, z: 0 };
  readonly curr = { x: 0, y: 0, z: 0 };
  readonly prevRot = { x: 0, y: 0, z: 0, w: 1 };
  readonly currRot = { x: 0, y: 0, z: 0, w: 1 };
  /** how hard the last step knocked it: the change of velocity beyond gravity (m/s). A landing, a wall, a kick. */
  impact = 0;
  /** the hardest knock since the owner last called `takeImpact()` (a frame can hold several steps) */
  private peak = 0;
  /** 0 dry … 1 fully under the surface (bodies with `float`) */
  wet = 0;
  alive = true;
  private readonly lastVel = { x: 0, y: 0, z: 0 };
  /** the half extent below the centre (for the water line) */
  readonly bottom: number;
  /** the angular deceleration (rad/s²) its `rolling` resistance works out to: 0 for none, and for a box */
  readonly rollDecel: number;

  constructor(readonly rb: RigidBody, readonly collider: Collider, readonly spec: BodySpec, readonly born: number) {
    const s = spec.shape;
    this.bottom = 'ball' in s ? s.ball : 'cylinder' in s ? s.cylinder.halfHeight : s.cuboid.y;
    // rolling without slip, a constant spin-down k gives the body a stopping slope of sinθ = k·(I/m r²)·r / g: so for
    // sinθ = c, k = c·g / ((I/m r²)·r) — a solid ball's I/m r² is 0.4, a cylinder's about its axis 0.5
    const c = spec.rolling ?? 0;
    this.rollDecel = c <= 0 ? 0 : 'ball' in s ? c * GRAVITY / (0.4 * s.ball) : 'cylinder' in s ? c * GRAVITY / (0.5 * s.cylinder.radius) : 0;
    this.snap();
  }

  /** the render pose `alpha` (0‥1) of the way from the previous step to the latest one */
  pose(alpha: number, pos: Vec3, rot?: Quat): void {
    const a = this.prev, b = this.curr;
    pos.x = a.x + (b.x - a.x) * alpha; pos.y = a.y + (b.y - a.y) * alpha; pos.z = a.z + (b.z - a.z) * alpha;
    if (rot === undefined) return;
    const p = this.prevRot, q = this.currRot;
    const s = p.x * q.x + p.y * q.y + p.z * q.z + p.w * q.w < 0 ? -1 : 1; // the short way round
    const x = p.x + (q.x * s - p.x) * alpha, y = p.y + (q.y * s - p.y) * alpha, z = p.z + (q.z * s - p.z) * alpha, w = p.w + (q.w * s - p.w) * alpha;
    const n = Math.hypot(x, y, z, w) || 1;
    rot.x = x / n; rot.y = y / n; rot.z = z / n; rot.w = w / n;
  }

  /** put it somewhere, at rest (a leash reset, a key dropped where an enemy fell) — no interpolated slide there */
  teleport(p: Vec3, rot?: Quat): void {
    this.rb.setTranslation(p, true);
    if (rot) this.rb.setRotation(rot, true);
    this.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.snap();
  }

  /** set its velocity (a throw, a bounce off the player) */
  launch(v: Vec3): void { this.rb.setLinvel(v, true); this.lastVel.x = v.x; this.lastVel.y = v.y; this.lastVel.z = v.z; }

  /** ITEM (the player pushes it, plates feel it) ↔ DEBRIS (the world only: a coconut in flight) */
  setGroup(kind: 'ITEM' | 'DEBRIS'): void { this.collider.setCollisionGroups(groups(kind)); }

  /** hidden rows leave the world (the barrel behind a `showWhen`) */
  setEnabled(on: boolean): void { if (this.rb.isEnabled() !== on) this.rb.setEnabled(on); }

  /** the hardest knock since the last call (m/s), then forget it: a landing sound, a splash */
  takeImpact(): number { const p = this.peak; this.peak = 0; return p; }

  get speed(): number { const v = this.rb.linvel(); return Math.hypot(v.x, v.y, v.z); }

  /** @internal its rolling resistance: the spin it rolls on loses `rollDecel`·dt (to 0, never past it). A cylinder
   *  rolls about its own axis, so only that part of the spin — tipping over and turning are left alone. */
  rollResist(dt: number): void {
    const w = this.rb.angvel(), d = this.rollDecel * dt;
    if ('ball' in this.spec.shape) {
      const n = Math.hypot(w.x, w.y, w.z), k = n <= d ? 0 : 1 - d / n;
      this.rb.setAngvel({ x: w.x * k, y: w.y * k, z: w.z * k }, false);
      return;
    }
    // the cylinder's axis: its local +Y turned by its rotation
    const q = this.rb.rotation();
    const ax = 2 * (q.x * q.y - q.w * q.z), ay = 1 - 2 * (q.x * q.x + q.z * q.z), az = 2 * (q.y * q.z + q.w * q.x);
    const s = w.x * ax + w.y * ay + w.z * az, cut = Math.abs(s) <= d ? s : Math.sign(s) * d;
    this.rb.setAngvel({ x: w.x - ax * cut, y: w.y - ay * cut, z: w.z - az * cut }, false);
  }

  /** prev = curr = the body's pose now */
  private snap(): void {
    const t = this.rb.translation(), q = this.rb.rotation();
    this.curr.x = this.prev.x = t.x; this.curr.y = this.prev.y = t.y; this.curr.z = this.prev.z = t.z;
    this.currRot.x = this.prevRot.x = q.x; this.currRot.y = this.prevRot.y = q.y; this.currRot.z = this.prevRot.z = q.z; this.currRot.w = this.prevRot.w = q.w;
    const v = this.rb.linvel(); this.lastVel.x = v.x; this.lastVel.y = v.y; this.lastVel.z = v.z;
  }

  /** @internal before the step */
  keepPrev(): void {
    const a = this.prev, b = this.curr, p = this.prevRot, q = this.currRot;
    a.x = b.x; a.y = b.y; a.z = b.z; p.x = q.x; p.y = q.y; p.z = q.z; p.w = q.w;
  }

  /** @internal after the step: the new pose and how hard it was knocked */
  read(dt: number): void {
    const t = this.rb.translation(), q = this.rb.rotation(), v = this.rb.linvel(), lv = this.lastVel;
    this.curr.x = t.x; this.curr.y = t.y; this.curr.z = t.z;
    this.currRot.x = q.x; this.currRot.y = q.y; this.currRot.z = q.z; this.currRot.w = q.w;
    const g = GRAVITY * this.rb.gravityScale() * dt;
    this.impact = Math.hypot(v.x - lv.x, v.y - (lv.y - g), v.z - lv.z);
    if (this.impact > this.peak) this.peak = this.impact;
    lv.x = v.x; lv.y = v.y; lv.z = v.z;
  }
}

/** what the service needs of `Game`: its fixed phases and the render interpolation factor */
export interface FixedClock {
  alpha: number;
  onFixed: (phase: 'pre' | 'step' | 'post', fn: (dt: number) => void) => void;
}

export class Bodies {
  readonly list: Body[] = [];
  cap: number;
  private steps = 0;
  private clock: FixedClock | null = null;
  private readonly order: Body[] = [];

  /** `focus`: the point the cap keeps bodies near (the player's feet, a live reference) */
  readonly focus: Vec3;

  constructor(readonly physics: Physics, focus?: Vec3, cap: number = BODY_CAP[TIER]) {
    this.focus = focus ?? { x: 0, y: 0, z: 0 };
    this.cap = cap;
  }

  /** run in the game's fixed phases; `alpha` comes from its clock from now on */
  attach(game: FixedClock): this {
    this.clock = game;
    game.onFixed('pre', (dt) => { this.pre(dt); });
    game.onFixed('post', (dt) => { this.post(dt); });
    return this;
  }

  /** 0‥1: the render's place between the last two fixed steps (1 with no clock: the latest pose) */
  get alpha(): number { return this.clock?.alpha ?? 1; }

  spawn(spec: BodySpec, at: Vec3, vel?: Vec3, rot?: Quat): Body {
    const { R, world } = this.physics;
    const desc = R.RigidBodyDesc.dynamic().setTranslation(at.x, at.y, at.z)
      .setLinearDamping(spec.linearDamping ?? 0).setAngularDamping(spec.angularDamping ?? 0.05)
      .setCcdEnabled(spec.ccd ?? false);
    if (rot) desc.setRotation(rot);
    if (vel) desc.setLinvel(vel.x, vel.y, vel.z);
    const rb = world.createRigidBody(desc);
    const s = spec.shape;
    const shape = 'ball' in s ? R.ColliderDesc.ball(s.ball)
      : 'cylinder' in s ? R.ColliderDesc.cylinder(s.cylinder.halfHeight, s.cylinder.radius)
        : R.ColliderDesc.cuboid(s.cuboid.x, s.cuboid.y, s.cuboid.z);
    shape.setDensity(spec.density ?? 500).setFriction(spec.friction ?? 0.6).setRestitution(spec.restitution ?? 0.1)
      .setCollisionGroups(groups(spec.group ?? 'ITEM'));
    const collider = world.createCollider(shape, rb);
    tagCollider(collider, spec.material, spec.owner);
    const b = new Body(rb, collider, spec, this.steps);
    this.list.push(b);
    return b;
  }

  remove(b: Body): void {
    if (!b.alive) return;
    b.alive = false;
    const i = this.list.indexOf(b);
    if (i !== -1) this.list.splice(i, 1);
    untagCollider(b.collider);
    this.physics.world.removeRigidBody(b.rb);
    b.spec.onRemoved?.(b);
  }

  /** awake dynamic bodies right now (what the cap counts) */
  get awake(): number {
    let n = 0;
    for (const b of this.list) if (b.rb.isEnabled() && !b.rb.isSleeping()) n++;
    return n;
  }

  /** before the world steps: keep the last pose; rolling things lose spin; the water lifts what floats */
  pre(dt = 1 / 60): void {
    for (const b of this.list) {
      b.keepPrev();
      if (b.rollDecel > 0 && b.rb.isEnabled() && !b.rb.isSleeping()) b.rollResist(dt);
      const f = b.spec.float;
      if (f === undefined || !b.rb.isEnabled()) continue;
      const t = b.rb.translation(), s = f.surface(t.x, t.z);
      const wet = s === undefined ? 0 : Math.min(1, Math.max(0, (s - (t.y - b.bottom)) / (2 * b.bottom)));
      if (wet === 0 && b.wet === 0) continue;
      b.wet = wet;
      b.rb.resetForces(false);
      if (wet === 0) continue;
      const m = b.rb.mass(), v = b.rb.linvel(), k = m * f.drag * wet;
      b.rb.addForce({ x: -v.x * k, y: m * GRAVITY * f.buoyancy * wet - v.y * k, z: -v.z * k }, true);
    }
  }

  /** after the world stepped: the new poses, the knocks, and the cap */
  post(dt: number): void {
    this.steps++;
    let awake = 0;
    for (const b of this.list) {
      if (!b.rb.isEnabled() || b.rb.isSleeping()) { b.impact = 0; continue; }
      b.read(dt);
      awake++;
    }
    if (awake > this.cap) this.cull(awake - this.cap);
  }

  /** put `n` awake bodies out of the way: the farthest from the focus first, the older on a tie */
  private cull(n: number): void {
    const o = this.order, f = this.focus;
    o.length = 0;
    for (const b of this.list) if (b.spec.keep !== true && b.rb.isEnabled() && !b.rb.isSleeping()) o.push(b);
    const d2 = (b: Body): number => (b.curr.x - f.x) ** 2 + (b.curr.y - f.y) ** 2 + (b.curr.z - f.z) ** 2;
    o.sort((a, b) => d2(b) - d2(a) || a.born - b.born);
    for (let i = 0; i < n && i < o.length; i++) {
      const b = o[i];
      if (b === undefined) break;
      if (b.spec.expendable === true) this.remove(b);
      else { b.rb.sleep(); b.impact = 0; }
    }
    o.length = 0;
  }

  dispose(): void {
    for (const b of this.list.slice()) this.remove(b); // remove() edits the list
  }
}

/**
 * Colliders of the kinds in `sees` overlapping a box (half extents `half`, turned `yaw` about +Y, centred at `at`):
 * `hit` is called with each one's owner until it returns true (found). A pressure plate asks this of the PLAYER and
 * ITEM groups every frame. `as` is the querier's own group (a plate is a SENSOR).
 */
export function overlapBox(physics: Physics, at: Vec3, half: Vec3, yaw: number, sees: readonly GroupName[], hit: (owner: unknown, c: Collider) => boolean, as: GroupName = 'SENSOR'): boolean {
  const { R, world } = physics;
  let found = false;
  const box = boxOf(physics, half);
  world.intersectionsWithShape(at, { x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, box, (c) => {
    if (hit(tagOf(c)?.owner ?? null, c)) { found = true; return false; }
    return true;
  }, R.QueryFilterFlags.EXCLUDE_SENSORS, queryGroups(sees, as));
  return found;
}

const boxes = new WeakMap<Physics, Map<string, Cuboid>>();
function boxOf(physics: Physics, h: Vec3): Cuboid {
  let m = boxes.get(physics);
  if (!m) { m = new Map(); boxes.set(physics, m); }
  const key = `${h.x},${h.y},${h.z}`;
  let b = m.get(key);
  if (!b) { b = new physics.R.Cuboid(h.x, h.y, h.z); m.set(key, b); }
  return b;
}

// ── drops (PHYSICS P7-L2): a thing that falls out of something, lands, and lies there ────────────────────────────────

/** a dropped item's body: a small ball that bounces a little and stops rolling soon (DEBRIS: the player walks through
 *  it, it never shoves you); removed by the cap before anything that lasts */
export const DROP_BODY = {
  shape: { ball: 0.2 }, material: 'wood', group: 'DEBRIS', density: 400, friction: 0.8, restitution: 0.4,
  angularDamping: 2, rolling: 0.3, ccd: true, expendable: true,
} as const satisfies Omit<BodySpec, 'owner'>;
/** below this speed (m/s) for DROP_REST_T (s) it has landed; after DROP_MAX_T (s) it has landed whatever it is doing */
const DROP_REST_SPEED = 0.1, DROP_REST_T = 0.3, DROP_MAX_T = 5;

/**
 * A short-lived body for something dropped into the world (a legendary's loot popping out of the carcass): it flies
 * from `from` with `vel`, bounces, settles on whatever is under it (a deck, a rock, the ground), and then the body goes
 * — the thing lies still at its `floor` point from then on and costs the physics nothing.
 *
 *   const drop = new Drop(activeBodies(), owner, from, vel);
 *   drop.update(dt);  drop.floor   // per frame: the point under it (interpolated in flight; final once `landed`)
 *
 * With no body service (node, before boot) it lands at once where it starts, on the first surface below `from` if
 * there is a physics world. Culled by the cap in flight, it lands on the surface straight below where it was.
 */
export class Drop {
  /** the point under the thing: the ball's lowest point in flight, the surface it rests on once landed */
  readonly floor = { x: 0, y: 0, z: 0 };
  landed = false;
  body: Body | null = null;
  private age = 0;
  private rest = 0;
  private readonly at = { x: 0, y: 0, z: 0 };
  private readonly r: number = DROP_BODY.shape.ball;

  constructor(private readonly bodies: Bodies | null, owner: unknown, from: Vec3, vel: Vec3, private readonly physics: Physics | null = bodies?.physics ?? null) {
    if (bodies === null) { this.land(from); return; }
    this.body = bodies.spawn({ ...DROP_BODY, owner, onRemoved: (b) => { if (!this.landed) this.land(b.curr); } }, from, vel);
    this.floor.x = from.x; this.floor.y = from.y - this.r; this.floor.z = from.z;
  }

  /** per frame: follow the body; land once it has come to rest (or flown too long). True on the frame it lands. */
  update(dt: number): boolean {
    const b = this.body;
    if (this.landed || b === null) return false;
    b.pose(this.bodies?.alpha ?? 1, this.at);
    this.floor.x = this.at.x; this.floor.y = this.at.y - this.r; this.floor.z = this.at.z;
    this.age += dt;
    this.rest = b.rb.isSleeping() || b.speed < DROP_REST_SPEED ? this.rest + dt : 0;
    if (this.rest < DROP_REST_T && this.age < DROP_MAX_T) return false;
    this.land(b.curr);
    return true;
  }

  /** stop now (picked up in flight, the owner disposed) — the body goes */
  dispose(): void { if (!this.landed) this.land(this.body?.curr ?? this.floor); }

  /** it lies at the first surface under `p` (its centre); the body, if any, is removed */
  private land(p: Vec3): void {
    this.landed = true;
    const b = this.body, x = p.x, y = p.y, z = p.z;
    this.body = null;
    if (b?.alive === true) this.bodies?.remove(b);
    const below = this.physics ? floorBelow(this.physics, x, z, y, 60) : undefined;
    this.floor.x = x; this.floor.z = z;
    this.floor.y = below ?? (b !== null ? y - this.r : y);
  }
}

let current: Bodies | null = null;
/** bootstrap sets the shard's body service once the world is built; null before that and in node tests */
export function setActiveBodies(b: Bodies | null): Bodies | null { current = b; return b; }
export function activeBodies(): Bodies | null { return current; }
