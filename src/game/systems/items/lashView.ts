import { BufferAttribute, BufferGeometry, CatmullRomCurve3, DataTexture, LinearFilter, LinearMipmapLinearFilter, Mesh, MeshStandardMaterial, RepeatWrapping, RGBAFormat, SRGBColorSpace, TubeGeometry, UnsignedByteType, Vector3 } from 'three';

/**
 * The lash item's view (SHARD-PLATFORM SF72, a declared item view beside `./lash`, the item's runtime): a braided cord
 * that unrolls along a moving curve, the plait painted as two strands in a spiral, and a held coil as a plaited tube with
 * a code-made plait tile. A shard declares the cord's look as rows (`CordStyle`, `PlaitStyle`, `CoilPath`); the meshes,
 * textures and paths come from here.
 */

export type CordRgb = readonly [number, number, number];
/** A cord's braid: its tube's segments and sides, the two strands' colours, and the pale popper at the tip. */
export interface CordStyle {
  readonly segments: number; readonly radial: number;
  readonly strandA: CordRgb; readonly strandB: CordRgb; readonly popper: CordRgb; readonly popperRings: number;
  /** The thrown cord's matte braid (`roughness`) and its warm self-light (`emissive`, hex). */
  readonly roughness: number; readonly emissive: number;
}
/** The plait tile (u along the cord, v round it): `size` texels a side, `columns` strands round, `rows` strands along. */
export interface PlaitStyle {
  readonly size: number; readonly columns: number; readonly rows: number;
  /** sRGB bytes: the creases' near-black and what the crown adds over them. */
  readonly crease: CordRgb; readonly crown: CordRgb;
  /** The normal map's relief, and the roughness from the creases (`rough[0]`) down by `rough[1]` on the crowns. */
  readonly relief: number; readonly rough: readonly [number, number];
}
/** A held coil: from the handle's top (`from`, at the ellipse angle `start`) round `turns` turns of an ellipse turned by `face`, each turn stepped by `step`, then the fall through `tail`. */
export interface CoilPath {
  readonly cord: number; readonly from: readonly [number, number, number]; readonly start: number; readonly rx: number; readonly ry: number; readonly face: number;
  readonly turns: number; readonly step: readonly [number, number, number]; readonly tail: readonly (readonly [number, number, number])[];
}

/** Paints a tube's rings with two strands laid in a spiral (the plait), so the braid reads without a texture; the last `popperRings` are the popper. */
export function braidColours(geometry: BufferGeometry, rings: number, sides: number, popperRings: number, a: CordRgb, b: CordRgb, popper: CordRgb): void {
  const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
  for (let v = 0; v < count; v++) {
    const i = Math.floor(v / sides), j = v % sides;
    const c = i >= rings - popperRings ? popper : (i * 2 + j) % 4 < 2 ? a : b;
    colors[v * 3] = c[0]; colors[v * 3 + 1] = c[1]; colors[v * 3 + 2] = c[2];
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
}

/** The thrown cord: one braided tube whose rings are rewritten along a moving curve (no per-frame allocation). */
export class LashCord {
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly positions: Float32Array;
  private readonly point = new Vector3(); private readonly next = new Vector3();
  private readonly side = new Vector3(); private readonly up = new Vector3(); private readonly tangent = new Vector3();
  constructor(private readonly style: CordStyle) {
    const geometry = new BufferGeometry(), { segments, radial } = style, rings = segments + 1;
    this.positions = new Float32Array(rings * radial * 3);
    const index: number[] = [];
    for (let s = 0; s < segments; s++) for (let r = 0; r < radial; r++) {
      const a = s * radial + r, b = s * radial + (r + 1) % radial, c = a + radial, d = b + radial;
      index.push(a, c, b, b, c, d);
    }
    geometry.setAttribute('position', new BufferAttribute(this.positions, 3));
    geometry.setIndex(index);
    braidColours(geometry, rings, radial, style.popperRings, style.strandA, style.strandB, style.popper);
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, emissive: style.emissive }); material.roughness = style.roughness;
    this.mesh = new Mesh(geometry, material);
    this.mesh.visible = false;
  }
  /**
   * Lays the cord from `from` towards `to` (camera space). `ext` 0 → 1 unrolls it; `wave` is the travelling S-curve's
   * height, which dies out as it straightens. A thong as thick as a handle's keeper tapering fast into the thin fall, and
   * a frayed popper that stays a few pixels wide far out.
   */
  shape(from: Vector3, to: Vector3, ext: number, wave: number, time: number): void {
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

/**
 * A held coil's centre line: the cord leaves the handle's top straight into the ellipse at `start`, turns counter-clockwise
 * as the camera sees it (up the right side, over the top, down the left), ends at its foot and drops through the fall, so
 * no stretch of cord crosses the coil's middle.
 */
export function coilPoints(c: CoilPath): Vector3[] {
  const [fx, fy, fz] = c.from, a0 = c.start;
  // the ellipse placed so its point at `start` is the handle's top (in the plane turned by `face`)
  const cx = fx - Math.cos(a0) * c.rx * Math.cos(c.face), cy = fy - Math.sin(a0) * c.ry, cz = fz - Math.cos(a0) * c.rx * Math.sin(c.face);
  const pts: Vector3[] = [], n = 40 * c.turns, sweep = Math.PI * 2 * c.turns - (a0 + Math.PI * 0.5);
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = a0 + t * sweep, k = t * (c.turns - 1);
    const wob = 1 - 0.04 * Math.sin(a * 3 + 0.7), ex = Math.cos(a) * c.rx * wob;
    pts.push(new Vector3(cx + ex * Math.cos(c.face) + c.step[0] * k, cy + Math.sin(a) * c.ry * wob + c.step[1] * k, cz + ex * Math.sin(c.face) + c.step[2] * k + Math.sin(a) * 0.05));
  }
  for (const q of c.tail) pts.push(new Vector3(q[0], q[1], q[2]));
  return pts;
}

/** A plaited cord along `pts`, `cord` thick: true UVs, the plait tile at 45 deg along it, matte, unfogged. */
export function plaitedCord(pts: Vector3[], cord: number, plait: PlaitStyle): Mesh<TubeGeometry, MeshStandardMaterial> {
  const curve = new CatmullRomCurve3(pts, false, 'centripetal'), length = curve.getLength();
  const geometry = new TubeGeometry(curve, 360, cord, 12, false);
  const { map, normal, rough } = plaitTextures(plait);
  const along = length / (plait.rows * (2 * Math.PI * cord) / plait.columns);
  for (const t of [map, normal, rough]) t.repeat.set(along, 1);
  return new Mesh(geometry, new MeshStandardMaterial({ map, normalMap: normal, roughnessMap: rough, roughness: 1, metalness: 0, fog: false }));
}
