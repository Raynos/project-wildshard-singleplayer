import { loadBoundSpecimen, specimenMaterial } from '@wildshard/game/models/specimenCatalogue';
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
/**
 * The balbal (E306 / E315 M3): a Turkic stone warrior (6th–8th c. kurgan stele, the Xiaohongnahai stone man) — a
 * granite pillar carved into a man holding a cup to his chest with the right hand, the left on a sabre hilt at the belt,
 * a heavy brow, a drooping moustache, lichen on the weathered tops. Two on each small kurgan's crown
 * (src/shards/nalati-grasslands/world/Balbals.ts); B11 wakes them at dusk.
 *
 * What ships is the TRELLIS.2 model (`balbal.glb`, scripts/img2mesh/props/nalati.json), turned to face −z and scaled
 * to the carved stele's 2.15 m. The two carved code variants (bare-headed, a pointed cap and beard) are drawn until the
 * file lands and are the Explorer's other two variants. Placed instanced: one InstancedMesh per carved variant, both
 * wearing the generated model once it has loaded (`wearGenerated`). Its collision is the statues' own (Balbals.register:
 * each a box that stops colliding while that warrior is awake).
 *
 * `balbalGeometry(variant)` (feet at y 0, facing −z, 2.1 m) is B11's rig's body too.
 */
import * as THREE from 'three';
import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
import { defineModel } from '@wildshard/engine/models/model';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { bakedActorGeometry } from '../world/places';
import modelMetrics from '../boot/modelMetrics.generated.json' with { type: 'json' };

export type BalbalCarving = 'bare' | 'capped';

export interface BalbalParams {
  /** a carved code stele, or null: the generated (TRELLIS.2) model */
  readonly carved: BalbalCarving | null;
}

/** A fresh copy of the admitted carving; consumers may transform it in place. */
export function balbalGeometry(variant: number, seed = 0xba1): THREE.BufferGeometry {
  return bakedActorGeometry(`balbal:${String(variant)}:${String(seed)}`);
}

const worn = new WeakMap<Sky, Promise<{ geometry: THREE.BufferGeometry; material: THREE.Material }>>();
/** the generated balbal as the carved stele stands: turned to face −z, scaled to 2.15 m (one per sky) */
function generatedBalbal(sky: Sky): Promise<{ geometry: THREE.BufferGeometry; material: THREE.Material }> {
  let p = worn.get(sky);
  if (!p) {
    p = loadBoundSpecimen(sky, specimenData.assets.balbal).then((model) => {
      const height = modelMetrics.sizes.balbal[1];
      if (height === undefined) throw new Error('Missing balbal bounds');
      const k = 2.15 / height;
      return { geometry: model.geometry.clone().rotateY(Math.PI).scale(k, k, k), material: model.material };
    });
    worn.set(sky, p);
    const cached = p; void cacheUntilDisposed(cached, () => { if (worn.get(sky) === cached) worn.delete(sky); });
  }
  return p;
}

/** the placed carved copies wear the generated model once it has loaded (same instances, slots and matrices) */
export function wearGenerated(meshes: readonly THREE.InstancedMesh[], sky: Sky): void {
  generatedBalbal(sky).then((g) => {
    for (const m of meshes) {
      if (m.count === 0) continue;
      m.geometry = g.geometry; m.material = g.material;
      m.computeBoundingSphere();
    }
    return g;
  }).catch((e: unknown) => { console.warn('[nalati] balbal model failed', e); });
}

export const balbal = defineModel<BalbalParams>({
  id: 'nalati-grasslands/balbal', name: 'Balbal', category: 'props', pipeline: ['trellis', 'code'],
  file: 'src/shards/nalati-grasslands/models/balbal.ts', surface: 'stone',
  defaults: { carved: null },
  variants: [
    { id: 'generated', label: 'TRELLIS.2', params: {} },
    { id: 'bare', label: 'Carved', params: { carved: 'bare' } },
    { id: 'capped', label: 'Carved · cap', params: { carved: 'capped' } },
  ],
  build: (ctx, p) => {
    if (p.carved !== null) return [{ geometry: balbalGeometry(p.carved === 'capped' ? 1 : 0), material: specimenMaterial(ctx.sky, specimenData.materials.poi), castShadow: true, receiveShadow: true }];
    // the specimen of what ships: the generated model, filled in when it lands
    const g = new THREE.Group();
    generatedBalbal(ctx.sky).then((m) => {
      const mesh = new THREE.Mesh(m.geometry, m.material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: 'nalati-grasslands/balbal' } }));
      return m;
    }).catch((e: unknown) => { console.warn('[nalati] balbal model failed', e); });
    return g;
  },
});
