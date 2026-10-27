import type { RiggedHullBook, RiggedHullUrls } from '@wildshard/format/riggedHulls';
import { PINE_HULLS } from './creatureHulls';
import { GPU_FILES } from '../ktx2.generated';

/** Preserve logical product names and the original per-tier coat identities. A variant wears a baked coat when the
 *  KTX2 table holds its key (the coat bake's identity, scripts/bake-coats.mjs); its lossless page is the product file
 *  `coatPages.ts` paints under the same name (GR8 G35). */
export function pineHullResources(tier: 'phone' | 'desktop'): RiggedHullUrls {
  const dot = tier === 'phone' ? '.phone' : '';
  return {
    files: Object.fromEntries(PINE_HULLS.rigs.map(hull => { const prefix = `models/creatures/${hull}${dot}`;
      return [hull, { rig: `${prefix}.rigged.glb`, base: `${prefix}.base.ktx2`, normal: `${prefix}.normal.ktx2` }]; })),
    coats: Object.fromEntries(Object.entries(PINE_HULLS.hulls).flatMap(([variant, hull]) => {
      const [kind = '', id = ''] = variant.split(':'), page = `${hull}${dot}.${kind}.${id}.coat.png`, key = `procedural:/assets/pine-hollow/creatures/${page}`;
      return Object.hasOwn(GPU_FILES[tier], key) ? [[`${hull}:${variant}`, { key, image: `models/creatures/${page}` }]] : [];
    })),
    parts: { file: `models/creatures/thrall-extras${dot}.glb`, nodes: { 'boar:thrall': 'boar_thrall', 'elk:thrall': 'elk_thrall' } },
  };
}
const { coats: _recipes, ...family } = PINE_HULLS;
export const PINE_HULL_BOOK: RiggedHullBook = { family, productFiles: true,
  tiers: { phone: pineHullResources('phone'), desktop: pineHullResources('desktop') } };
