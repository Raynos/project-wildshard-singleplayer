import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A moored hull's lines as rows (SHARD-PLATFORM M3): each line a sagging tube from a cleat on the hull to a post on the
 * shore, in world space (ONE static mesh beside the hull, so the post ends never bob), flat vertex-coloured for the
 * low-poly kit's material. Every vertex remembers its rest height, which line it is on and how far along it lies (1 at
 * the cleat, 0 at the post), so `lift` raises each cleat end with the hull's heave and pitch while the post end stays
 * tied. Nothing here knows a shard: its numbers are a row in its `data/`, the hull, cleats and posts are its own.
 *
 *   const lines = new MooringLines(row, cleats, posts, waterY, cleatZ, material);
 *   scene.add(lines.mesh);
 *   lines.lift(hull.position.y - waterY, Math.sin(hull.rotation.x));   // after the hull rides the swell
 */

/** Mooring lines' numbers as data. */
export interface MooringLinesRow {
  /** the rope's colour, its post end's height over the still water (m), the sag at the middle (m), the tube's length
   *  segments, radius (m) and radial segments */
  readonly color: string;
  readonly postAbove: number;
  readonly sag: number;
  readonly segments: number;
  readonly radius: number;
  readonly radial: number;
}

/** A post a line is tied to (world xz). */
export interface MooringPost { x: number; z: number }

/** A hull's mooring lines (one draw). */
export class MooringLines {
  /** the lines: add it to the scene beside the hull */
  readonly mesh: THREE.Mesh;
  private readonly rest: Float32Array;
  private readonly weight: Float32Array;
  private readonly which: Uint8Array;
  private readonly cleatZ: readonly number[];
  private readonly cleatDy: number[];

  /** `cleats[i]` (world) ties to `posts[i]`; `cleatZ[i]` is that cleat's hull-local z (pitch lifts it by −z · sin). */
  constructor(row: MooringLinesRow, cleats: readonly THREE.Vector3[], posts: readonly MooringPost[], waterY: number, cleatZ: readonly number[], material: THREE.Material) {
    const color = new THREE.Color(row.color);
    const parts: THREE.BufferGeometry[] = [];
    posts.forEach((post, i) => {
      const a = cleats[i];
      if (a === undefined) return;
      const b = new THREE.Vector3(post.x, waterY + row.postAbove, post.z);
      const mid = a.clone().lerp(b, 0.5); mid.y -= row.sag;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const g = new THREE.TubeGeometry(curve, row.segments, row.radius, row.radial, false);
      g.deleteAttribute('uv'); g.deleteAttribute('normal');
      const ni = g.toNonIndexed(); const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { c[k * 3] = color.r; c[k * 3 + 1] = color.g; c[k * 3 + 2] = color.b; }
      ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
      parts.push(ni);
    });
    const geo = mergeGeometries(parts, false);
    const rp = geo.getAttribute('position');
    this.rest = new Float32Array(rp.array);
    this.weight = new Float32Array(rp.count);
    this.which = new Uint8Array(rp.count);
    const perLine = rp.count / parts.length;
    for (let k = 0; k < rp.count; k++) {
      const which = Math.min(parts.length - 1, Math.floor(k / perLine)), a = cleats[which], post = posts[which];
      if (a === undefined || post === undefined) continue;
      const dx = post.x - a.x, dz = post.z - a.z, len2 = dx * dx + dz * dz || 1;
      const t = Math.min(1, Math.max(0, ((rp.getX(k) - a.x) * dx + (rp.getZ(k) - a.z) * dz) / len2));
      this.weight[k] = 1 - t; this.which[k] = which;
    }
    this.cleatZ = cleatZ;
    this.cleatDy = cleatZ.map(() => 0);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.castShadow = true;
  }

  /** Lift each line's cleat end by the hull's heave (m over the still water) less its cleat's z times sin(pitch). */
  lift(heave: number, sinPitch: number): void {
    for (let i = 0; i < this.cleatDy.length; i++) this.cleatDy[i] = heave - (this.cleatZ[i] ?? 0) * sinPitch;
    const pos = this.mesh.geometry.getAttribute('position');
    if (!(pos instanceof THREE.BufferAttribute) || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array, rest = this.rest;
    for (let k = 0; k < this.weight.length; k++) arr[k * 3 + 1] = (rest[k * 3 + 1] ?? 0) + (this.cleatDy[this.which[k] ?? 0] ?? 0) * (this.weight[k] ?? 0);
    pos.needsUpdate = true;
  }
}
