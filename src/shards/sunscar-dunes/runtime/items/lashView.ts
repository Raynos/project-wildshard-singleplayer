import type { CordStyle } from '../../data/whip';
import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Vector3 } from 'three';

/**
 * The lash item's view (SHARD-PLATFORM SF72, a declared item view beside `./lash`, the item's runtime): a braided cord
 * that unrolls along a moving curve. The cord's rings and braid, every coil's tube and the plait tile a held coil wears
 * are baked offline (`generators/lash.ts`); a shard declares the look as rows (`CordStyle`, `PlaitStyle`).
 */

/** The thrown cord: one braided tube whose rings are rewritten along a moving curve (no per-frame allocation). */
export class LashCord {
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly positions: Float32Array | null;
  private readonly point = new Vector3(); private readonly next = new Vector3();
  private readonly side = new Vector3(); private readonly up = new Vector3(); private readonly tangent = new Vector3();
  /** `geometry`: the cord's baked rings and braid (`generators/lash.ts` cordGeometry), its own copy; null (its bake did not load): an undrawn cord. */
  constructor(private readonly style: CordStyle, geometry: BufferGeometry | null) {
    const position = geometry?.getAttribute('position'), positions = position instanceof BufferAttribute && position.array instanceof Float32Array ? position.array : null;
    if (geometry !== null && positions?.length !== (style.segments + 1) * style.radial * 3) throw new Error('lash cord: baked rings do not match its style');
    this.positions = positions;
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: style.emissive }); material.roughness = style.roughness;
    this.mesh = new Mesh(geometry ?? new BufferGeometry(), material);
    this.mesh.visible = false;
  }
  /**
   * Lays the cord from `from` towards `to` (camera space). `ext` 0 → 1 unrolls it; `wave` is the travelling S-curve's
   * height, which dies out as it straightens. A thong as thick as a handle's keeper tapering fast into the thin fall, and
   * a frayed popper that stays a few pixels wide far out.
   */
  shape(from: Vector3, to: Vector3, ext: number, wave: number, time: number): void {
    if (this.positions === null) return;
    const { segments, radial } = this.style, length = from.distanceTo(to);
    this.tangent.subVectors(to, from).normalize();
    this.side.set(1, 0, 0).cross(this.tangent).normalize(); this.up.crossVectors(this.tangent, this.side).normalize();
    for (let s = 0; s <= segments; s++) {
      const u = s / segments, along = u * length * ext;
      const lift = Math.sin(u * Math.PI) * wave * (1 - ext * 0.7) + Math.sin(u * 9 - time * 40) * wave * 0.25 * u;
      this.point.copy(from).addScaledVector(this.tangent, along).addScaledVector(this.side, lift).addScaledVector(this.up, -Math.sin(u * 3.1) * 0.05 * length * (1 - ext));
      const radius = 0.0045 * (1 - u) ** 2.5 + 0.0022 + (u > 0.93 ? 0.002 : 0);
      for (let r = 0; r < radial; r++) {
        const a = (r / radial) * Math.PI * 2;
        this.next.copy(this.point).addScaledVector(this.side, Math.cos(a) * radius).addScaledVector(this.up, Math.sin(a) * radius);
        const at = (s * radial + r) * 3;
        this.positions[at] = this.next.x; this.positions[at + 1] = this.next.y; this.positions[at + 2] = this.next.z;
      }
    }
    const position = this.mesh.geometry.getAttribute('position');
    position.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals(); this.mesh.geometry.computeBoundingSphere();
  }
}
