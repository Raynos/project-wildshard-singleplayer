/**
 * The hollow log (E315 M2; PINE-HOLLOW-REMASTER PH-C8, a secret of PH-U22): one of the old-growth's fallen giants,
 * 3.2 m across and 11 m long, rotted out down its heart so you can walk through it. Built in code on the cabins' own PBR
 * set (`cabinMats`: bark outside, the log's split-wood inside, end grain on the rims, the chinking's grey for the rotted
 * bed) — no new programs. Its own space: the axis along local X, the origin on the rotted bed's top (where you stand).
 * Near (LOD0, 60 m): the shell with its shadow, the bore, the two rims and the bed — 5 draws; past it (LOD1) the shell
 * alone, no shadow.
 *
 * Collision: the bed (a flat box you walk on) and a shell of seven boxes round the bore (the bottom eighth is the
 * bed); the mouths are open. Placed once, in the old-growth (src/shards/pine-hollow/quest/hollowLog.ts `HOLLOW_LOG`).
 *
 *   await loadHollowLog(ctx);   // its materials are the cabins': place() is synchronous
 */
import * as THREE from 'three';
import { cabinMats, type Mats } from '../world/homestead';
import { defineModel, type ColliderSpec, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';

export interface HollowLogParams {
  /** length (m), outer and bore radius */
  readonly len: number;
  readonly R: number;
  readonly r: number;
}

/** the rotted bed fills the bore's bottom 0.42 m: the bore's axis is this far above the bed's top */
const BED = 0.42;

const KEY = 'pine-hollow/hollow-log';

/** Load its materials (the cabins') into this shard's context. */
export async function loadHollowLog(ctx: ModelContext): Promise<void> {
  const mats = await cabinMats(ctx.sky);
  ctx.once(`${KEY}:mats`, () => mats);
}

const matsOf = (ctx: ModelContext): Mats => ctx.once<Mats>(`${KEY}:mats`, () => { throw new Error('[hollow-log] loadHollowLog(ctx) first'); });

const uvScale = (g: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry => {
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
};

/** the shell, the bore, the rims and the bed in own space (built once per size) */
function geometries(ctx: ModelContext, p: HollowLogParams): { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry; rims: THREE.BufferGeometry[]; bed: THREE.BufferGeometry } {
  return ctx.once(`${KEY}:geo:${p.len},${p.R},${p.r}`, () => {
    const { len, R, r } = p, axis = r - BED;
    const along = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateZ(Math.PI / 2).translate(0, axis, 0); // a Y cylinder → along local X
    const outer = uvScale(along(new THREE.CylinderGeometry(R, R * 1.04, len, 22, 1, true)), 4, 3);
    const inner = uvScale(along(new THREE.CylinderGeometry(r, r, len, 22, 1, true)), 3, 2.5);
    // the bore is seen from inside: flip its winding and its normals
    const idx = inner.index;
    if (idx) for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a); }
    const nrm = inner.getAttribute('normal');
    for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
    const rims = [-1, 1].map((s) => new THREE.RingGeometry(r, R, 22, 1).rotateY((s * Math.PI) / 2).translate((s * len) / 2, axis, 0));
    const bedW = 2 * Math.sqrt(r * r - (r - BED) ** 2);
    const bed = uvScale(new THREE.BoxGeometry(len - 0.1, 0.1, bedW).translate(0, -r + 0.37 + axis, 0), 5, 1);
    return { outer, inner, rims, bed };
  });
}

export const hollowLog = defineModel<HollowLogParams>({
  id: 'pine-hollow/hollow-log', name: 'Hollow log', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/hollowLog.ts', surface: 'wood',
  defaults: { len: 11, R: 1.6, r: 1.3 },
  build: (ctx, p) => {
    const m = matsOf(ctx), g = geometries(ctx, p);
    const parts: ModelPart[] = [
      { geometry: g.outer, material: m.bark, castShadow: true, receiveShadow: true },
      { geometry: g.inner, material: m.log, receiveShadow: true },
      ...g.rims.map((rim) => ({ geometry: rim, material: m.endGrain })),
      { geometry: g.bed, material: m.chink, receiveShadow: true },
    ];
    return parts;
  },
  // past 60 m the shell alone, without its shadow (a few pixels, and a draw per cascade)
  lods: [{ from: 60, build: (ctx, p) => [{ geometry: geometries(ctx, p).outer, material: matsOf(ctx).bark, receiveShadow: true }] }],
  colliders: (p) => {
    const { len, R, r } = p, axis = r - BED;
    const bedW = 2 * Math.sqrt(r * r - (r - BED) ** 2);
    const out: ColliderSpec[] = [{ kind: 'box', x: 0, y: -0.25, z: 0, hx: len / 2, hy: 0.25, hz: bedW / 2, surface: 'wood' }];
    const T = R - r, midR = (R + r) / 2, N = 8, chord = 2 * midR * Math.tan(Math.PI / N) + 0.05;
    const q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2;                     // 0 = up, round through the sides (the bore's cross-section)
      if (Math.abs(Math.cos(th) + 1) < 0.2) continue;       // the bottom segment: the bed is there
      q.setFromAxisAngle(X, th);
      out.push({ kind: 'box', x: 0, y: axis + Math.cos(th) * midR, z: Math.sin(th) * midR, hx: len / 2, hy: T / 2, hz: chord / 2, rot: { x: q.x, y: q.y, z: q.z, w: q.w }, surface: 'wood' });
    }
    return out;
  },
});
