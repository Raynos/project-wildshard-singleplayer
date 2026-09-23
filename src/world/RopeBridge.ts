/**
 * RopeBridge — a walkable rope-and-plank bridge (Driftwood Isle: over the gully on the headland climb). Anchor posts at
 * both ends, a deck of planks hung on a sagging catenary, rope handrails with vertical stays.
 *
 * The deck moves (PHYSICS.md, the rope bridge): it is cut into ~0.9 m segments that src/physics/ropeChain.ts hangs as a
 * jointed chain between the posts. It sags and bounces under the player's weight and bows sideways, and the planks,
 * load ropes, handrails and stays are drawn from the segments' poses every frame (two instanced meshes). Without a
 * physics world (the dev scenes) it is drawn at rest, and `floorHeightAt` is the still catenary.
 *
 *   const bridge = new RopeBridge(sky, { a: [52, 48], b: [64, 60], sag: 1.1 }).build();
 *   registry.add({ …, object: bridge.mesh, colliders: bridge.colliderDescs() });   // posts, rails, the end steps
 *   const chain = new RopeChain(physics, bridge.chainSpec());                        // the deck
 *   game.onFixed('post', () => { chain.capture(); });
 *   game.onUpdate(() => { bridge.setPoses(chain, game.alpha); });
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './Heightfield';
import { Rng } from '../core/rng';
import { SEED } from '../core/config';
import type { Collider } from '../player/Player';
import type { Sky } from './Sky';
import { boxDesc, type ColliderDesc } from './registry';

export interface RopeBridgeSpec { a: [number, number]; b: [number, number]; /** metres the middle hangs below the straight line */ sag?: number; width?: number }

/** what poses the deck's segments: a RopeChain (src/physics/ropeChain.ts) */
export interface DeckPoses { pose: (i: number, alpha: number, p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }) => void }

/** one deck segment at rest: centre, rotation (local +z along the span, +y up), half length */
export interface DeckSegment { x: number; y: number; z: number; rot: { x: number; y: number; z: number; w: number }; hz: number }

const C = { post: new THREE.Color('#6f5638'), plank: new THREE.Color('#a07c53'), plankDark: new THREE.Color('#7d5f3f'), rope: new THREE.Color('#d2bd85') };
/** a deck segment's length before it is fitted to the span (m), its half thickness, its weight (kg) */
const SEG_LEN = 0.9, SEG_HY = 0.05, SEG_KG = 14;

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

export class RopeBridge {
  /** the posts (static), the planks and ropes (instanced, posed by `setPoses`), and one holder per deck segment */
  mesh!: THREE.Group;
  colliders: Collider[] = [];
  private ya = 0; private yb = 0; private len = 0; private dir = new THREE.Vector2(); private width = 1.4; private sag = 1;
  private segs: DeckSegment[] = [];
  /** per segment: an Object3D at its pose (a bolt stuck in the deck rides it) */
  private holders: THREE.Object3D[] = [];
  private planks!: THREE.InstancedMesh;
  private ropes!: THREE.InstancedMesh;
  /** per plank: its segment, its offset along that segment, its width */
  private plankSpecs: { seg: number; z: number; w: number }[] = [];
  /** the deck's live top-centre height at each joint (n + 1), for `floorHeightAt` */
  private live = new Float32Array(0);

  constructor(private sky: Sky, private spec: RopeBridgeSpec) {}

  /** plank height at span fraction t (0 at a → 1 at b), at rest */
  private deckY(t: number) { return this.ya + (this.yb - this.ya) * t - this.sag * 4 * t * (1 - t); }

  build(): this {
    const rng = new Rng(SEED ^ 0xb21d);
    const { a, b } = this.spec;
    this.width = this.spec.width ?? 1.4; this.sag = this.spec.sag ?? 1.0;
    this.ya = heightAt(a[0], a[1]) + 0.35; this.yb = heightAt(b[0], b[1]) + 0.35;
    this.len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    this.dir.set((b[0] - a[0]) / this.len, (b[1] - a[1]) / this.len);
    const side = new THREE.Vector2(-this.dir.y, this.dir.x);
    const hw = this.width / 2;
    const at = (t: number, s: number, dy: number) => new THREE.Vector3(a[0] + this.dir.x * this.len * t + side.x * s, this.deckY(t) + dy, a[1] + this.dir.y * this.len * t + side.y * s);
    this.mesh = new THREE.Group();
    this.mesh.name = 'rope-bridge';

    // ── anchor posts (two per end), sunk into the ground: the one static part ──
    const parts: THREE.BufferGeometry[] = [];
    for (const [t, y] of [[0, this.ya], [1, this.yb]] as [number, number][]) for (const s of [-1, 1]) {
      const p = at(t, s * (hw + 0.15), 0);
      const gy = heightAt(p.x, p.z);
      const g = new THREE.CylinderGeometry(0.13, 0.16, y + 1.3 - gy + 0.5, 6).translate(p.x, (y + 1.3 + gy - 0.5) / 2, p.z);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.toNonIndexed(), n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 0.94 + rng.next() * 0.12; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = C.post.r * k; c[(i + j) * 3 + 1] = C.post.g * k; c[(i + j) * 3 + 2] = C.post.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
      this.colliders.push({ x: p.x, z: p.z, hw: 0.18, hd: 0.18, rot: 0, yTop: y + 1.3, yBottom: gy - 1 });
    }
    const postMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
    this.sky.setupMaterial(postMat);
    const posts = new THREE.Mesh(mergeGeometries(parts, false), postMat);
    posts.castShadow = true; posts.receiveShadow = true;
    this.mesh.add(posts);

    // ── the deck at rest: one segment per chord of the sag, its top face on the catenary ──
    const n = Math.max(6, Math.round(this.len / SEG_LEN));
    const yaw = Math.atan2(this.dir.x, this.dir.y);
    const e = new THREE.Euler(0, 0, 0, 'YXZ'), up = new THREE.Vector3();
    const top = (t: number) => this.deckY(t) + 0.03;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, y0 = top(t0), y1 = top(t1), run = this.len / n;
      _q.setFromEuler(e.set(-Math.atan2(y1 - y0, run), yaw, 0));
      up.set(0, 1, 0).applyQuaternion(_q);
      const sm = (t0 + t1) / 2 * this.len;
      this.segs.push({ x: a[0] + this.dir.x * sm - up.x * SEG_HY, y: (y0 + y1) / 2 - up.y * SEG_HY, z: a[1] + this.dir.y * sm - up.z * SEG_HY, rot: { x: _q.x, y: _q.y, z: _q.z, w: _q.w }, hz: Math.hypot(run, y1 - y0) / 2 });
      const h = new THREE.Object3D();
      h.matrixAutoUpdate = false;
      this.mesh.add(h); this.holders.push(h);
    }
    this.live = new Float32Array(n + 1);

    // ── planks (~0.42 m apart, two or three per segment) and ropes: instanced, posed from the segments ──
    this.segs.forEach((sg, i) => {
      const k = Math.max(1, Math.round(sg.hz * 2 / 0.42));
      for (let j = 0; j < k; j++) this.plankSpecs.push({ seg: i, z: -sg.hz + (j + 0.5) * (sg.hz * 2 / k), w: this.width + 0.2 + rng.range(-0.04, 0.04) });
    });
    const plankMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.88, metalness: 0 });
    this.sky.setupMaterial(plankMat);
    this.planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), plankMat, this.plankSpecs.length);
    const col = new THREE.Color();
    this.plankSpecs.forEach((_, i) => { this.planks.setColorAt(i, col.copy(i % 3 === 0 ? C.plankDark : C.plank).multiplyScalar(0.94 + rng.next() * 0.12)); });
    const ropeMat = new THREE.MeshStandardMaterial({ color: C.rope, flatShading: true, roughness: 0.9, metalness: 0 });
    this.sky.setupMaterial(ropeMat);
    this.ropes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 4, 1, true).translate(0, 0.5, 0), ropeMat, 2 * (2 * n + Math.ceil(n / 2)));
    for (const m of [this.planks, this.ropes]) {
      m.castShadow = true; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; // it moves, and its instances span the gully
      this.mesh.add(m);
    }

    // rail colliders in three sagging segments (static: the handrails bow a hand's width at most)
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const t0 = i / 3, t1 = (i + 1) / 3, mid = at((t0 + t1) / 2, s * (hw + 0.12), 0);
        this.colliders.push({ x: mid.x, z: mid.z, hw: 0.06, hd: this.len / 6, rot: -yaw, yTop: Math.max(this.deckY(t0), this.deckY(t1)) + 1.1, yBottom: Math.min(this.deckY(t0), this.deckY(t1)) - 0.5 });
      }
    }
    this.setPoses(null, 1);
    return this;
  }

  /** the deck for src/physics/ropeChain.ts: the segments at rest, their size and weight, their holders as owners */
  chainSpec(): { segments: DeckSegment[]; hx: number; hy: number; mass: number; owners: { id: string; name: string; follows: THREE.Object3D }[] } {
    return { segments: this.segs, hx: this.width / 2 + 0.15, hy: SEG_HY, mass: SEG_KG, owners: this.holders.map((follows) => ({ id: 'bridge', name: 'Rope bridge', follows })) };
  }

  /** Pose the drawn deck: from `deck` (a RopeChain, interpolated by `alpha`), or at rest when null. */
  setPoses(deck: DeckPoses | null, alpha: number): void {
    const hw = this.width / 2, n = this.segs.length;
    this.segs.forEach((sg, i) => {
      if (deck) deck.pose(i, alpha, _p, _q); else { _p.set(sg.x, sg.y, sg.z); _q.set(sg.rot.x, sg.rot.y, sg.rot.z, sg.rot.w); }
      const h = this.holders[i];
      if (!h) return;
      h.position.copy(_p); h.quaternion.copy(_q); h.updateMatrix();
      h.matrixWorldNeedsUpdate = true;
    });
    // planks: flush with their segment's top face
    this.plankSpecs.forEach((pk, i) => {
      const h = this.holders[pk.seg];
      if (!h) return;
      _m.compose(_v.set(0, SEG_HY - 0.03, pk.z), _q2.identity(), _s.set(pk.w, 0.06, 0.3));
      this.planks.setMatrixAt(i, _m.premultiply(h.matrix));
    });
    this.planks.instanceMatrix.needsUpdate = true;
    // a joint's point at (x across, y up): segment k's start edge (the last segment's end edge for k = n)
    const joint = (k: number, x: number, y: number, out: THREE.Vector3): THREE.Vector3 => {
      const i = Math.min(k, n - 1), sg = this.segs[i], h = this.holders[i];
      if (!sg || !h) return out.set(0, 0, 0);
      return out.set(x, y, k < n ? -sg.hz : sg.hz).applyMatrix4(h.matrix);
    };
    for (let k = 0; k <= n; k++) this.live[k] = joint(k, 0, SEG_HY, _a).y;
    let r = 0;
    const rope = (from: THREE.Vector3, to: THREE.Vector3, radius: number): void => {
      const d = _d.subVectors(to, from), l = d.length();
      _q2.setFromUnitVectors(_y, d.divideScalar(l || 1));
      this.ropes.setMatrixAt(r++, _m.compose(from, _q2, _s.set(radius, l, radius)));
    };
    for (const s of [-1, 1]) {
      for (let k = 0; k < n; k++) {
        rope(joint(k, s * (hw + 0.05), SEG_HY - 0.07, _a), joint(k + 1, s * (hw + 0.05), SEG_HY - 0.07, _b), 0.035); // the load rope under the plank ends
        rope(joint(k, s * (hw + 0.12), SEG_HY + 0.97, _a), joint(k + 1, s * (hw + 0.12), SEG_HY + 0.97, _b), 0.035); // the handrail
      }
      for (let k = 1; k < n; k += 2) rope(joint(k, s * (hw + 0.1), SEG_HY - 0.05, _a), joint(k, s * (hw + 0.12), SEG_HY + 0.97, _b), 0.025); // stays
    }
    this.ropes.count = r;
    this.ropes.instanceMatrix.needsUpdate = true;
  }

  /** the plank height under (x, z) when over the span (the live deck while a chain poses it), else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const { a } = this.spec;
    const dx = x - a[0], dz = z - a[1];
    const along = dx * this.dir.x + dz * this.dir.y, across = -dx * this.dir.y + dz * this.dir.x;
    if (along < -0.3 || along > this.len + 0.3 || Math.abs(across) > this.width / 2 + 0.15) return undefined;
    const n = this.segs.length, k = Math.min(1, Math.max(0, along / this.len)) * n, i = Math.min(n - 1, Math.floor(k)), f = k - i;
    return (this.live[i] ?? 0) * (1 - f) + (this.live[i + 1] ?? 0) * f;
  }

  /** one walk slab along the span from s0 to s1 metres (its top on the rest catenary), as a ColliderDesc */
  private slab(s0: number, s1: number): ColliderDesc {
    const { a } = this.spec;
    const floor = (s: number) => this.deckY(Math.min(1, Math.max(0, s / this.len))) + 0.03;
    const yaw = Math.atan2(this.dir.x, this.dir.y), hx = this.width / 2 + 0.15, hy = 0.1, over = 0.02;
    const y0 = floor(s0), y1 = floor(s1);
    const run = s1 - s0, pitch = Math.atan2(y1 - y0, run), chord = Math.hypot(run, y1 - y0);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-pitch, yaw, 0, 'YXZ'));
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const sm = (s0 + s1) / 2, ym = (y0 + y1) / 2;
    return {
      kind: 'box', hx, hy, hz: chord / 2 + over,
      x: a[0] + this.dir.x * sm - up.x * hy, y: ym - up.y * hy, z: a[1] + this.dir.y * sm - up.z * hy,
      rot: { x: q.x, y: q.y, z: q.z, w: q.w },
    };
  }

  /**
   * PHYSICS P4: this builder's static collision in world space — the posts and rails (the legacy boxes), the flat
   * 0.3 m overhangs at both ends, and a tread in front of each end. The span itself is the RopeChain (`chainSpec`);
   * `deckDescs` is that span at rest, for the navmesh bake and the trail probes.
   */
  colliderDescs(): ColliderDesc[] {
    const out: ColliderDesc[] = this.colliders.map((c) => boxDesc(c));
    const { a } = this.spec;
    const floor = (s: number) => this.deckY(Math.min(1, Math.max(0, s / this.len))) + 0.03;
    const yaw = Math.atan2(this.dir.x, this.dir.y), hx = this.width / 2 + 0.15;
    out.push(this.slab(-0.3, 0), this.slab(this.len, this.len + 0.3));
    // the ends stand 0.36–0.39 m over the ground (a: ya is ground + 0.35, plus the 3 cm plank; b: one side of the path
    // falls away), which the old 0.5 m step-up climbed and the 0.35 m autostep may not: one tread, 0.4 m deep, just
    // outside each end, 0.19 m under the deck, down into the ground
    for (const [s0, s1] of [[-0.7, -0.3], [this.len + 0.3, this.len + 0.7]] as const) {
      const topY = floor(s0 < 0 ? 0 : this.len) - 0.19, sm = (s0 + s1) / 2, side = new THREE.Vector2(-this.dir.y, this.dir.x);
      let lo = topY;
      for (const sa of [s0, s1]) for (const c of [-hx, hx]) lo = Math.min(lo, heightAt(a[0] + this.dir.x * sa + side.x * c, a[1] + this.dir.y * sa + side.y * c));
      const th = (topY - (lo - 0.3)) / 2;
      out.push({ kind: 'box', x: a[0] + this.dir.x * sm, y: topY - th, z: a[1] + this.dir.y * sm, hx, hy: th, hz: (s1 - s0) / 2, yaw });
    }
    return out;
  }

  /** the span at rest as static slabs (≤ 1 m each, running 2 cm into each other): what the navmesh bake walks */
  deckDescs(): ColliderDesc[] {
    const n = Math.ceil(this.len / 1.0), out: ColliderDesc[] = [];
    for (let i = 0; i < n; i++) out.push(this.slab((i / n) * this.len, ((i + 1) / n) * this.len));
    return out;
  }
}
