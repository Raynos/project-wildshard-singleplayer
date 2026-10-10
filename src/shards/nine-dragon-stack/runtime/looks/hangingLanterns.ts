// hangingLanterns — lathe-turned lanterns hung from hooks, culled into three distance draws (SHARD-PLATFORM M3, ex Nine
// Dragon's look/lanterns.ts). Nothing here knows a shard: the lantern's size, the drop below its hook, its glow emitter, the
// near / dot switches and the draws' names are a data row (`HangingLanternRow`); the paper's program is the caller's.
//
// The lantern is one geometry whose parts (body, lacquer caps, tassel) are told apart by `aPart`; its pivot is the hook. Each
// frame the visible lanterns (a sphere per lantern against the view frustum) are bucketed into a near draw (the dressed
// lathe), a far one (the body alone) and a dot past the dot switch, each carrying its lanterns' sway seeds (`aSeed`). Before
// the first update every lantern is in the near draw.
//
//   const lanterns = new HangingLanterns(material, ROW);  lanterns.hang(hook, scale);
//   place(model, lanterns.placements(), { culler: lanterns, … });   every frame: updateHangingLanterns(camera)
import {
  BufferGeometry, type Camera, Color, Float32BufferAttribute, Frustum, InstancedBufferAttribute, type InstancedMesh, LatheGeometry, Matrix4,
  Quaternion, type ShaderMaterial, Sphere, Uint32BufferAttribute, Vector2, Vector3,
} from 'three';
import type { Placement } from '@wildshard/engine/models/model';
import type { HandedBatch, InstancedCuller } from '@wildshard/engine/models/place';
import type { Emitter } from './vertexSpill';

/** A lantern set as data: its lathe, how far it hangs below its hook, its glow, its distance switches and its draws' names. */
export interface HangingLanternRow {
  /** the body's radius and half-height (m) */
  readonly radius: number;
  readonly halfHeight: number;
  /** the lantern's centre below its hook (m, at scale 1) */
  readonly drop: number;
  /** its glow emitter: colour (hex), size and power at scale 1 */
  readonly glow: { readonly color: number; readonly w: number; readonly h: number; readonly power: number; readonly spill: number };
  /** the near / far switch and the far / dot switch (m) */
  readonly near: number;
  readonly dot: number;
  /** a lantern's bounding radius at scale 1 (body + tassel, around its centre) and that centre's drop below the pivot */
  readonly bound: number;
  readonly boundDrop: number;
  /** the three draws' names */
  readonly names: { readonly near: string; readonly far: string; readonly dot: string };
}

/** the lantern's lathe: `rings` bands down the body, `segs` around; caps + tassel only on the dressed one */
export function lanternLathe(row: Pick<HangingLanternRow, 'radius' | 'halfHeight'>, rings: number, segs: number, dressing: boolean): BufferGeometry {
  const R = row.radius, H = row.halfHeight;
  const pts: Vector2[] = [];
  for (let i = 0; i <= rings; i++) {
    const t = -1 + (2 * i) / rings;
    pts.push(new Vector2(Math.max(0.1, R * Math.sqrt(Math.max(0, 1 - t * t * 0.86))), t * H));
  }
  const parts: { g: BufferGeometry; part: number }[] = [{ g: new LatheGeometry(pts, segs), part: 0 }];
  if (dressing) {
    const cap = (y0: number, y1: number, r: number): BufferGeometry => new LatheGeometry([new Vector2(0, y0), new Vector2(r, y0), new Vector2(r, y1), new Vector2(0, y1)], 6);
    parts.push({ g: cap(H - 0.01, H + 0.05, 0.105), part: 1 });
    parts.push({ g: cap(-H - 0.05, -H + 0.01, 0.105), part: 1 });
    parts.push({ g: new LatheGeometry([new Vector2(0.012, -H - 0.05), new Vector2(0.03, -H - 0.2), new Vector2(0.04, -H - 0.36), new Vector2(0, -H - 0.36)], 4), part: 2 });
  }
  const pos: number[] = [], nrm: number[] = [], part: number[] = [], idx: number[] = [];
  let base = 0;
  for (const { g, part: p } of parts) {
    const gp = g.getAttribute('position');
    const gn = g.getAttribute('normal');
    for (let i = 0; i < gp.count; i++) {
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      nrm.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      part.push(p);
    }
    const gi = g.getIndex();
    if (gi !== null) for (let i = 0; i < gi.count; i++) idx.push(gi.getX(i) + base);
    else for (let i = 0; i < gp.count; i++) idx.push(i + base);
    base += gp.count;
    g.dispose();
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  out.setAttribute('aPart', new Float32BufferAttribute(part, 1));
  out.setIndex(new Uint32BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

/**
 * A lantern string strung from `a` to `b`: the cord as a sagging polyline and the hooks the lanterns hang from, one every
 * `spacing` metres, the cord dropping `sag` metres at mid-span. Pure geometry: the caller hangs a lantern at each hook and
 * draws the cord.
 */
export function lanternString(a: Vector3, b: Vector3, spacing: number, sag: number, segs = 10): { cord: Vector3[]; hooks: Vector3[] } {
  const at = (t: number): Vector3 => a.clone().lerp(b, t).add(new Vector3(0, -sag * 4 * t * (1 - t), 0));
  const cord: Vector3[] = [];
  for (let i = 0; i <= segs; i++) cord.push(at(i / segs));
  const hooks: Vector3[] = [];
  const n = Math.max(1, Math.floor(a.distanceTo(b) / Math.max(0.5, spacing)));
  for (let i = 1; i < n; i++) hooks.push(at(i / n));
  return { cord, hooks };
}

/** every built lantern set (a rebuilt world's replace the old: `clearHangingLanterns`) */
const live: HangingLanterns[] = [];
/** bucket every lantern set for this camera (the render strategy's frame hook, before the draw) */
export function updateHangingLanterns(camera: Camera): void { for (const l of live) l.update(camera); }
/** forget the built sets (the render strategy's dispose) */
export function clearHangingLanterns(): void { live.length = 0; }
/** where every built lantern hangs (its glow emitter's centre), e.g. for the audio */
export function hangingLanternPositions(): Vector3[] { return live.flatMap((set) => set.emitters.map((emitter) => emitter.at.clone())); }

/** A set of hanging lanterns: their placements, sway seeds and glow emitters, and the culler of their three draws. */
export class HangingLanterns implements InstancedCuller {
  readonly emitters: Emitter[] = [];
  private readonly mats: Matrix4[] = [];
  private readonly seeds: number[] = [];
  readonly material: ShaderMaterial;
  private readonly row: HangingLanternRow;

  constructor(material: ShaderMaterial, row: HangingLanternRow) {
    this.material = material;
    this.row = row;
  }

  /** one lantern hanging from its hook at `top` */
  hang(top: Vector3, scale = 1): void {
    const c = top.clone();
    const g = this.row.glow;
    c.y -= this.row.drop * scale;
    this.mats.push(new Matrix4().compose(c, new Quaternion(), new Vector3(scale, scale, scale)));
    this.seeds.push((this.mats.length * 0.618) % 1);
    this.emitters.push({ at: c, color: new Color(g.color), w: g.w * scale, h: g.h * scale, power: g.power, spill: g.spill * scale });
  }

  /** where they hang, in hanging order */
  placements(): Placement<object>[] {
    return this.mats.map((m) => ({ x: m.elements[12], y: m.elements[13], z: m.elements[14], matrix: m }));
  }

  private near: InstancedMesh | null = null;
  private far: InstancedMesh | null = null;
  private dot: InstancedMesh | null = null;
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly last = new Matrix4();
  private readonly sphere = new Sphere();

  /**
   * the model's levels from `place` (PlaceOptions.culler): the near lathe with every lantern, the far (row.near) and the
   * dot (row.dot) ones. Each draw gets the lanterns' seeds and every matrix (its sphere round all of them), the far and
   * dot start empty; the buckets are the visible sets, so no draw is culled as a whole
   */
  take(b: HandedBatch): void {
    const row = this.row;
    const near = b.levels[0]?.mesh ?? null, far = b.levels.find((l) => l.from === row.near)?.mesh ?? null, dot = b.levels.find((l) => l.from === row.dot)?.mesh ?? null;
    if (near === null || far === null || dot === null) return;
    const n = this.mats.length;
    const mk = (m: InstancedMesh, name: string): InstancedMesh => {
      m.geometry.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(this.seeds), 1));
      m.count = n;
      m.visible = true;
      this.mats.forEach((mm, i) => { m.setMatrixAt(i, mm); });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      m.name = name;
      return m;
    };
    this.near = mk(near, row.names.near);
    this.far = mk(far, row.names.far);
    this.far.count = 0;
    this.dot = mk(dot, row.names.dot);
    this.dot.count = 0;
    this.dot.visible = false;
    this.near.frustumCulled = false;
    this.far.frustumCulled = false;
    this.dot.frustumCulled = false;
    live.push(this);
  }

  /** bucket the lanterns in view into the near, far (and dot) draws (skipped while the camera has not moved) */
  update(camera: Camera): void {
    const near = this.near, far = this.far, dot = this.dot;
    if (near === null || far === null || dot === null) return;
    camera.updateMatrixWorld();
    if (this.last.equals(camera.matrixWorld)) return;
    this.last.copy(camera.matrixWorld);
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    const cw = camera.matrixWorld.elements, cx = cw[12], cy = cw[13], cz = cw[14];
    const nm = near.instanceMatrix.array, fm = far.instanceMatrix.array, dm = dot.instanceMatrix.array;
    const ns = near.geometry.getAttribute('aSeed'), fs = far.geometry.getAttribute('aSeed'), ds = dot.geometry.getAttribute('aSeed');
    const nsa = ns.array, fsa = fs.array, dsa = ds.array;
    let a = 0, b = 0, c = 0;
    const r2 = this.row.near * this.row.near, d2Dot = this.row.dot * this.row.dot, bound = this.row.bound, boundDrop = this.row.boundDrop;
    for (let i = 0; i < this.mats.length; i++) {
      const m = this.mats[i];
      if (m === undefined) continue;
      const e = m.elements;
      const x = e[12], y = e[13], z = e[14], s = Math.hypot(e[0], e[1], e[2]);
      this.sphere.center.set(x, y - boundDrop * s, z);
      this.sphere.radius = bound * s;
      if (!this.frustum.intersectsSphere(this.sphere)) continue;
      const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
      if (d2 < r2) { m.toArray(nm, a * 16); nsa[a] = this.seeds[i] ?? 0; a++; } else if (d2 < d2Dot) { m.toArray(fm, b * 16); fsa[b] = this.seeds[i] ?? 0; b++; } else { m.toArray(dm, c * 16); dsa[c] = this.seeds[i] ?? 0; c++; }
    }
    near.count = a;
    far.count = b;
    dot.count = c;
    dot.visible = c > 0;
    near.instanceMatrix.needsUpdate = true;
    far.instanceMatrix.needsUpdate = true;
    dot.instanceMatrix.needsUpdate = true;
    ns.needsUpdate = true;
    fs.needsUpdate = true;
    ds.needsUpdate = true;
  }
}
