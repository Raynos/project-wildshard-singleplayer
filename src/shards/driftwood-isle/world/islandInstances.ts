/**
 * G144 (E435): the Blender island's placements drawn instanced (./BlenderIsland.ts), the only path since Jake's G173 pick
 * (E450) retired the merged tile meshes. Those held a world-space copy of every vertex of every placement (103.7 MB of
 * GPU vertex data on the desktop tier); here each prototype is uploaded once and each tile
 * set (the casters, the small cover, the big cover) draws one InstancedMesh per prototype it places, with a row per
 * placement: its matrix, its tint (the merged path's Uint8 rounding, reproduced in the vertex shader) and, for the cover,
 * its edge (`aEdge`), base (`aBase`) and ground colour (`aGround`) — the attributes the cover's fade reads.
 *
 * The tiles stay, as the unit the reach and the view are decided in: each mesh's rows are kept sorted by tile, and when a
 * tile changes state (a caster tile crossing LOD_D swaps its near copies for its far ones; a cover tile coming within its
 * reach, or into view) every mesh with rows in that tile repacks its instance buffer: the shown tiles' rows copied to the
 * front, `count` set, the written range uploaded. A cover tile out of the camera's view is not packed (the cover casts no
 * shadow). A caster tile is packed when its box is in the camera's view or its sphere in any cascade's culling frustum
 * (cascadeCull.ts's slice footprint), so no shadow is lost (the boxes are padded for the frame the shadow frusta lag):
 * the in-view tiles' rows first, then the shadow-only ones. Each draw picks its prefix (`count`, set in the mesh's
 * onBeforeRender / onBeforeShadow): the camera draws the in-view rows; a cascade draws them all, or nothing when none of
 * the mesh's packed tiles reaches its slice. No multi-draw, no BatchedMesh (E271 / E272).
 *
 * Every mesh is visible from the first frame (count 0 draws nothing), so every buffer uploads at the boot and none on
 * first sight (E186); the repacks upload only the rows they wrote.
 */
import * as THREE from 'three';

/** a prototype as BlenderIsland loads it: positions in the prototype's frame, Uint8 RGBA (alpha: the Cycles AO), index */
export interface InstProto { readonly pos: Float32Array; readonly col: Uint8Array; readonly index: Uint32Array }

export interface TileRect { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }

/** one tile set (the merged path drew a mesh per tile) */
export interface InstanceSetSpec {
  readonly tag: string;
  /** per tile: the placements it holds (indices into placements.bin) */
  readonly tiles: readonly (readonly number[])[];
  readonly rects: readonly TileRect[];
  readonly material: THREE.Material;
  readonly cast: boolean;
  /** 0 for the casters (each tile draws its near copies within `lod` m, its far ones past it); else the cover's reach */
  readonly reach: number;
  readonly lod: number;
  /** the cover's per-plant attributes */
  readonly cover: boolean;
}

/** which copies a mesh draws: a prototype with no far copy draws whatever the reach */
type Role = 'both' | 'near' | 'far';

interface Batch {
  readonly mesh: THREE.InstancedMesh;
  readonly role: Role;
  readonly proto: number;
  /** its attributes: the GPU arrays the repack writes, and the source rows (sorted by tile) it copies from */
  readonly attrs: { readonly gpu: THREE.InstancedBufferAttribute; readonly src: Float32Array | Uint8Array; readonly size: number }[];
  /** per tile of its set: the first source row and how many */
  readonly start: Int32Array;
  readonly count: Int32Array;
  /** the tiles it has rows in, ascending */
  readonly tiles: number[];
  dirty: boolean;
  /** packed rows: the in-view tiles' (the camera's prefix) and all of them (the cascades'), and the cascades they reach */
  viewRows: number;
  allRows: number;
  mask: number;
}

interface SetState {
  readonly spec: InstanceSetSpec;
  readonly batches: Batch[];
  readonly tileBatches: Batch[][];
  readonly boxes: THREE.Box3[];
  /** per tile: 0 not drawn, 1 near (or shown), 2 far, +2 for a shadow-only caster tile; 255 before the first update */
  readonly state: Uint8Array;
  /** per caster tile: the cascades whose slice its sphere reaches (bit i: csm.lights[i]) */
  readonly masks: Uint8Array;
  readonly spheres: THREE.Sphere[];
}

/** a placement's own edge in the cover's reach (0..1): a hash of where it stands (BlenderIsland's, the same function) */
export const edgeOf = (x: number, z: number): number => { const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return h - Math.floor(h); };

/** m: the caster and cover tiles' boxes grow by this before the view test (the shadow frusta are a frame old) */
const PAD = 4;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _t = new THREE.Vector3();
const _pv = new THREE.Matrix4(), _box = new THREE.Box3();

/**
 * The instanced props material's vertex patch: the merged path baked `min(255, colour × tint)` into a Uint8 per vertex
 * (truncated); this does the same per instance, from the same Uint8 colour and the same f32 tint.
 */
export const TINT_VERTEX = {
  common: '#include <common>\nattribute float aTint;',
  color: `#include <color_vertex>
#ifdef USE_INSTANCING
	vColor.rgb = min( floor( floor( color.rgb * 255.0 + 0.5 ) * aTint ), vec3( 255.0 ) ) / 255.0;
#endif`,
};

export class IslandInstances {
  readonly sets: SetState[] = [];
  private readonly frustum = new THREE.Frustum();
  /** the camera and cascade lights of the last update (the draw hooks tell the camera's pass and each cascade's apart) */
  private camera: THREE.Camera | null = null;
  private lights: readonly THREE.DirectionalLight[] = [];
  stats = { meshes: 0, rows: 0, protoBytes: 0, instanceBytes: 0 };

  constructor(private readonly group: THREE.Group, private readonly protos: readonly (InstProto | undefined)[],
    private readonly names: readonly string[], private readonly f: Float32Array, private readonly lodOf: ReadonlyMap<number, number>) {}

  /** the meshes of one tile set (call in the merged path's order: casters, small cover, big cover) */
  add(spec: InstanceSetSpec): void {
    const n = spec.tiles.length, f = this.f;
    // pass 1: rows per (role, prototype) per tile
    const keyed = new Map<string, { role: Role; proto: number; perTile: number[][] }>();
    const push = (role: Role, proto: number, tile: number, i: number) => {
      const key = `${role}:${proto}`;
      let e = keyed.get(key);
      if (!e) { e = { role, proto, perTile: Array.from({ length: n }, () => []) }; keyed.set(key, e); }
      e.perTile[tile]?.push(i);
    };
    for (const [k, items] of spec.tiles.entries()) for (const i of items) {
      const pi = f[i * 10] ?? 0, lo = spec.reach > 0 ? pi : this.lodOf.get(pi) ?? pi;
      if (lo === pi) push('both', pi, k, i); else { push('near', pi, k, i); push('far', lo, k, i); }
    }
    const boxes = Array.from({ length: n }, () => new THREE.Box3());
    const state: SetState = { spec, batches: [], tileBatches: Array.from({ length: n }, () => []), boxes, state: new Uint8Array(n).fill(255), masks: new Uint8Array(n), spheres: Array.from({ length: n }, () => new THREE.Sphere()) };
    // pass 2: a mesh per (role, prototype), in a stable order (the role, then the prototype)
    const order: Role[] = ['both', 'near', 'far'];
    const entries = [...keyed.values()].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.proto - b.proto);
    for (const e of entries) {
      const pr = this.protos[e.proto];
      if (pr === undefined) continue;
      const rows = e.perTile.reduce((a, l) => a + l.length, 0);
      if (rows === 0) continue;
      const radius = protoRadius(pr);
      const geo = protoGeometry(pr);
      const mesh = new THREE.InstancedMesh(geo, spec.material, rows);
      mesh.name = `island-${spec.tag}-${e.role}-${this.names[e.proto] ?? e.proto}`;
      mesh.castShadow = spec.cast; mesh.receiveShadow = true;
      mesh.frustumCulled = false; // culled per tile by the repack
      mesh.count = 0;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const srcM = new Float32Array(rows * 16), srcTint = new Float32Array(rows);
      const srcEdge = spec.cover ? new Float32Array(rows) : null, srcBase = spec.cover ? new Float32Array(rows * 3) : null;
      const start = new Int32Array(n), count = new Int32Array(n), tiles: number[] = [];
      let r = 0;
      for (let k = 0; k < n; k++) {
        const items = e.perTile[k] ?? [];
        start[k] = r; count[k] = items.length;
        if (items.length > 0) tiles.push(k);
        for (const i of items) {
          const o = i * 10;
          _t.set(f[o + 1] ?? 0, f[o + 2] ?? 0, f[o + 3] ?? 0); _q.set(f[o + 4] ?? 0, f[o + 5] ?? 0, f[o + 6] ?? 0, f[o + 7] ?? 1);
          const sc = f[o + 8] ?? 1;
          _m.compose(_t, _q, _s.set(sc, sc, sc)).toArray(srcM, r * 16);
          srcTint[r] = f[o + 9] ?? 1;
          if (srcEdge) srcEdge[r] = edgeOf(_t.x, _t.z);
          if (srcBase) { srcBase[r * 3] = _t.x; srcBase[r * 3 + 1] = _t.y; srcBase[r * 3 + 2] = _t.z; }
          const box = boxes[k];
          if (box) box.union(_box.setFromCenterAndSize(_t, _s.setScalar(2 * radius * sc)));
          r++;
        }
      }
      const attr = (src: Float32Array | Uint8Array, size: number, name: string | null, normalized = false) => {
        const gpu = name === null ? mesh.instanceMatrix : new THREE.InstancedBufferAttribute(src.slice(), size, normalized);
        gpu.setUsage(THREE.DynamicDrawUsage);
        if (name !== null) geo.setAttribute(name, gpu);
        return { gpu, src, size };
      };
      const attrs = [attr(srcM, 16, null), attr(srcTint, 1, 'aTint')];
      if (srcEdge && srcBase) attrs.push(attr(srcEdge, 1, 'aEdge'), attr(srcBase, 3, 'aBase'), attr(new Uint8Array(rows * 4), 4, 'aGround', true));
      const batch: Batch = { mesh, role: e.role, proto: e.proto, attrs, start, count, tiles, dirty: true, viewRows: 0, allRows: 0, mask: 0 };
      mesh.onBeforeRender = (_renderer, _scene, camera) => { mesh.count = camera === this.camera ? batch.viewRows : batch.allRows; };
      mesh.onBeforeShadow = (_r, _o, _c, shadowCamera) => {
        const i = this.lights.findIndex((l) => l.shadow.camera === shadowCamera);
        mesh.count = i === -1 || (batch.mask >> i) & 1 ? batch.allRows : 0; // a light that is no cascade (a fade's ghost): all
      };
      state.batches.push(batch);
      for (const k of tiles) state.tileBatches[k]?.push(batch);
      this.group.add(mesh);
      this.stats.meshes++; this.stats.rows += rows;
      this.stats.protoBytes += pr.pos.byteLength * 2 + pr.col.byteLength + (geo.getIndex()?.array.byteLength ?? 0); // + its normals
      this.stats.instanceBytes += attrs.reduce((a, x) => a + x.src.byteLength, 0);
    }
    for (const [k, b] of boxes.entries()) if (!b.isEmpty()) { b.expandByScalar(PAD); b.getBoundingSphere(state.spheres[k] ?? new THREE.Sphere()); }
    this.sets.push(state);
  }

  /** E156: each cover plant's fade-out colour, from its base (`ground(x, z, out)` writes RGBA bytes) */
  fillGround(ground: (x: number, z: number, out: Uint8Array, o: number) => void): void {
    for (const s of this.sets) {
      if (!s.spec.cover) continue;
      for (const b of s.batches) {
        const base = b.attrs[3]?.src, gr = b.attrs[4]?.src;
        if (!(gr instanceof Uint8Array) || !(base instanceof Float32Array)) continue;
        for (let r = 0; r * 4 < gr.length; r++) ground(base[r * 3] ?? 0, base[r * 3 + 2] ?? 0, gr, r * 4);
        b.dirty = true;
      }
    }
  }

  /**
   * E156: each cover triangle's centre, ground / upright areas and colour, in world space, exactly as the merged tiles
   * held them (f32 positions, the truncated tinted Uint8 colour), in the merged path's order: tile by tile, each tile's
   * placements in order.
   */
  *coverTriangles(): Generator<{ ax: number; ay: number; az: number; bx: number; by: number; bz: number; dx: number; dy: number; dz: number; r: number; g: number; b: number }> {
    const f = this.f, e = _m.elements;
    const o = { ax: 0, ay: 0, az: 0, bx: 0, by: 0, bz: 0, dx: 0, dy: 0, dz: 0, r: 0, g: 0, b: 0 };
    const w = new Float32Array(9);
    for (const s of this.sets) {
      if (!s.spec.cover) continue;
      for (const items of s.spec.tiles) for (const i of items) {
        const pr = this.protos[f[i * 10] ?? 0];
        if (pr === undefined) continue;
        const k = i * 10, tint = f[k + 9] ?? 1, sc = f[k + 8] ?? 1;
        _t.set(f[k + 1] ?? 0, f[k + 2] ?? 0, f[k + 3] ?? 0); _q.set(f[k + 4] ?? 0, f[k + 5] ?? 0, f[k + 6] ?? 0, f[k + 7] ?? 1);
        _m.compose(_t, _q, _s.set(sc, sc, sc));
        const ch = (v: number, c: number) => Math.trunc(Math.min(255, (pr.col[v * 4 + c] ?? 0) * tint)) / 255;
        for (let t = 0; t + 2 < pr.index.length; t += 3) {
          for (let j = 0; j < 3; j++) {
            const v = pr.index[t + j] ?? 0, px = pr.pos[v * 3] ?? 0, py = pr.pos[v * 3 + 1] ?? 0, pz = pr.pos[v * 3 + 2] ?? 0;
            w[j * 3] = e[0] * px + e[4] * py + e[8] * pz + e[12];
            w[j * 3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
            w[j * 3 + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
          }
          o.ax = w[0] ?? 0; o.ay = w[1] ?? 0; o.az = w[2] ?? 0; o.bx = w[3] ?? 0; o.by = w[4] ?? 0; o.bz = w[5] ?? 0; o.dx = w[6] ?? 0; o.dy = w[7] ?? 0; o.dz = w[8] ?? 0;
          const a = pr.index[t] ?? 0, b = pr.index[t + 1] ?? 0, d = pr.index[t + 2] ?? 0;
          o.r = (ch(a, 0) + ch(b, 0) + ch(d, 0)) / 3; o.g = (ch(a, 1) + ch(b, 1) + ch(d, 1)) / 3; o.b = (ch(a, 2) + ch(b, 2) + ch(d, 2)) / 3;
          yield o;
        }
      }
    }
  }

  /**
   * Once a frame, with the camera posed (the late phase): each tile's state from the camera's distance to its rect and
   * its box against the view (and, for the casters, the cascades' shadow frusta); the meshes with rows in a tile that
   * changed repack.
   */
  update(camera: THREE.PerspectiveCamera, shadows: readonly THREE.DirectionalLight[]): void {
    this.camera = camera; this.lights = shadows;
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(_pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const cascades = shadows.map((l) => (l.castShadow ? l.shadow.getFrustum() : null));
    const cam = camera.position;
    for (const s of this.sets) {
      const { spec, boxes, state, masks, spheres, tileBatches } = s;
      for (let k = 0; k < spec.rects.length; k++) {
        const list = tileBatches[k], rect = spec.rects[k], box = boxes[k], sphere = spheres[k];
        if (list === undefined || list.length === 0 || rect === undefined || box === undefined || sphere === undefined) continue;
        const dx = Math.max(rect.x0 - cam.x, 0, cam.x - rect.x1), dz = Math.max(rect.z0 - cam.z, 0, cam.z - rect.z1), d = Math.hypot(dx, dz);
        let code: number;
        if (spec.reach > 0) code = d < spec.reach && this.frustum.intersectsBox(box) ? 1 : 0;
        else {
          let mask = 0;
          for (const [i, fr] of cascades.entries()) if (fr?.intersectsSphere(sphere) === true) mask += 1 << i;
          masks[k] = mask;
          const view = this.frustum.intersectsBox(box);
          code = !view && mask === 0 ? 0 : (d < spec.lod ? 1 : 2) + (view ? 0 : 2);
        }
        if (code === state[k]) continue;
        state[k] = code;
        for (const b of list) b.dirty = true;
      }
      for (const b of s.batches) {
        if (b.dirty) this.repack(b, state);
        if (spec.reach > 0) continue;
        let mask = 0;
        for (const k of b.tiles) if (included(b.role, state[k] ?? 0)) mask = orBits(mask, masks[k] ?? 0);
        b.mask = mask;
      }
    }
  }

  /** the shown tiles' rows to the front of the instance buffers (the in-view tiles' first); only the written range uploads */
  private repack(b: Batch, state: Uint8Array): void {
    b.dirty = false;
    let w = 0;
    for (const view of [true, false]) {
      for (const k of b.tiles) {
        const code = state[k] ?? 0;
        if (!included(b.role, code) || (code <= 2) !== view) continue;
        const r0 = b.start[k] ?? 0, n = b.count[k] ?? 0;
        for (const a of b.attrs) {
          const dst = a.gpu.array;
          if (dst instanceof Float32Array && a.src instanceof Float32Array) dst.set(a.src.subarray(r0 * a.size, (r0 + n) * a.size), w * a.size);
          else if (dst instanceof Uint8Array && a.src instanceof Uint8Array) dst.set(a.src.subarray(r0 * a.size, (r0 + n) * a.size), w * a.size);
        }
        w += n;
      }
      if (view) b.viewRows = w;
    }
    b.allRows = w;
    b.mesh.count = w;
    b.mesh.boundingSphere = null; // a raycast (the Explorer's picking) recomputes it over the packed rows
    if (w === 0) return;
    for (const a of b.attrs) { a.gpu.clearUpdateRanges(); a.gpu.addUpdateRange(0, w * a.size); a.gpu.needsUpdate = true; }
  }

  /** renderer.info-style counts of what the repack packed: meshes drawn and rows */
  packed(): { meshes: number; rows: number } {
    let meshes = 0, rows = 0;
    for (const s of this.sets) for (const b of s.batches) if (b.mesh.count > 0) { meshes++; rows += b.mesh.count; }
    return { meshes, rows };
  }
}

/** whether a mesh drawing `role` copies packs a tile in state `code` (1 / 3 near, 2 / 4 far; 3, 4 shadow-only) */
function included(role: Role, code: number): boolean {
  return code !== 0 && (role === 'both' || (role === 'near') === (code === 1 || code === 3));
}

/** the cascade masks' union (bit i: cascade i) */
function orBits(a: number, b: number): number { let out = 0; for (let i = 0; i < 8; i++) if (((a >> i) & 1) === 1 || ((b >> i) & 1) === 1) out += 1 << i; return out; }

function protoRadius(p: InstProto): number {
  let r2 = 0;
  for (let k = 0; k < p.pos.length; k += 3) r2 = Math.max(r2, (p.pos[k] ?? 0) ** 2 + (p.pos[k + 1] ?? 0) ** 2 + (p.pos[k + 2] ?? 0) ** 2);
  return Math.sqrt(r2);
}

/** one prototype's geometry: its positions, its Uint8 colour and index, normals for the CSM normal bias (as merged) */
function protoGeometry(p: InstProto): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p.pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(p.col, 4, true));
  const verts = p.pos.length / 3;
  geo.setIndex(new THREE.BufferAttribute(verts < 65536 ? Uint16Array.from(p.index) : p.index, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
