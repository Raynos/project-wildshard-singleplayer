// The figure crowd (SHARD-PLATFORM M3): a crowd of static figures (instanced models, a colourway per InstancedMesh) culled
// per figure. One InstancedMesh per colourway over a whole level is never culled and draws every figure in every view.
// `FigureCrowd` keeps one InstancedMesh per colourway and LEVEL and rewrites its instances each frame the camera moves:
// only the figures inside the view frustum, the near ones at full detail, middle levels (simplified copies, meshLod's
// `simplifiedCopy`) from their distances, a far copy (meshLod's `clusterLod`) from `near`, none past `far`. A level with
// no figure in view is hidden, so it costs no call: the same draws, the triangles of what is actually seen.
import { Frustum, type InstancedMesh, Matrix4, type PerspectiveCamera, Sphere, Vector3 } from 'three';
import type { HandedBatch, InstancedCuller } from '@wildshard/engine/models/place';

/** A crowd's levels as data: the far copy from `near` m, nothing past `far` m, the middle copies' starts (nearest first),
 *  each figure's culling sphere (`radius` m round a point `lift` m above its feet) and the name its meshes take. */
export interface FigureCrowdLevels {
  readonly near: number;
  readonly far: number;
  readonly mids: readonly number[];
  readonly radius: number;
  readonly lift: number;
  readonly name: string;
}

/** a colourway's levels and figures; `nm` the middle levels' figure counts, reused by every re-cull (nothing allocated per
 *  frame: the place contract, engine models/place) */
interface Variant { hi: InstancedMesh; lo: InstancedMesh; mids: InstancedMesh[]; mats: readonly Matrix4[]; at: Vector3[]; nm: number[] }

/** show a level's first `n` figures (none: hidden) */
function show(im: InstancedMesh, n: number): void {
  im.count = n;
  im.visible = n > 0;
  if (n > 0) im.instanceMatrix.needsUpdate = true;
}

/**
 * The crowd's culler: figure models are placed through `place`, which hands each colourway's levels here
 * (`PlaceOptions.culler`, engine models/place) — full detail with every figure written, the middle copies, the far copy
 * from `near`, nothing past `far`. They start empty and hidden; `update` fills them per figure.
 */
export class FigureCrowd implements InstancedCuller {
  private readonly variants: Variant[] = [];
  private readonly levels: FigureCrowdLevels;
  /** the middle levels' start distances, squared */
  private readonly mid2: readonly number[];
  private readonly frustum = new Frustum();
  private readonly pv = new Matrix4();
  private readonly last = new Matrix4();
  private readonly sphere: Sphere;
  private readonly eye = new Vector3();
  private dirty = true;

  constructor(levels: FigureCrowdLevels) {
    this.levels = levels;
    this.mid2 = levels.mids.map((d) => d * d);
    this.sphere = new Sphere(new Vector3(), levels.radius);
  }

  /**
   * one colourway from `place`: the middle copies are left out when they are the full geometry (no simplifier: the
   * model's middle levels are then its full mesh)
   */
  take(b: HandedBatch): void {
    const { near, mids: midFrom, name } = this.levels;
    const hi = b.levels[0]?.mesh ?? null, lo = b.levels.find((l) => l.from === near)?.mesh ?? null;
    if (hi === null || lo === null || b.poses.length === 0) return;
    const mid = midFrom.map((d) => b.levels.find((l) => l.from === d)?.mesh ?? null);
    const mids = mid.filter((m): m is InstancedMesh => m !== null && m.geometry !== hi.geometry);
    for (const im of [hi, lo, ...mid]) {
      if (im === null) continue;
      im.count = 0;
      im.visible = false;
      im.frustumCulled = false; // culled per figure in update()
      im.name = name;
    }
    // (three measures its sphere on the first frame that draws it, as it did for the old empty batch)
    hi.boundingSphere = null;
    const levels = mids.length === midFrom.length ? mids : [];
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
    const { near, far, mids: midFrom, lift } = this.levels;
    const near2 = near * near, far2 = far * far;
    const mid2 = this.mid2;
    for (const v of this.variants) {
      let nh = 0, nl = 0;
      const nm = v.nm;
      nm.fill(0);
      const mid = v.mids.length === midFrom.length;
      for (let i = 0; i < v.at.length; i++) {
        const p = v.at[i], m = v.mats[i];
        if (p === undefined || m === undefined) continue;
        const d2 = p.distanceToSquared(this.eye);
        if (d2 > far2) continue;
        this.sphere.center.set(p.x, p.y + lift, p.z);
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
