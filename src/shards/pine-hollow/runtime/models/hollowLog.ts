/**
 * The hollow log (E315 M2; PINE-HOLLOW-REMASTER PH-C8, a secret of PH-U22): one of the old-growth's fallen giants,
 * 3.2 m across and 11 m long, rotted out down its heart so you can walk through it. Drawn on the cabins' own PBR
 * set (`cabinMats`: bark outside, the log's split-wood inside, end grain on the rims, the chinking's grey for the rotted
 * bed) — no new programs. Its own space: the axis along local X, the origin on the rotted bed's top (where you stand).
 * Near (LOD0, 60 m): the shell with its shadow, the bore, the two rims and the bed — 5 draws; past it (LOD1) the shell
 * alone, no shadow.
 *
 * Its size is a data row (../data/hollowLog.json); its geometry and its collision (the bed you walk on and a shell of
 * seven boxes round the bore; the mouths are open) are baked offline at that size (../generators/codeParts.ts). Placed once, in the old-growth (src/shards/pine-hollow/quest/hollowLog.ts `HOLLOW_LOG`).
 *
 *   await loadHollowLog(ctx);   // its materials are the cabins': place() is synchronous
 */
import type * as THREE from 'three';
import { cabinMats, type Mats } from '../world/homestead';
import { codePart, loadCodeParts } from '../world/codeParts';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { defineModel, type ModelContext, type ModelPart } from '@wildshard/engine/models/model';
import meta from '../../data/codeParts.json' with { type: 'json' };

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
  colliders: () => readColliderRows(meta.colliders['hollow-log'], { kinds: ['box'], surfaces: ['wood'], requireSurface: true }),
});
