import type { CordStyle, PlaitStyle } from '../../data/whip';
import { BufferAttribute, BufferGeometry, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType, Vector3 } from 'three';

/**
 * The lash item's view (SHARD-PLATFORM SF72, a declared item view beside `./lash`, the item's runtime): a braided cord
 * that unrolls along a moving curve, and the plait tile a held coil wears. The cord's rings and braid, and every coil's
 * tube, are baked offline (`generators/lash.ts`); a shard declares the look as rows (`CordStyle`, `PlaitStyle`).
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

/**
 * The plait's tile, made in code: strand columns round the cord, each leaning 45 deg the other way from its neighbour, so
 * the strands meet in the chevrons a plaited thong shows. Each strand is a raised lozenge (a crown, dark creases between);
 * the normal map carries that relief and the roughness map puts a sheen on the crowns only.
 */
export function plaitTextures(p: PlaitStyle): { map: DataTexture; normal: DataTexture; rough: DataTexture } {
  const n = p.size, h = new Float32Array(n * n), tone = new Float32Array(n * n);
  const hash = (a: number, b: number): number => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const v = (y + 0.5) / n * p.columns, col = Math.floor(v), cv = v - col, lean = col % 2 === 0 ? 1 : -1;
    const q = (x + 0.5) / n * p.rows + lean * cv, row = Math.floor(q), across = q - row;
    // the strand's width profile (round crown, creased edges) times its fall-off into the column's spine
    const crown = Math.sin(Math.PI * across) ** 0.7 * Math.sin(Math.PI * cv) ** 0.35;
    h[y * n + x] = crown; tone[y * n + x] = hash(row + 17 * col, col * 3.1); // each strand a little lighter or darker
  }
  const map = new Uint8Array(n * n * 4), nor = new Uint8Array(n * n * 4), rough = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = y * n + x, c = h[i] ?? 0, t = tone[i] ?? 0.5;
    const dx = (h[y * n + (x + 1) % n] ?? 0) - (h[y * n + (x + n - 1) % n] ?? 0), dy = (h[((y + 1) % n) * n + x] ?? 0) - (h[((y + n - 1) % n) * n + x] ?? 0);
    const k = Math.min(1, Math.max(0, c)), base = 0.55 + 0.45 * k, w = 0.85 + 0.3 * t;
    map[i * 4] = Math.round(Math.min(255, (p.crease[0] + p.crown[0] * base * k) * w)); map[i * 4 + 1] = Math.round(Math.min(255, (p.crease[1] + p.crown[1] * base * k) * w));
    map[i * 4 + 2] = Math.round(Math.min(255, (p.crease[2] + p.crown[2] * base * k) * w)); map[i * 4 + 3] = 255;
    const s = p.relief, nx = -dx * s, ny = -dy * s, l = Math.hypot(nx, ny, 1);
    nor[i * 4] = Math.round(255 * (0.5 + 0.5 * nx / l)); nor[i * 4 + 1] = Math.round(255 * (0.5 + 0.5 * ny / l)); nor[i * 4 + 2] = Math.round(255 * (0.5 + 0.5 / l)); nor[i * 4 + 3] = 255;
    rough[i * 4 + 1] = Math.round(255 * (p.rough[0] - p.rough[1] * k * k)); rough[i * 4 + 3] = 255;
  }
  const tex = (data: Uint8Array, srgb: boolean): DataTexture => {
    const t = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType);
    t.wrapS = RepeatWrapping; t.wrapT = RepeatWrapping; t.magFilter = LinearFilter; t.minFilter = LinearMipmapLinearFilter;
    t.generateMipmaps = true; t.anisotropy = 4; if (srgb) t.colorSpace = SRGBColorSpace; t.needsUpdate = true;
    return t;
  };
  return { map: tex(map, true), normal: tex(nor, false), rough: tex(rough, false) };
}
