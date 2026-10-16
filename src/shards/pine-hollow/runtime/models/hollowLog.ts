/**
 * The hollow log (E315 M2; PINE-HOLLOW-REMASTER PH-C8, a secret of PH-U22): one of the old-growth's fallen giants,
 * 3.2 m across and 11 m long, rotted out down its heart so you can walk through it. Drawn on the cabins' own PBR
 * set (`cabinMats`: bark outside, the log's split-wood inside, end grain on the rims, the chinking's grey for the rotted
 * bed) — no new programs. Its own space: the axis along local X, the origin on the rotted bed's top (where you stand).
 * Near (LOD0, 60 m): the shell with its shadow, the bore, the two rims and the bed — 5 draws; past it (LOD1) the shell
 * alone, no shadow.
 *
 * Its size is a data row (../data/hollowLog.ts); its geometry is baked offline at that size (../generators/codeParts.ts).
 * Collision: the bed (a flat box you walk on) and a shell of seven boxes round the bore (the bottom eighth is the
 * bed); the mouths are open. Placed once, in the old-growth (src/shards/pine-hollow/quest/hollowLog.ts `HOLLOW_LOG`).
 *
 *   await loadHollowLog(ctx);   // its materials are the cabins': place() is synchronous
 */
import * as THREE from 'three';
import { cabinMats, type Mats } from '../../world/homestead';
import { codePart, loadCodeParts } from '../world/codeParts';
import HOLLOW_LOG_SHAPE from '../../data/hollowLog.json' with { type: 'json' }; // length, outer and bore radius (m), the rotted bed's depth
import { defineModel, type ColliderSpec, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';

const KEY = 'pine-hollow/hollow-log';

/** Load its materials (the cabins') and its baked shell into this shard's context. */
export async function loadHollowLog(ctx: ModelContext): Promise<void> {
  const [mats] = await Promise.all([cabinMats(ctx.sky), loadCodeParts()]);
  ctx.once(`${KEY}:mats`, () => mats);
}

const matsOf = (ctx: ModelContext): Mats => ctx.once<Mats>(`${KEY}:mats`, () => { throw new Error('[hollow-log] loadHollowLog(ctx) first'); });

/** the shell, the bore, the rims and the bed in own space (baked offline, ../generators/codeParts.ts; read once) */
function geometries(ctx: ModelContext): { outer: THREE.BufferGeometry; inner: THREE.BufferGeometry; rims: THREE.BufferGeometry[]; bed: THREE.BufferGeometry } {
  return ctx.once(`${KEY}:geo`, () => ({ outer: codePart('hollow-log-outer'), inner: codePart('hollow-log-inner'), rims: [codePart('hollow-log-rim-0'), codePart('hollow-log-rim-1')], bed: codePart('hollow-log-bed') }));
}

export const hollowLog = defineModel<Record<string, never>>({
  id: 'pine-hollow/hollow-log', name: 'Hollow log', category: 'nature', pipeline: 'code',
  file: 'src/shards/pine-hollow/models/hollowLog.ts', surface: 'wood',
  defaults: {},
  build: (ctx) => {
    const m = matsOf(ctx), g = geometries(ctx);
    const parts: ModelPart[] = [
      { geometry: g.outer, material: m.bark, castShadow: true, receiveShadow: true },
      { geometry: g.inner, material: m.log, receiveShadow: true },
      ...g.rims.map((rim) => ({ geometry: rim, material: m.endGrain })),
      { geometry: g.bed, material: m.chink, receiveShadow: true },
    ];
    return parts;
  },
  // past 60 m the shell alone, without its shadow (a few pixels, and a draw per cascade)
  lods: [{ from: 60, build: (ctx) => [{ geometry: geometries(ctx).outer, material: matsOf(ctx).bark, receiveShadow: true }] }],
  colliders: () => {
    const { len, R, r, bed: BED } = HOLLOW_LOG_SHAPE, axis = r - BED;
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
