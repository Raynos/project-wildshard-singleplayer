/**
 * A rope bridge's deck as a chain of rigid planks (PHYSICS.md's "soft-body rope" row; Rapier 0.20 has no soft bodies,
 * so the rope is what a rope bridge is anyway: segments on joints). Each segment is a dynamic box; neighbours share a
 * generic joint at their common top edge that locks every axis but two: a segment pitches against the next (the deck
 * sags and bounces) and yaws against it (the span bows sideways), but never rolls about the span, so the planks stay
 * level across like a deck hung from two ropes. The first and last segments are jointed the same way to fixed anchors
 * at the posts.
 *
 * The deck is WORLD to everything that stands on it (the player's floor ray, creatures, items, bolts) but never meets
 * the WORLD itself — terrain, posts and its own neighbours — so it hangs free in the gully. Its bodies sleep when still;
 * the player's weight (CharacterMotor `weight`) wakes and loads the segment under the feet, which the motor rides.
 *
 *   const chain = new RopeChain(physics, bridge.chainSpec());
 *   game.onFixed('post', () => { chain.capture(); });           // after the world step
 *   game.onUpdate(() => { bridge.setPoses(chain, game.alpha); });  // interpolated
 */
import type { RigidBody } from '@dimforge/rapier3d-simd';
import { Bone, Group, Matrix4, Skeleton, SkinnedMesh, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import type { Physics } from './Physics';
import { GROUP } from './groups';
import { tagCollider } from './surface';
import { rideable } from './CharacterMotor';

interface Vec3 { x: number; y: number; z: number }
interface Quat { x: number; y: number; z: number; w: number }

export interface RopeChainSpec {
  /** each segment's rest pose: centre and rotation (local +z along the span, +y up), top faces on the catenary, and
   *  its half length along the span (each is one chord of the sag, so they differ a little) */
  segments: { x: number; y: number; z: number; rot: Quat; hz: number }[];
  /** a segment's half width across and half thickness */
  hx: number; hy: number;
  /** kg per segment */
  mass: number;
  /** what a hit collider reports as its owner (a bolt that sticks rides `follows`) — one per segment, or none */
  owners?: readonly unknown[];
}

/** The deck meets everything that stands on or hits it, never the world it hangs in. */
const DECK_GROUPS = ((GROUP.WORLD << 16) | (0xffff & ~GROUP.WORLD)) >>> 0;

export class RopeChain {
  readonly bodies: RigidBody[] = [];
  private readonly anchors: RigidBody[] = [];
  /** the last two fixed steps' poses per segment (x y z qx qy qz qw), for interpolating the drawn deck */
  private prev: Float32Array;
  private cur: Float32Array;

  private readonly physics: Physics;
  readonly spec: RopeChainSpec;

  constructor(physics: Physics, spec: RopeChainSpec) {
    this.physics = physics; this.spec = spec;
    const { R, world } = physics;
    const { segments, hx, hy, mass } = spec;
    const n = segments.length;
    this.prev = new Float32Array(n * 7); this.cur = new Float32Array(n * 7);
    const mask = R.JointAxesMask.LinX | R.JointAxesMask.LinY | R.JointAxesMask.LinZ | R.JointAxesMask.AngX;
    // the joint frame's X axis runs along the span: AngX locked = no roll; pitch and yaw stay free
    const along = { x: 0, y: 0, z: 1 };
    segments.forEach((s, i) => {
      const body = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(s.x, s.y, s.z).setRotation(s.rot)
        .setLinearDamping(0.6).setAngularDamping(2).setCanSleep(true)
        // a 25-link chain on impulse joints is soft at the world's 4 solver iterations (the deck sags 0.9 m more than it
        // was built); 16 more on its own island hold it within ~6 cm, ~0.1 ms a step while awake (asleep: nothing)
        .setAdditionalSolverIterations(16));
      const c = world.createCollider(R.ColliderDesc.cuboid(hx, hy, s.hz).setMass(mass).setFriction(0.9).setCollisionGroups(DECK_GROUPS).setSolverGroups(DECK_GROUPS), body);
      tagCollider(c, 'wood', spec.owners?.[i] ?? null);
      rideable(body);
      this.bodies.push(body);
    });
    // neighbours: the end of one segment's top face is the start of the next one's
    for (let i = 0; i + 1 < n; i++) {
      const a = this.bodies[i], b = this.bodies[i + 1], sa = segments[i], sb = segments[i + 1];
      if (!a || !b || !sa || !sb) continue;
      world.createImpulseJoint(R.JointData.generic({ x: 0, y: hy, z: sa.hz }, { x: 0, y: hy, z: -sb.hz }, along, mask), a, b, true);
    }
    // the posts: a fixed anchor posed like the end segment, jointed at its outer edge
    const anchor = (s: RopeChainSpec['segments'][number], body: RigidBody, end: 1 | -1): void => {
      const fixed = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(s.x, s.y, s.z).setRotation(s.rot));
      this.anchors.push(fixed);
      const edge = { x: 0, y: hy, z: end * s.hz };
      world.createImpulseJoint(R.JointData.generic(edge, edge, along, mask), fixed, body, true);
    };
    const first = segments[0], last = segments[n - 1], b0 = this.bodies[0], bn = this.bodies[n - 1];
    if (first && b0) anchor(first, b0, -1);
    if (last && bn) anchor(last, bn, 1);
    this.capture(); this.prev.set(this.cur);
  }

  /** read the bodies' poses after a world step (the fixed step's `post` slot) */
  capture(): void {
    const t = this.prev; this.prev = this.cur; this.cur = t;
    this.bodies.forEach((b, i) => {
      const p = b.translation(), q = b.rotation(), o = i * 7;
      t[o] = p.x; t[o + 1] = p.y; t[o + 2] = p.z; t[o + 3] = q.x; t[o + 4] = q.y; t[o + 5] = q.z; t[o + 6] = q.w;
    });
  }

  /** segment `i`'s pose between the last two steps (`alpha` 0 → 1): position into `p`, rotation into `q` */
  pose(i: number, alpha: number, p: Vec3, q: Quat): void {
    const a = this.prev, b = this.cur, o = i * 7, k = 1 - alpha;
    p.x = (a[o] ?? 0) * k + (b[o] ?? 0) * alpha;
    p.y = (a[o + 1] ?? 0) * k + (b[o + 1] ?? 0) * alpha;
    p.z = (a[o + 2] ?? 0) * k + (b[o + 2] ?? 0) * alpha;
    // nlerp: the steps are 1/60 s apart, so the two rotations are close
    let qx = a[o + 3] ?? 0, qy = a[o + 4] ?? 0, qz = a[o + 5] ?? 0, qw = a[o + 6] ?? 1;
    const bx = b[o + 3] ?? 0, by = b[o + 4] ?? 0, bz = b[o + 5] ?? 0, bw = b[o + 6] ?? 1;
    const s = qx * bx + qy * by + qz * bz + qw * bw < 0 ? -1 : 1;
    qx = qx * k + bx * alpha * s; qy = qy * k + by * alpha * s; qz = qz * k + bz * alpha * s; qw = qw * k + bw * alpha * s;
    const l = Math.hypot(qx, qy, qz, qw) || 1;
    q.x = qx / l; q.y = qy / l; q.z = qz / l; q.w = qw / l;
  }

  get count(): number { return this.bodies.length; }

  /** true while any segment moves (the drawn deck needs no update while the chain sleeps) */
  get awake(): boolean { return this.bodies.some((b) => !b.isSleeping()); }

  /** Apply an admitted deck activation without exposing body construction to content. */
  setEnabled(enabled: boolean): void { for (const body of this.bodies) body.setEnabled(enabled); }

  dispose(): void {
    for (const b of [...this.bodies, ...this.anchors]) this.physics.world.removeRigidBody(b);
    this.bodies.length = 0; this.anchors.length = 0;
  }
}

/** what poses a deck's segments: a RopeChain (or anything with its `pose`) */
export interface RopeDeckPoses { pose: (i: number, alpha: number, p: Vec3, q: Quat) => void }
const _p = { x: 0, y: 0, z: 0 }, _q = { x: 0, y: 0, z: 0, w: 1 }, _top = new Vector3();

/**
 * A rope deck as drawn: one holder (a bone) per segment, posed in the deck's own space (world minus `origin`) from a
 * chain interpolated at `alpha`, or at rest without one; and the deck's live top-centre height at each joint (segment
 * k's start edge, the last segment's end edge), world space, for the deck's floor read.
 */
export class RopeDeckView {
  private readonly live: Float32Array;
  private readonly rest: RopeChainSpec['segments'];
  private readonly halfY: number;
  private readonly origin: Vec3;
  private readonly holders: readonly Object3D[];
  constructor(rest: RopeChainSpec['segments'], halfY: number, origin: Vec3, holders: readonly Object3D[]) {
    if (holders.length < rest.length) throw new Error('Rope deck needs a holder per segment');
    this.rest = rest; this.halfY = halfY; this.origin = origin; this.holders = holders; this.live = new Float32Array(rest.length + 1);
  }

  pose(chain: RopeDeckPoses | null, alpha: number): void {
    const n = this.rest.length, o = this.origin;
    for (let i = 0; i < n; i++) {
      const sg = this.rest[i], h = this.holders[i];
      if (sg === undefined || h === undefined) continue;
      if (chain) chain.pose(i, alpha, _p, _q);
      else { _p.x = sg.x; _p.y = sg.y; _p.z = sg.z; _q.x = sg.rot.x; _q.y = sg.rot.y; _q.z = sg.rot.z; _q.w = sg.rot.w; }
      h.position.set(_p.x - o.x, _p.y - o.y, _p.z - o.z); h.quaternion.set(_q.x, _q.y, _q.z, _q.w); h.updateMatrix();
      h.matrixWorldNeedsUpdate = true;
    }
    for (let k = 0; k <= n; k++) {
      const i = Math.min(k, n - 1), sg = this.rest[i], h = this.holders[i];
      if (sg && h) this.live[k] = _top.set(0, this.halfY, k < n ? -sg.hz : sg.hz).applyMatrix4(h.matrix).y + o.y;
    }
  }

  /** the live deck height a fraction `t` (0 → 1) along the span, between the two joints either side */
  heightAt(t: number): number {
    const n = this.rest.length, k = Math.min(1, Math.max(0, t)) * n, i = Math.min(n - 1, Math.floor(k)), f = k - i;
    return (this.live[i] ?? 0) * (1 - f) + (this.live[i + 1] ?? 0) * f;
  }
}

/**
 * A drawn rope deck (G571): one holder bone per rest segment plus the posts' still anchor, a skinned deck draw bound to
 * them as they stand at rest, the deck's RopeChain spec (its holders the hit owners, so a bolt stuck in the deck rides
 * it) and the deck's floor over its span. The chain (engine/physics/ropeChain) hangs the segments; `setPoses` carries
 * their interpolated poses into the holders; `floorHeightAt` reads the live joint heights where (x, z) is over the deck.
 */
export interface RopeDeckFacts {
  /** the deck's own-space origin in the world (end a on the ground) */
  readonly origin: { readonly x: number; readonly y: number; readonly z: number };
  readonly segments: RopeChainSpec['segments'];
  /** the span's start (end a, world xz), its unit direction, its length and the deck's width (m) */
  readonly start: readonly [number, number]; readonly direction: { readonly x: number; readonly z: number };
  readonly len: number; readonly width: number;
}
export interface RopeDeckRows {
  /** a segment's half thickness (m) and weight (kg); the most segments a deck carries */
  readonly halfY: number; readonly mass: number; readonly maxSegments: number;
  /** the hit owner each segment reports, and the margin (m) the floor and the chain's width extend past the deck */
  readonly owner: { readonly id: string; readonly name: string }; readonly margin: number;
}

export class RopeDeck {
  readonly group = new Group();
  private readonly holders: Bone[];
  private readonly view: RopeDeckView;
  private readonly facts: RopeDeckFacts;
  private readonly rows: RopeDeckRows;

  constructor(name: string, facts: RopeDeckFacts, draw: { readonly geometry: BufferGeometry; readonly material: Material }, rows: RopeDeckRows) {
    if (facts.segments.length > rows.maxSegments) throw new Error('Rope deck exceeds its segment bound');
    this.facts = facts; this.rows = rows; this.group.name = name;
    this.holders = Array.from({ length: facts.segments.length + 1 }, () => { const h = new Bone(); h.matrixAutoUpdate = false; this.group.add(h); return h; });
    this.view = new RopeDeckView(facts.segments, rows.halfY, facts.origin, this.holders);
    this.view.pose(null, 1);
    // one draw skinned to the holders as they stand at rest (a graph's skinning binds one skeleton: the material is its own)
    const deck = new SkinnedMesh(draw.geometry, draw.material);
    deck.castShadow = true; deck.receiveShadow = true; deck.frustumCulled = false; // it moves, and it spans its gully
    deck.bind(new Skeleton(this.holders, this.holders.map(h => h.matrix.clone().invert())), new Matrix4());
    this.group.add(deck);
  }

  /** the chain's spec: the rest segments, their size and weight, their holders as owners */
  chainSpec(): RopeChainSpec & { owners: { id: string; name: string; follows: Bone }[] } {
    const { facts, rows } = this;
    return { segments: facts.segments, hx: facts.width / 2 + rows.margin, hy: rows.halfY, mass: rows.mass,
      owners: this.holders.slice(0, facts.segments.length).map(follows => ({ id: rows.owner.id, name: rows.owner.name, follows })) };
  }

  /** Pose the holders from `chain` (interpolated by `alpha`), or at rest when null. */
  setPoses(chain: RopeDeckPoses | null, alpha: number): void { this.view.pose(chain, alpha); }

  /** the plank height under world (x, z) when over the span (the live deck while a chain poses it), else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const { start, direction: d, len, width } = this.facts, m = this.rows.margin, dx = x - start[0], dz = z - start[1];
    const along = dx * d.x + dz * d.z, across = -dx * d.z + dz * d.x;
    if (along < -0.3 || along > len + 0.3 || Math.abs(across) > width / 2 + m) return undefined;
    return this.view.heightAt(along / len);
  }
}
