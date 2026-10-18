import type { RiggedHullBook, RiggedHullUrls } from '@wildshard/format/riggedHulls';
import { PINE_HULLS } from './creatureHulls';
import coatPages from '../data/coatPages.generated.json' with { type: 'json' };

/** Preserve logical product names and the original per-tier coat identities. */
export function pineHullResources(tier: 'phone' | 'desktop'): RiggedHullUrls {
  const dot = tier === 'phone' ? '.phone' : '';
  return {
    files: Object.fromEntries(PINE_HULLS.rigs.map(hull => { const prefix = `models/creatures/${hull}${dot}`;
      return [hull, { rig: `${prefix}.rigged.glb`, base: `${prefix}.base.ktx2`, normal: `${prefix}.normal.ktx2` }]; })),
    coats: Object.fromEntries(Object.entries(PINE_HULLS.hulls).flatMap(([variant, hull]) => {
      const [kind = '', id = ''] = variant.split(':'), key = `procedural:/assets/pine-hollow/creatures/${hull}${dot}.${kind}.${id}.coat.png`;
      const pages: Readonly<Record<string, { image: string }>> = coatPages.tiers[tier], page = pages[key];
      return page === undefined ? [] : [[`${hull}:${variant}`, { key, image: page.image }]];
    })),
    parts: { file: `models/creatures/thrall-extras${dot}.glb`, nodes: { 'boar:thrall': 'boar_thrall', 'elk:thrall': 'elk_thrall' } },
  };
}
const { coats: _recipes, ...family } = PINE_HULLS;
export const PINE_HULL_BOOK: RiggedHullBook = { family, productFiles: true,
  tiers: { phone: pineHullResources('phone'), desktop: pineHullResources('desktop') } };
