import * as THREE from 'three';
import { SHADOW_LAYER } from '../core/shadowLayer';
import { markGpuOnly } from '../core/gpuOnly';

/**
 * The far herd: every animal past TIER_CONFIG.animalFarBatchDist drawn in ONE draw per model (a kind:variant: its own
 * coat), PINE-HOLLOW-REMASTER PH-P2. Past animalOneDrawDist a rig is already one draw (its whole body in its fur material,
 * Animal.setDrawLod), and ~100 of them at 150–400 m were 90–120 of the desktop's draws at the gate and the lookout. A batch
 * is a SkinnedMesh whose geometry is `cap` copies of the model's geometry, copy `s` skinned by bones `s·B … s·B + B − 1`
 * of one big skeleton; each frame the slots point at the far animals' own bones (the ones their rigs pose), so every animal keeps
 * its gait, its yaw, its scale and its death. The per-animal coat tint (AnimalFactory.instantiate: the fur material's
 * colour) is baked into the copy's vertex colours, which the fur shader multiplies by the same colour term — the
 * batch's material is the model's fur, patched and set up exactly as a rig's (one program, the rigs' own), in white.
 *
 * The math is three's attached-bind skinning: a rig draws Σ w · bone.matrixWorld · boneInverse · bindMatrix · v (its
 * model matrix and bindMatrixInverse cancel), so a batch at the origin with an identity bind matrix draws the same
 * world-space vertices. Rigs bound with a non-identity bind matrix, fading carcasses and thralls (their shader reads
 * the material colour) stay single rigs. A freed slot is skinned to a zero-scale bone (its triangles collapse to a
 * point); the slots are kept packed (the top member moves into a hole) and the draw range ends at the last one.
 *
 * Desktop (tier.ts animalHullBatch) also takes Pine Hollow's generated hulls at every distance: one group, no fur shells,
 * no draw LOD, so the batch is their pixels near as far. It culls by bearing (begin), so it can hold a few rigs three's
 * frustum test would have skipped (below the view's bottom edge): vertex work only.
 *
 * `{ shadow: true }` makes the shadow herd instead: the same batching for the animals that cast (within
 * animalShadowDist), drawn only into the sun's shadow maps (SHADOW_LAYER; its material is the model's fur, whose depth
 * variant is the rigs' own skinned depth program) — one shadow draw per hull per cascade instead of one per animal. It
 * carries only the attributes that program reads, and its bounding sphere follows its members, so a cascade that none of
 * them can shadow skips it (cascadeCull.ts).
 */

/** what a batch needs from an animal */
export interface FarMember {
  readonly mesh: THREE.SkinnedMesh;
  /** the rig's fur colour (the per-animal tint): read live, a later tint (a thrall's moss) follows */
  readonly tint: THREE.Color;
}

/**
 * The attributes the shadow herd keeps: the depth pass's (position, skinning) and the ones its program is keyed on — the
 * depth material takes the caster material's map (WebGLShadowMap.getDepthMaterial), so the rigs' skinned depth program
 * reads uv; the same attributes and the model's own fur keep it the rigs' program, not a new one
 */
const SHADOW_ATTRS = new Set(['position', 'normal', 'uv', 'skinIndex', 'skinWeight']);

const _idle = new THREE.Bone();
_idle.scale.setScalar(0);
_idle.updateMatrixWorld(true);
const _ident = new THREE.Matrix4();
const _v = new THREE.Vector3();

class FarBatch {
  readonly mesh: THREE.SkinnedMesh;
  private readonly bones: number;
  private readonly verts: number;
  private readonly indices: number;
  private cap = 0;
  private owners: (FarMember | null)[] = [];
  private readonly slotOf = new Map<FarMember, number>();
  private pending: FarMember[] = [];
  private readonly seen = new Set<FarMember>();
  /** per slot: the tint its colours were written with (r, g, b) */
  private tints = new Float32Array(0);
  /** the members' bounds this frame (the shadow herd's culling sphere) */
  private readonly bounds = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();

  constructor(private readonly src: THREE.BufferGeometry, material: THREE.Material, bones: number, private readonly shadow: boolean) {
    this.bones = bones;
    this.verts = src.getAttribute('position').count;
    const index = src.getIndex();
    this.indices = index === null ? this.verts : index.count;
    this.mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), material);
    this.mesh.name = shadow ? 'herd-shadow' : 'far-herd';
    // the view batch: the slots move every frame, the manager culls per animal; the shadow batch: a sphere round its members
    this.mesh.frustumCulled = shadow;
    this.mesh.castShadow = shadow;   // the view batch: past animalShadowDist, no animal casts there
    this.mesh.receiveShadow = !shadow;
    if (shadow) this.mesh.layers.set(SHADOW_LAYER);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.raycast = () => { /* never a hit target: the rigs' hitboxes are */ };
    // never left null: SkinnedMesh.computeBoundingSphere would skin every slot on the CPU (the boot's precompile clones, a
    // frustum test) — and the view batch's CPU copies are gone after upload
    this.mesh.boundingSphere = shadow ? this.sphere : new THREE.Sphere(new THREE.Vector3(), Infinity);
    this.mesh.boundingBox = new THREE.Box3(new THREE.Vector3(-Infinity, -Infinity, -Infinity), new THREE.Vector3(Infinity, Infinity, Infinity));
    this.mesh.visible = false; // until its first members
    this.grow(8);
  }

  add(m: FarMember, position: THREE.Vector3, radius: number): void {
    if (this.pending.length === 0) this.bounds.makeEmpty();
    this.pending.push(m);
    this.bounds.expandByPoint(_v.set(position.x - radius, position.y - radius, position.z - radius));
    this.bounds.expandByPoint(_v.set(position.x + radius, position.y + radius * 2, position.z + radius));
  }

  /** place this frame's members: a member keeps its slot while it stays; new ones take the lowest free slot */
  flush(): void {
    const seen = this.seen;
    seen.clear();
    for (const m of this.pending) seen.add(m);
    for (let s = 0; s < this.cap; s++) {
      const o = this.owners[s];
      if (o !== null && o !== undefined && !seen.has(o)) this.free(s);
    }
    for (const m of this.pending) {
      const at = this.slotOf.get(m);
      if (at !== undefined) {
        const t = m.tint, k = at * 3;
        if (!this.shadow && (this.tints[k] !== t.r || this.tints[k + 1] !== t.g || this.tints[k + 2] !== t.b)) this.paint(at, m); // re-tinted
        continue;
      }
      let s = this.owners.indexOf(null);
      if (s < 0) { s = this.cap; this.grow(Math.ceil(this.cap * 1.5)); }
      this.assign(s, m);
    }
    if (this.shadow && this.pending.length > 0) this.mesh.boundingSphere = this.bounds.getBoundingSphere(this.sphere);
    this.pending = [];
    // keep the slots packed (the draw range skins every slot up to the last used one): the highest member moves down
    for (let lo = 0, hi = this.cap - 1; ; lo++, hi--) {
      while (lo < this.cap && this.owners[lo] !== null) lo++;
      while (hi >= 0 && this.owners[hi] === null) hi--;
      const m = this.owners[hi];
      if (lo >= hi || m === null || m === undefined) break;
      this.free(hi);
      this.assign(lo, m);
    }
    let last = -1;
    for (let s = this.cap - 1; s >= 0; s--) if (this.owners[s] !== null) { last = s; break; }
    this.mesh.geometry.setDrawRange(0, (last + 1) * this.indices);
    this.mesh.visible = last >= 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.skeleton.dispose();
  }

  private free(s: number): void {
    const o = this.owners[s];
    if (o !== null && o !== undefined) this.slotOf.delete(o);
    this.owners[s] = null;
    const bones = this.mesh.skeleton.bones;
    for (let j = 0; j < this.bones; j++) bones[s * this.bones + j] = _idle;
  }

  private assign(s: number, m: FarMember): void {
    this.owners[s] = m;
    this.slotOf.set(m, s);
    const sk = this.mesh.skeleton, rig = m.mesh.skeleton, B = this.bones;
    for (let j = 0; j < B; j++) {
      sk.bones[s * B + j] = rig.bones[j] ?? _idle;
      const inv = sk.boneInverses[s * B + j], rigInv = rig.boneInverses[j];
      if (inv !== undefined && rigInv !== undefined) inv.copy(rigInv);
    }
    if (!this.shadow) this.paint(s, m);
  }

  /** the tint: the source's vertex colours × the rig's fur colour (the batch's material is white) */
  private paint(s: number, m: FarMember): void {
    const t = m.tint;
    this.tints[s * 3] = t.r; this.tints[s * 3 + 1] = t.g; this.tints[s * 3 + 2] = t.b;
    const col = this.mesh.geometry.getAttribute('color');
    const srcCol = this.src.getAttribute('color');
    if (col instanceof THREE.BufferAttribute && col.array instanceof Float32Array) {
      const n = srcCol.itemSize, base = s * this.verts;
      for (let i = 0; i < this.verts; i++) {
        col.setXYZ(base + i, srcCol.getX(i) * t.r, srcCol.getY(i) * t.g, srcCol.getZ(i) * t.b);
        if (n === 4) col.setW(base + i, srcCol.getW(i));
      }
      col.addUpdateRange(base * n, this.verts * n);
      col.needsUpdate = true;
    }
  }

  /** (re)build the geometry and the skeleton for `cap` slots, keeping every member in its slot */
  private grow(cap: number): void {
    const { src, verts, indices, bones: B } = this;
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(src.attributes)) {
      if (this.shadow && !SHADOW_ATTRS.has(name)) continue;
      if (!(a instanceof THREE.BufferAttribute)) throw new Error(`farHerd: attribute '${name}' is interleaved`);
      const n = a.itemSize;
      if (name === 'skinIndex') {
        const arr = new Uint16Array(cap * verts * n);
        for (let s = 0; s < cap; s++) for (let i = 0; i < verts * n; i++) arr[s * verts * n + i] = (a.array[i] ?? 0) + s * B;
        g.setAttribute(name, new THREE.BufferAttribute(arr, n));
      } else if (name === 'color') {
        g.setAttribute(name, new THREE.BufferAttribute(new Float32Array(cap * verts * n), n)); // filled per slot (assign)
      } else {
        const Ctor = a.array.constructor as new (length: number) => THREE.TypedArray;
        const arr = new Ctor(cap * verts * n);
        for (let s = 0; s < cap; s++) arr.set(a.array, s * verts * n);
        g.setAttribute(name, new THREE.BufferAttribute(arr, n, a.normalized));
      }
    }
    const idx = new Uint32Array(cap * indices);
    const srcIdx = src.getIndex();
    for (let s = 0; s < cap; s++) for (let i = 0; i < indices; i++) idx[s * indices + i] = (srcIdx === null ? i : srcIdx.getX(i)) + s * verts;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    if (!this.shadow) {
      // the view batch's static buffers (all but the colours, which each new member rewrites) live on the GPU only: tens of
      // MB of copies on the desktop. A lost context reloads the page (gpuOnly.ts) instead of restoring in place.
      for (const [name, a] of Object.entries(g.attributes)) if (name !== 'color' && a instanceof THREE.BufferAttribute) a.onUpload(release);
      g.getIndex()?.onUpload(release);
    }
    const bones: THREE.Bone[] = [], inverses: THREE.Matrix4[] = [];
    for (let i = 0; i < cap * B; i++) { bones.push(_idle); inverses.push(new THREE.Matrix4()); }
    const old = this.mesh.geometry, oldSkeleton = this.cap > 0 ? this.mesh.skeleton : null;
    this.mesh.geometry = g;
    this.mesh.bind(new THREE.Skeleton(bones, inverses), _ident);
    old.dispose();
    oldSkeleton?.dispose();
    const owners = this.owners;
    this.cap = cap;
    this.tints = new Float32Array(cap * 3);
    this.owners = Array.from({ length: cap }, (): FarMember | null => null);
    this.slotOf.clear();
    for (const [s, o] of owners.entries()) if (o !== null) this.assign(s, o);
  }
}

const _dir = new THREE.Vector3();

/** BufferAttribute.onUpload: drop the CPU copy (the count stays; nothing reads it again) */
function release(this: THREE.BufferAttribute): void {
  const Ctor = this.array.constructor as new (length: number) => THREE.TypedArray;
  this.array = new Ctor(0);
}

export class FarHerd<M extends FarMember = FarMember> {
  readonly group = new THREE.Group();
  /** per batch key (keyOf): its batch, or null when it cannot be batched (no material / no vertex colours) */
  private readonly batches = new Map<object, FarBatch | null>();
  /** the view's azimuth / pitch and its half-width at the horizon (rad), from begin(); cull = false: every far animal */
  private cull = false;
  private yaw = 0;
  private halfW = 0;
  private readonly eye = new THREE.Vector3();

  /**
   * `materialFor(m)` is m's model's white fur (AnimalFactory.farMaterial), made once per model; null = never batched
   */
  /**
   * `opts.keyOf`: what one batch holds — the view herd's is the member's model (a variant: its own coat atlas on a hull
   * geometry the species' other variants share), the shadow herd's the geometry (depth is the same whatever the coat)
   */
  constructor(private readonly materialFor: (m: M) => THREE.Material | null, private readonly opts: { shadow?: boolean; keyOf?: (m: M) => object } = {}) {
    this.group.name = opts.shadow === true ? 'herd-shadow' : 'far-herd';
  }

  /**
   * Start a frame. `camera`: the view; a far animal outside its horizontal field of view (+ a margin) is not drawn at all,
   * as three's frustum test would not draw its rig. The test is by azimuth only — a far animal's reflection in the pond
   * sits at its own bearing — and is off when the view pitches past 25° (then the horizon's edges are not a vertical
   * line). Without a camera every far animal is drawn.
   */
  begin(camera: THREE.PerspectiveCamera | null): void {
    this.cull = false;
    if (camera === null) return;
    camera.getWorldDirection(_dir);
    const pitch = Math.asin(THREE.MathUtils.clamp(_dir.y, -1, 1));
    if (Math.abs(pitch) > THREE.MathUtils.degToRad(25)) return;
    camera.getWorldPosition(this.eye);
    this.yaw = Math.atan2(_dir.x, _dir.z);
    const tanHalfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom;
    // the horizon's half-width, widened by 1 / cos(pitch) (a pitched view's horizon row spans more azimuth) and 8° of margin
    this.halfW = Math.atan((tanHalfV * camera.aspect) / Math.cos(pitch)) + THREE.MathUtils.degToRad(8);
    this.cull = true;
  }

  /** true = `m` is drawn by (or culled with) the far herd this frame: hide its rig. false = draw the rig itself */
  take(m: M, position: THREE.Vector3, radius: number): boolean {
    const mesh = m.mesh;
    if (mesh.bindMode !== THREE.AttachedBindMode || !mesh.bindMatrix.equals(_ident)) return false;
    const key = this.opts.keyOf?.(m) ?? mesh.geometry;
    let b = this.batches.get(key);
    if (b === undefined) {
      const shadow = this.opts.shadow === true;
      const mat = shadow || mesh.geometry.hasAttribute('color') ? this.materialFor(m) : null;
      b = mat === null ? null : new FarBatch(mesh.geometry, mat, mesh.skeleton.bones.length, shadow);
      if (b !== null && !shadow) markGpuOnly('the far herd');
      this.batches.set(key, b);
      if (b !== null) this.group.add(b.mesh);
    }
    if (b === null) return false;
    if (this.cull) {
      const dx = position.x - this.eye.x, dz = position.z - this.eye.z;
      const d = Math.hypot(dx, dz);
      let da = Math.abs(Math.atan2(dx, dz) - this.yaw);
      if (da > Math.PI) da = 2 * Math.PI - da;
      if (d > radius && da - Math.asin(Math.min(1, radius / d)) > this.halfW) return true; // outside the view: not drawn
    }
    b.add(m, position, radius);
    return true;
  }

  end(): void { for (const b of this.batches.values()) b?.flush(); }

  dispose(): void { for (const b of this.batches.values()) b?.dispose(); this.batches.clear(); }
}
