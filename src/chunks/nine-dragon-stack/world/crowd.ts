// Dome B (E169): the crowd.
// 1. Variety (round-10-dome-b): the TRELLIS walker (public/assets/nine-dragon/lab/walker.glb, 2.08 m to the umbrella's
//    crown) comes in two ramps (dark coats, beige jackets), every umbrella a dark one; the targets' crowd carries mostly
//    dark umbrellas with a few red and ochre oil-paper ones. `tintUmbrella` recolours the umbrella (every vertex above
//    `above` metres, the canopy over the head) keeping its shading, and returns a new geometry.
// 2. Cost (the triangle freeze, A2 round 4): one InstancedMesh per variant over the whole fragment was never culled — the
//    ~700 figures (~1.4 k tris each, ≈ 1 M tris) drew in every view, the Well's crowd when looking at the stair and back.
//    `Crowd` keeps one InstancedMesh per variant and LEVEL and rewrites its instances each frame the camera moves: only
//    the figures inside the view frustum, the near ones (< LOD_NEAR m) at full detail, the far ones as a ~300-tri
//    vertex-clustered copy, none past LOD_FAR (the silk fog has swallowed them). The same draw calls as before (a level
//    with no figure in view is hidden, so it costs no call), the triangles of what is actually seen.
import { type BufferGeometry, Color, Float32BufferAttribute, Frustum, InstancedMesh, type Material, Matrix4, type PerspectiveCamera, Sphere, Uint32BufferAttribute, Vector3 } from 'three';

export function tintUmbrella(src: BufferGeometry, color: number, above = 1.8): BufferGeometry {
  const g = src.clone();
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  const tint = new Color(color);
  let lmax = 1e-4;
  for (let i = 0; i < col.count; i++) if (pos.getY(i) > above) lmax = Math.max(lmax, 0.2126 * col.getX(i) + 0.7152 * col.getY(i) + 0.0722 * col.getZ(i));
  const out = new Float32Array(col.count * 3);
  for (let i = 0; i < col.count; i++) {
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    if (pos.getY(i) > above) {
      const k = 0.7 + 0.45 * ((0.2126 * r + 0.7152 * gg + 0.0722 * b) / lmax);
      out[i * 3] = tint.r * k;
      out[i * 3 + 1] = tint.g * k;
      out[i * 3 + 2] = tint.b * k;
    } else {
      out[i * 3] = r;
      out[i * 3 + 1] = gg;
      out[i * 3 + 2] = b;
    }
  }
  g.setAttribute('color', new Float32BufferAttribute(out, 3));
  return g;
}

/**
 * A far LOD by vertex clustering: every vertex snaps to the first vertex of its grid cell (`cell` metres), triangles that
 * collapse drop out, unused vertices are compacted away. Every attribute of the kept vertices survives (the Kit-compatible
 * set: colour, aFace, aPat, aMisc, aOff, aSpill), so the far figure draws with the same program. The cell grows until the
 * figure is at most `maxTris` triangles.
 */
export function clusterLod(src: BufferGeometry, maxTris: number): BufferGeometry {
  const pos = src.getAttribute('position');
  const index = src.getIndex();
  const idx: ArrayLike<number> = index === null ? Array.from({ length: pos.count }, (_, i) => i) : index.array;
  let cell = 0.05, keep: number[] = [];
  for (let pass = 0; pass < 12; pass++) {
    const rep = new Map<string, number>();
    const map = new Int32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const key = `${Math.floor(pos.getX(i) / cell)},${Math.floor(pos.getY(i) / cell)},${Math.floor(pos.getZ(i) / cell)}`;
      const r = rep.get(key);
      if (r === undefined) { rep.set(key, i); map[i] = i; } else map[i] = r;
    }
    keep = [];
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = map[idx[t] ?? 0] ?? 0, b = map[idx[t + 1] ?? 0] ?? 0, c = map[idx[t + 2] ?? 0] ?? 0;
      if (a !== b && b !== c && a !== c) keep.push(a, b, c);
    }
    if (keep.length / 3 <= maxTris) break;
    cell *= 1.25;
  }
  // compact
  const remap = new Map<number, number>();
  const order: number[] = [];
  const out: number[] = [];
  for (const v of keep) {
    let n = remap.get(v);
    if (n === undefined) { n = order.length; remap.set(v, n); order.push(v); }
    out.push(n);
  }
  const g = src.clone();
  for (const name of Object.keys(src.attributes)) {
    const a = src.getAttribute(name);
    const arr = new Float32Array(order.length * a.itemSize);
    order.forEach((v, i) => { for (let c = 0; c < a.itemSize; c++) arr[i * a.itemSize + c] = a.getComponent(v, c); });
    g.setAttribute(name, new Float32BufferAttribute(arr, a.itemSize));
  }
  g.setIndex(new Uint32BufferAttribute(out, 1));
  g.computeBoundingSphere();
  return g;
}

/**
 * E281, umbrella variety: the targets' crowd carries dark blue umbrellas beside the black, oxblood and paper ones. A
 * walker added with a dark, neutral umbrella (the dark-coat ramp's) hands a share of its figures — picked by a hash of
 * where they stand, so the pick is stable — to a copy whose umbrella is tinted `BLUE_UMBRELLA`: one more geometry and
 * two more meshes (near / far) for the whole crowd, once per Crowd, never per figure.
 */
export const BLUE_UMBRELLA = 0x34507e;
const BLUE_SHARE = 0.35;

/** mean linear luminance and chroma of the umbrella's vertex colours (above `above` m), or null without an umbrella */
function umbrellaTone(g: BufferGeometry, above = 1.8): { lum: number; chroma: number } | null {
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  let n = 0, lum = 0, chroma = 0;
  for (let i = 0; i < col.count; i++) {
    if (pos.getY(i) <= above) continue;
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    lum += 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    chroma += Math.max(r, gg, b) - Math.min(r, gg, b);
    n++;
  }
  return n === 0 ? null : { lum: lum / n, chroma: chroma / n };
}

/** a stable 0..1 hash of a figure's standing point */
const spot = (m: Matrix4): number => {
  const e = m.elements;
  const h = Math.sin(e[12] * 12.9898 + e[14] * 78.233) * 43758.5453;
  return h - Math.floor(h);
};

/** full detail inside this distance, the clustered copy past it, nothing past LOD_FAR */
export const LOD_NEAR = 35, LOD_FAR = 130;
/** the far copy's triangle cap */
export const LOD_TRIS = 320;

interface Variant { hi: InstancedMesh; lo: InstancedMesh; mats: Matrix4[]; at: Vector3[] }

export class Crowd {
  readonly meshes: InstancedMesh[] = [];
  private readonly variants: Variant[] = [];
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly last = new Matrix4();
  private readonly sphere = new Sphere(new Vector3(), 1.3);
  private readonly eye = new Vector3();
  private dirty = true;
  /** the blue-umbrella split is made once per crowd (it costs a geometry and two meshes) */
  private split = false;

  constructor(private readonly mat: Material) {}

  /** one variant: its full geometry and where its figures stand (their base points are the matrices' translations) */
  add(geo: BufferGeometry, mats: readonly Matrix4[]): void {
    if (mats.length === 0) return;
    const tone = this.split ? null : umbrellaTone(geo);
    if (tone !== null && tone.lum < 0.06 && tone.chroma < 0.03) {
      this.split = true;
      const blue = mats.filter((m) => spot(m) < BLUE_SHARE), rest = mats.filter((m) => spot(m) >= BLUE_SHARE);
      this.variant(geo, rest);
      this.variant(tintUmbrella(geo, BLUE_UMBRELLA), blue);
      return;
    }
    this.variant(geo, mats);
  }

  private variant(geo: BufferGeometry, mats: readonly Matrix4[]): void {
    if (mats.length === 0) return;
    const lo = clusterLod(geo, LOD_TRIS);
    const mk = (g: BufferGeometry, name: string): InstancedMesh => {
      const im = new InstancedMesh(g, this.mat, mats.length);
      im.count = 0;
      im.visible = false;
      im.frustumCulled = false; // culled per figure in update()
      im.name = name;
      this.meshes.push(im);
      return im;
    };
    this.variants.push({ hi: mk(geo, 'crowd'), lo: mk(lo, 'crowd'), mats: [...mats], at: mats.map((m) => new Vector3().setFromMatrixPosition(m)) });
    this.dirty = true;
  }

  /** re-pick the figures in view (only when the camera moved) */
  update(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld();
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    if (!this.dirty && this.pv.equals(this.last)) return;
    this.last.copy(this.pv);
    this.dirty = false;
    this.frustum.setFromProjectionMatrix(this.pv);
    this.eye.setFromMatrixPosition(camera.matrixWorld);
    const near2 = LOD_NEAR * LOD_NEAR, far2 = LOD_FAR * LOD_FAR;
    for (const v of this.variants) {
      let nh = 0, nl = 0;
      for (let i = 0; i < v.at.length; i++) {
        const p = v.at[i], m = v.mats[i];
        if (p === undefined || m === undefined) continue;
        const d2 = p.distanceToSquared(this.eye);
        if (d2 > far2) continue;
        this.sphere.center.set(p.x, p.y + 1.0, p.z);
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        if (d2 < near2) v.hi.setMatrixAt(nh++, m);
        else v.lo.setMatrixAt(nl++, m);
      }
      for (const [im, n] of [[v.hi, nh], [v.lo, nl]] as const) {
        im.count = n;
        im.visible = n > 0;
        if (n > 0) im.instanceMatrix.needsUpdate = true;
      }
    }
  }
}
