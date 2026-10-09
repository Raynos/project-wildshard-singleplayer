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
// 3. (E283, Jake's pick: the distance LODs) two middle levels inside LOD_NEAR:
//    meshoptimizer copies of each figure whose surface stays within MID_PX of a pixel of the full one where they start
//    (world/lod.ts). A figure 20 m off is ~100 px tall and its ~1.4 k triangles are ~1 px² each: every one costs a 2 × 2
//    quad of the architecture program.
// 4. (E306 M4) the walker and the sitter are models (models/crowd.ts: the TRELLIS casts, their colourways, these LODs);
//    this file deals the figures out to the colourways (`dealCrowd`) and culls them (`Crowd`, handed each colourway's
//    levels by `place`).
import { type BufferGeometry, Color, Float32BufferAttribute, Frustum, type InstancedMesh, Matrix4, type PerspectiveCamera, Sphere, Uint32BufferAttribute, Vector3 } from 'three';
import type { HandedBatch, InstancedCuller } from '@wildshard/engine/models/place';

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
 * E281, umbrella variety: the targets' crowd is a mix of black, dark blue, oxblood and paper umbrellas, about a
 * quarter each; the variants handed in are mostly the dark-coat walker's black one. When the crowd is built, the
 * dark-umbrella walker's figures are dealt out by a hash of where they stand (so the deal is stable): a quarter keep
 * black, a quarter go to a copy whose umbrella is `BLUE_UMBRELLA` (one more geometry and two meshes, once per crowd),
 * and the rest join the variants already added with an oxblood umbrella and with a paper one (no geometry at all).
 */
export const BLUE_UMBRELLA = 0x34507e;
const SHARE = { blue: 0.25, oxblood: 0.5, paper: 0.72 } as const;

interface Tone { lum: number; chroma: number; r: number; g: number; b: number }
/** the umbrella's mean linear colour, luminance and chroma (vertices above `above` m), or null without an umbrella */
function umbrellaTone(g: BufferGeometry, above = 1.8): Tone | null {
  const pos = g.getAttribute('position'), col = g.getAttribute('color');
  let n = 0, lum = 0, chroma = 0, sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < col.count; i++) {
    if (pos.getY(i) <= above) continue;
    const r = col.getX(i), gg = col.getY(i), b = col.getZ(i);
    lum += 0.2126 * r + 0.7152 * gg + 0.0722 * b;
    chroma += Math.max(r, gg, b) - Math.min(r, gg, b);
    sr += r; sg += gg; sb += b;
    n++;
  }
  return n === 0 ? null : { lum: lum / n, chroma: chroma / n, r: sr / n, g: sg / n, b: sb / n };
}
const isBlack = (t: Tone | null): boolean => t !== null && t.lum < 0.06 && t.chroma < 0.03;
const isOxblood = (t: Tone | null): boolean => t !== null && t.chroma > 0.05 && t.g < t.r * 0.2 && t.b < t.r * 0.2;
const isPaper = (t: Tone | null): boolean => t !== null && t.chroma > 0.05 && t.g > t.r * 0.25 && t.g < t.r * 0.75 && t.b < t.r * 0.3;

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
/** (E283) the middle levels' starts (m) and their error there (px on the phone frame) */
export const MID_FROM = [12, 22] as const;
export const MID_PX = 0.8;

/** a colourway's levels and figures; `nm` the middle levels' figure counts, reused by every re-cull (nothing allocated per
 *  frame: the place contract, src/engine/models/place.ts) */
interface Variant { hi: InstancedMesh; lo: InstancedMesh; mids: InstancedMesh[]; mats: readonly Matrix4[]; at: Vector3[]; nm: number[] }

/** the middle levels' start distances, squared */
const MID2: readonly number[] = MID_FROM.map((d) => d * d);

/** show a level's first `n` figures (none: hidden) */
function show(im: InstancedMesh, n: number): void {
  im.count = n;
  im.visible = n > 0;
  if (n > 0) im.instanceMatrix.needsUpdate = true;
}

/** a figure's colourway (models/crowd.ts): the coat's ramp, and the umbrella's dye when it is not the ramp's own */
export type WalkerPick = 'dark' | 'light' | 'oxblood' | 'paper' | 'blue';
export type SitterPick = 'dark' | 'light';

/**
 * The crowd's colourways (E281), as the old `Crowd.add` / `build` dealt them — now the placement of the walker and sitter
 * models (world/build.ts): the walkers by their index (seven in ten dark coats, one red and one ochre oil-paper umbrella
 * in ten), the sitters two dark coats to one light; then the black-umbrella figures dealt by a hash of where they stand
 * (see BLUE_UMBRELLA): a quarter keep black, a quarter go blue, the rest join the oxblood and the paper ones. The tones
 * come from the colourways' own geometry (`geo`), as before. Each colourway's figures in the order the old deal left them,
 * the colourways in the order it built them (blue after the rest).
 */
export function dealCrowd(walkers: readonly Matrix4[], sitters: readonly Matrix4[], geo: { walker: (p: WalkerPick) => BufferGeometry; sitter: (p: SitterPick) => BufferGeometry }): { walkers: [WalkerPick, Matrix4[]][]; sitters: [SitterPick, Matrix4[]][] } {
  type Part = { walker: true; pick: WalkerPick; mats: Matrix4[] } | { walker: false; pick: SitterPick; mats: Matrix4[] };
  const all: Part[] = [
    { walker: true, pick: 'dark', mats: walkers.filter((_, i) => i % 10 < 7 && i % 10 !== 2) },
    { walker: true, pick: 'light', mats: walkers.filter((_, i) => i % 10 >= 7 && i % 10 !== 8) },
    { walker: true, pick: 'oxblood', mats: walkers.filter((_, i) => i % 10 === 2) },
    { walker: true, pick: 'paper', mats: walkers.filter((_, i) => i % 10 === 8) },
    { walker: false, pick: 'dark', mats: sitters.filter((_, i) => i % 3 !== 1) },
    { walker: false, pick: 'light', mats: sitters.filter((_, i) => i % 3 === 1) },
  ];
  // (an empty colourway was never added, so the tones only look at the ones with figures)
  const parts = all.filter((p) => p.mats.length > 0);
  const tones = parts.map((p) => umbrellaTone(p.walker ? geo.walker(p.pick) : geo.sitter(p.pick)));
  const black = parts[tones.findIndex(isBlack)];
  const oxblood = parts[tones.findIndex(isOxblood)], paper = parts[tones.findIndex(isPaper)];
  const blue: Matrix4[] = [];
  // (the blue copy is the black walker's umbrella dyed: the walker model's 'blue' colourway is the dark walker's)
  const dealt = black !== undefined && black.walker && black.pick === 'dark';
  if (dealt) {
    const keep: Matrix4[] = [];
    for (const m of black.mats) {
      const h = spot(m);
      if (h < SHARE.blue) blue.push(m);
      else if (h < SHARE.oxblood && oxblood !== undefined) oxblood.mats.push(m);
      else if (h < SHARE.paper && paper !== undefined) paper.mats.push(m);
      else keep.push(m);
    }
    black.mats = keep;
  }
  const out: { walkers: [WalkerPick, Matrix4[]][]; sitters: [SitterPick, Matrix4[]][] } = { walkers: [], sitters: [] };
  for (const p of parts) {
    if (p.mats.length === 0) continue;
    if (p.walker) out.walkers.push([p.pick, p.mats]); else out.sitters.push([p.pick, p.mats]);
  }
  if (dealt && blue.length > 0) out.walkers.push(['blue', blue]);
  return out;
}

/**
 * The crowd's culler (E306 M4): the walker and sitter models are placed through `place`, which hands each colourway's
 * levels here (`PlaceOptions.culler`, src/engine/models/place.ts) — full detail with every figure written, the E283 middle
 * copies, the clustered far copy, nothing past LOD_FAR. They start empty and hidden; `update` fills them per figure.
 */
export class Crowd implements InstancedCuller {
  private readonly variants: Variant[] = [];
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly last = new Matrix4();
  private readonly sphere = new Sphere(new Vector3(), 1.3);
  private readonly eye = new Vector3();
  private dirty = true;

  /**
   * one colourway from `place`: the middle copies are left out when meshoptimizer was not ready (the model's middle
   * levels are then its full geometry: world/modelLook.ts `canLod`), as the old crowd built none
   */
  take(b: HandedBatch): void {
    const hi = b.levels[0]?.mesh ?? null, lo = b.levels.find((l) => l.from === LOD_NEAR)?.mesh ?? null;
    if (hi === null || lo === null || b.poses.length === 0) return;
    const mid = MID_FROM.map((d) => b.levels.find((l) => l.from === d)?.mesh ?? null);
    const mids = mid.filter((m): m is InstancedMesh => m !== null && m.geometry !== hi.geometry);
    for (const im of [hi, lo, ...mid]) {
      if (im === null) continue;
      im.count = 0;
      im.visible = false;
      im.frustumCulled = false; // culled per figure in update()
      im.name = 'crowd';
    }
    // (three measures its sphere on the first frame that draws it, as it did for the old empty batch)
    hi.boundingSphere = null;
    const levels = mids.length === MID_FROM.length ? mids : [];
    this.variants.push({ hi, lo, mids: levels, mats: b.poses, at: b.poses.map((m) => new Vector3().setFromMatrixPosition(m)), nm: levels.map(() => 0) });
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
    const mid2 = MID2;
    for (const v of this.variants) {
      let nh = 0, nl = 0;
      const nm = v.nm;
      nm.fill(0);
      const mid = v.mids.length === MID_FROM.length;
      for (let i = 0; i < v.at.length; i++) {
        const p = v.at[i], m = v.mats[i];
        if (p === undefined || m === undefined) continue;
        const d2 = p.distanceToSquared(this.eye);
        if (d2 > far2) continue;
        this.sphere.center.set(p.x, p.y + 1.0, p.z);
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
        if (d2 >= near2) { v.lo.setMatrixAt(nl++, m); continue; }
        let l = mid ? mid2.length - 1 : -1;
        while (l >= 0 && d2 < (mid2[l] ?? 0)) l--;
        const im = l < 0 ? v.hi : v.mids[l];
        if (im === undefined) continue;
        if (l < 0) { im.setMatrixAt(nh++, m); continue; }
        const j = nm[l] ?? 0;
        im.setMatrixAt(j, m);
        nm[l] = j + 1;
      }
      show(v.hi, nh);
      show(v.lo, nl);
      for (let j = 0; j < v.mids.length; j++) { const im = v.mids[j]; if (im !== undefined) show(im, nm[j] ?? 0); }
    }
  }
}
