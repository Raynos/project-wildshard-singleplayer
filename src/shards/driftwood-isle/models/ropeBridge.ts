/**
 * The rope bridge (E306 / E315 M1, second pass: a model on the contract, src/engine/models/model.ts; it was built in
 * src/shards/driftwood-isle/world/RopeBridge.ts) — a walkable rope-and-plank bridge (Driftwood Isle: over the gully on the headland climb).
 * Anchor posts at both ends, a deck of planks hung on a sagging catenary, rope handrails with vertical stays.
 *
 * The deck moves (PHYSICS.md, the rope bridge): it is cut into ~0.9 m segments that src/engine/physics/ropeChain.ts hangs as a
 * jointed chain between the posts. It sags and bounces under the player's weight and bows sideways, and the planks,
 * load ropes, handrails and stays are drawn from the segments' poses every frame (two instanced meshes). Without a
 * physics world (the dev scenes, the Explorer) it is drawn at rest, and `floorHeightAt` is the still catenary.
 *
 * Its own space: the origin is end a on the ground, the span running to b (its params: the two ends' world xz, the sag,
 * the width and the ground under them — the posts' feet and the ends' treads read it, so it is built where it stands).
 * The drawn group (the posts, the two instanced meshes, a holder per deck segment) is handed over in own space and
 * placed `single` at the origin; the chain's segments stay in the world (`chainSpec`), their poses are carried into the
 * group's space as they are drawn. `ropeBridgeLayout(params)` is a placement's builder, shared with its build.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import { BRIDGE_SPANS } from '../data/bridgeRows';
import { admitBridgeFacts } from '../boot/bridgeFacts';
import { staticColliders } from '../runtime/boot/staticColliders';
import { defineModel } from '@wildshard/engine/models/model';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import type { ColliderDesc } from '@wildshard/engine/world/registry';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';

export interface RopeBridgeSpec { a: [number, number]; b: [number, number]; /** metres the middle hangs below the straight line */ sag?: number; width?: number }

/** what poses the deck's segments: a RopeChain (src/engine/physics/ropeChain.ts) */
export interface DeckPoses { pose: (i: number, alpha: number, p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number; w: number }) => void }

/** one deck segment at rest: centre, rotation (local +z along the span, +y up), half length */
export interface DeckSegment { x: number; y: number; z: number; rot: { x: number; y: number; z: number; w: number }; hz: number }

const C = { post: new THREE.Color('#6f5638'), rope: new THREE.Color('#d2bd85') };
/** a deck segment's length before it is fitted to the span (m), its half thickness, its weight (kg) */
const SEG_HY = 0.05, SEG_KG = 14;


const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

class RopeBridgeBuilder {
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

  /** the site's origin (own space = world − origin): end a on the ground */
  readonly o: { x: number; y: number; z: number };
  /** own-space colliders (the legacy boxes and the static floors), handed to the model */
  descs: ColliderDesc[] = [];

  private readonly facts: ReturnType<typeof admitBridgeFacts>;
  constructor(private sky: Sky, private spec: RopeBridgeSpec, private readonly ground: (x: number, z: number) => number) { this.facts = admitBridgeFacts(spec, ground); this.o = {...this.facts.origin}; }

  /** plank height at span fraction t (0 at a → 1 at b), at rest */
  private deckY(t: number) { return this.ya + (this.yb - this.ya) * t - this.sag * 4 * t * (1 - t); }

  build(): this {
    const rng = new Rng(SEED ^ 0xb21d);
    const { a } = this.spec;
    const facts=this.facts;
    this.width=facts.width;this.sag=facts.sag;this.ya=facts.ya;this.yb=facts.yb;this.len=facts.len;
    this.dir.set(facts.direction.x,facts.direction.z);
    const side = new THREE.Vector2(-this.dir.y, this.dir.x);
    const hw = this.width / 2;
    const at = (t: number, s: number, dy: number) => new THREE.Vector3(a[0] + this.dir.x * this.len * t + side.x * s, this.deckY(t) + dy, a[1] + this.dir.y * this.len * t + side.y * s);
    this.mesh = new THREE.Group();
    this.mesh.name = 'rope-bridge';

    // ── anchor posts (two per end), sunk into the ground: the one static part ──
    const parts: THREE.BufferGeometry[] = [];
    for (const [t, y] of [[0, this.ya], [1, this.yb]] as [number, number][]) for (const s of [-1, 1]) {
      const p = at(t, s * (hw + 0.15), 0);
      const gy = this.ground(p.x, p.z);
      const g = new THREE.CylinderGeometry(0.13, 0.16, y + 1.3 - gy + 0.5, 6).translate(p.x, (y + 1.3 + gy - 0.5) / 2, p.z);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.toNonIndexed(), n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i += 3) { const k = 0.94 + rng.next() * 0.12; for (let j = 0; j < 3; j++) { c[(i + j) * 3] = C.post.r * k; c[(i + j) * 3 + 1] = C.post.g * k; c[(i + j) * 3 + 2] = C.post.b * k; } }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    }
    const postMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
    this.sky.setupMaterial(postMat);
    const postGeo = mergeGeometries(parts, false);
    postGeo.translate(-this.o.x, -this.o.y, -this.o.z); // own space
    const posts = new THREE.Mesh(postGeo, postMat);
    posts.castShadow = true; posts.receiveShadow = true;
    this.mesh.add(posts);

    // ── the deck at rest: one segment per chord of the sag, its top face on the catenary ──
    this.segs=structuredClone(facts.segments);
    for(let i=0;i<this.segs.length;i++){const h=new THREE.Object3D();h.matrixAutoUpdate=false;this.mesh.add(h);this.holders.push(h);}
    const n=this.segs.length;
    this.live = new Float32Array(n + 1);
    this.plankSpecs=structuredClone(facts.planks);
    const plankMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.88, metalness: 0 });
    this.sky.setupMaterial(plankMat);
    this.planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), plankMat, this.plankSpecs.length);
    const col = new THREE.Color();
    facts.colours.forEach((c,i)=>{this.planks.setColorAt(i,col.setRGB(c.r,c.g,c.b));});
    const ropeMat = new THREE.MeshStandardMaterial({ color: C.rope, flatShading: true, roughness: 0.9, metalness: 0 });
    this.sky.setupMaterial(ropeMat);
    this.ropes = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 4, 1, true).translate(0, 0.5, 0), ropeMat, 2 * (2 * n + Math.ceil(n / 2)));
    for (const m of [this.planks, this.ropes]) {
      m.castShadow = true; m.receiveShadow = true;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false; // it moves, and its instances span the gully
      this.mesh.add(m);
    }

    this.colliders=structuredClone(facts.colliders);
    this.setPoses(null, 1);
    // own-space colliders for the model (the world's are these placed back at the origin)
    const o = this.o;
    this.descs = this.colliderDescs(); // fresh objects each call
    for (const d of this.descs) if (d.kind !== 'treads') { d.x -= o.x; d.y -= o.y; d.z -= o.z; }
    return this;
  }

  /** the deck for src/engine/physics/ropeChain.ts: the segments at rest, their size and weight, their holders as owners */
  chainSpec(): { segments: DeckSegment[]; hx: number; hy: number; mass: number; owners: { id: string; name: string; follows: THREE.Object3D }[] } {
    return { segments: this.segs, hx: this.width / 2 + 0.15, hy: SEG_HY, mass: SEG_KG, owners: this.holders.map((follows) => ({ id: 'bridge', name: 'Rope bridge', follows })) };
  }

  /** Pose the drawn deck: from `deck` (a RopeChain, interpolated by `alpha`), or at rest when null. */
  setPoses(deck: DeckPoses | null, alpha: number): void {
    const hw = this.width / 2, n = this.segs.length;
    this.segs.forEach((sg, i) => {
      if (deck) deck.pose(i, alpha, _p, _q); else { _p.set(sg.x, sg.y, sg.z); _q.set(sg.rot.x, sg.rot.y, sg.rot.z, sg.rot.w); }
      _p.x -= this.o.x; _p.y -= this.o.y; _p.z -= this.o.z; // the group stands at the origin: the holders are posed in its own space
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

  /** the plank height under world (x, z) when over the span (the live deck while a chain poses it), else undefined */
  floorHeightAt(x: number, z: number): number | undefined {
    const { a } = this.spec;
    const dx = x - a[0], dz = z - a[1];
    const along = dx * this.dir.x + dz * this.dir.y, across = -dx * this.dir.y + dz * this.dir.x;
    if (along < -0.3 || along > this.len + 0.3 || Math.abs(across) > this.width / 2 + 0.15) return undefined;
    const n = this.segs.length, k = Math.min(1, Math.max(0, along / this.len)) * n, i = Math.min(n - 1, Math.floor(k)), f = k - i;
    return (this.live[i] ?? 0) * (1 - f) + (this.live[i + 1] ?? 0) * f + this.o.y; // the live joints are own space
  }

  /** Fresh native post, rail and end-tread descriptors from the authored rest plan. */
  colliderDescs(): ColliderDesc[] { return staticColliders(this.facts.descs); }
  /** Static rest slabs for navmesh and trail probes; live collision remains the RopeChain. */
  deckDescs(): ColliderDesc[] { return staticColliders(this.facts.deck); }

}

export type RopeBridgeLayout = Pick<RopeBridgeBuilder, 'o' | 'colliders' | 'descs' | 'chainSpec' | 'setPoses' | 'floorHeightAt' | 'colliderDescs' | 'deckDescs' | 'mesh'>;

export interface RopeBridgeParams {
  readonly span: RopeBridgeSpec;
  /** the ground under a world (x, z) at the site: its y */
  readonly ground: (x: number, z: number) => number;
}

/** a specimen's span: 12 m over flat ground from the origin along +x, sagging 0.9 m */
const ORIGIN = BRIDGE_SPANS.specimen;
const FLAT = (): number => 0;
/** each placement's builder, by its span (a `place` builds it for its group; its colliders and the world's chain read the same one) */
const built = new WeakMap<RopeBridgeSpec, RopeBridgeBuilder>();

function builderOf(sky: Sky, p: RopeBridgeParams, fresh: boolean): RopeBridgeBuilder {
  let b = built.get(p.span);
  // SF63: the span outlives a world, its group does not. A grid region that leaves disposes its scene tree (sceneOwnership
  // clears the group and frees its geometry), and the next world built on the same span was handed that empty group: no
  // bridge in the cell. A builder whose group was emptied is stale; the new world builds its own
  if (b?.mesh.children.length === 0) b = undefined;
  if (!b || fresh) { b = new RopeBridgeBuilder(sky, p.span, p.ground).build(); if (p.span !== ORIGIN) built.set(p.span, b); }
  return b;
}

/** the bridge on a span: its builder (the drawn group, the chain, the floor, the colliders) — built on the first ask */
export function ropeBridgeLayout(sky: Sky, p: RopeBridgeParams): RopeBridgeLayout { return builderOf(sky, p, false); }

export const ropeBridge = defineModel<RopeBridgeParams>({
  id: 'driftwood-isle/rope-bridge', name: 'Rope bridge', category: 'buildings', pipeline: 'code',
  file: 'src/shards/driftwood-isle/models/ropeBridge.ts', surface: 'planks',
  defaults: { span: ORIGIN, ground: FLAT },
  // the world's copy: the builder its layout made (it drives that group's deck); a specimen: a fresh one
  build: (ctx, p) => (p.span === ORIGIN ? builderOf(ctx.sky, p, true) : builderOf(ctx.sky, p, false)).mesh,
  colliders: (p, ctx) => builderOf(ctx.sky, p, false).descs,
});
