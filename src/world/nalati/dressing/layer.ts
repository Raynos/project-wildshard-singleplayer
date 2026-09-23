/**
 * DressLayer — one scatter kind (boulders, stones, junipers, lupins …) as ONE InstancedMesh: one draw call (+ one shadow
 * draw if it casts) for every placement on the shard.
 *
 *   const layer = new DressLayer('boulder', geometry, material, instances, { castShadow: true });
 *   scene.add(layer.mesh);
 *   layer.cull(frustum, viewer);     // NalatiDressing calls it when the view has changed
 *
 * Each instance carries its own draw distance (`far`, set by the placer: small things and the thinned-out share of a
 * drift go early, boulders late), so density falls off with distance instead of ending at one hard ring; over the
 * last 18 % of that distance the instance shrinks into the ground (its matrix is scaled about its foot), so nothing
 * pops. Instances are bucketed into 24 m cells once; a cull tests the cells (range + padded frustum), then copies the
 * live instances' matrices / colours into the front of the buffers. Everything within `keepNear` skips the frustum
 * test so its shadow still falls into view from behind the camera.
 */
import * as THREE from 'three';
import { smoothstep } from '../../../core/noise';

export interface Inst {
  x: number; y: number; z: number;
  yaw: number;
  sx: number; sy: number; sz: number;
  /** lean (radians) about x / z — rocks settling into a slope, a tilted clump */
  tiltX?: number; tiltZ?: number;
  /** metres: this instance's draw distance (before the tier scale) */
  far: number;
  /** linear RGB multiplier (instanceColor) */
  r: number; g: number; b: number;
}

const CELL = 24;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _sphere = new THREE.Sphere();

interface Cell { cx: number; cy: number; cz: number; r: number; far: number; idx: Int32Array }

export class DressLayer {
  readonly mesh: THREE.InstancedMesh;
  readonly count: number;
  private base: Float32Array;
  private colors: Float32Array;
  private pos: Float32Array;
  private far: Float32Array;
  private cells: Cell[] = [];
  private trisPer: number;

  constructor(
    readonly name: string,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    instances: Inst[],
    o: { castShadow?: boolean; receiveShadow?: boolean; farScale?: number; keepNear?: number } = {},
  ) {
    const n = this.count = instances.length;
    geometry.computeBoundingSphere();
    const gr = geometry.boundingSphere?.radius ?? 1;
    this.mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, n));
    this.mesh.name = `nalati-dress-${name}`;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = o.castShadow ?? false;
    this.mesh.receiveShadow = o.receiveShadow ?? true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.keepNear = o.keepNear ?? 26;
    this.trisPer = (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3;

    this.base = new Float32Array(n * 16);
    this.colors = new Float32Array(n * 3);
    this.pos = new Float32Array(n * 4);
    this.far = new Float32Array(n);
    const fs = o.farScale ?? 1;
    const buckets = new Map<number, number[]>();
    instances.forEach((it, i) => {
      _e.set(it.tiltX ?? 0, it.yaw, it.tiltZ ?? 0, 'YXZ');
      _m.compose(_p.set(it.x, it.y, it.z), _q.setFromEuler(_e), _s.set(it.sx, it.sy, it.sz));
      _m.toArray(this.base, i * 16);
      this.colors[i * 3] = it.r; this.colors[i * 3 + 1] = it.g; this.colors[i * 3 + 2] = it.b;
      this.pos[i * 4] = it.x; this.pos[i * 4 + 1] = it.y; this.pos[i * 4 + 2] = it.z; this.pos[i * 4 + 3] = gr * Math.max(it.sx, it.sy, it.sz);
      this.far[i] = it.far * fs;
      const k = (Math.floor(it.x / CELL) + 64) * 256 + (Math.floor(it.z / CELL) + 64);
      let b = buckets.get(k); if (!b) buckets.set(k, (b = []));
      b.push(i);
    });
    for (const [k, idx] of buckets) {
      const ix = Math.floor(k / 256) - 64, iz = (k % 256) - 64;
      let y0 = Infinity, y1 = -Infinity, far = 0, rr = 0;
      for (const i of idx) {
        const y = this.pos[i * 4 + 1] ?? 0; if (y < y0) y0 = y; if (y > y1) y1 = y;
        far = Math.max(far, this.far[i] ?? 0); rr = Math.max(rr, this.pos[i * 4 + 3] ?? 0);
      }
      this.cells.push({ cx: (ix + 0.5) * CELL, cy: (y0 + y1) / 2, cz: (iz + 0.5) * CELL, r: Math.hypot(CELL / 2, (y1 - y0) / 2, CELL / 2) + rr, far, idx: Int32Array.from(idx) });
    }
  }

  keepNear: number;
  /** instances drawn after the last cull */
  get visible(): number { return this.mesh.count; }
  get tris(): number { return this.mesh.count * this.trisPer; }
  get trisEach(): number { return this.trisPer; }

  cull(frustum: THREE.Frustum, viewer: THREE.Vector3): void {
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const col = this.mesh.instanceColor?.array as Float32Array | undefined;
    const base = this.base, colors = this.colors, pos = this.pos, far = this.far;
    const keep2 = this.keepNear * this.keepNear;
    let out = 0;
    for (const c of this.cells) {
      const dx = c.cx - viewer.x, dz = c.cz - viewer.z, dc2 = dx * dx + dz * dz;
      const reach = c.far + c.r;
      if (dc2 > reach * reach) continue;
      const near = dc2 < (this.keepNear + c.r) * (this.keepNear + c.r);
      if (!near) { _sphere.center.set(c.cx, c.cy, c.cz); _sphere.radius = c.r; if (!frustum.intersectsSphere(_sphere)) continue; }
      for (let j = 0; j < c.idx.length; j++) {
        const i = c.idx[j] ?? 0;
        const ex = (pos[i * 4] ?? 0) - viewer.x, ez = (pos[i * 4 + 2] ?? 0) - viewer.z, d2 = ex * ex + ez * ez;
        const f = far[i] ?? 0;
        if (d2 > f * f) continue;
        if (near && d2 > keep2) {
          _sphere.center.set(pos[i * 4] ?? 0, pos[i * 4 + 1] ?? 0, pos[i * 4 + 2] ?? 0); _sphere.radius = pos[i * 4 + 3] ?? 1;
          if (!frustum.intersectsSphere(_sphere)) continue;
        }
        const k = smoothstep(f, f * 0.82, Math.sqrt(d2));
        const o = out * 16, s = i * 16;
        for (let q = 0; q < 16; q++) arr[o + q] = base[s + q] ?? 0;
        if (k < 1) { for (let q = 0; q < 11; q++) if ((q & 3) !== 3) arr[o + q] = (arr[o + q] ?? 0) * k; }
        if (col) { col[out * 3] = colors[i * 3] ?? 1; col[out * 3 + 1] = colors[i * 3 + 1] ?? 1; col[out * 3 + 2] = colors[i * 3 + 2] ?? 1; }
        out++;
      }
    }
    this.mesh.count = out;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
