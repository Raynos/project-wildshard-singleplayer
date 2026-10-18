import type { RiggedHullBook, RiggedHullUrls } from '@wildshard/format/riggedHulls';
import coatPages from './bake-nalati-coats.json' with { type: 'json' };
import rows from '../data/creatureRigs.json' with { type: 'json' };
import metadata from '../bootMetadata.generated.json' with { type: 'json' };

export const { hulls: CREATURE_HULLS } = rows;
/** The retained coat baker and resource book share one authored cache name. */
export function nalatiCoatUrl(hull: string, kind: string, variant: string): string {
  return `${metadata.assetFiles.coats}${hull}.${kind}.${variant}.coat.webp`;
}

/** Keep the painterly atlas/AO, sheet wings and exact authored coat cache keys. */
function resources(tier: 'phone' | 'desktop'): RiggedHullUrls {
  const keys = new Set(Object.keys(coatPages[tier]));
  return { files: Object.fromEntries(rows.rigs.map(hull => [hull, `/assets/nalati/models/${hull}${tier === 'phone' ? '.phone' : ''}.rigged.glb`])),
    coats: Object.fromEntries(Object.entries(CREATURE_HULLS).flatMap(([variant, hull]) => {
      const [kind = '', id = ''] = variant.split(':'), image = nalatiCoatUrl(hull, kind, id);
      const phone = image.replace(/\.webp$/u, '.phone.webp'), key = tier === 'phone' && keys.has(phone) ? phone : image;
      return keys.has(key) ? [[`${hull}:${variant}`, { key, image }]] : [];
    })), vertexColours: true, doubleSided: ['eagle'], coatDecode: 'bitmap' };
}
export const NALATI_HULL_BOOK: RiggedHullBook = {
  family: { label: 'nalati', rigs: [...new Set(Object.values(CREATURE_HULLS))], hulls: CREATURE_HULLS }, productFiles: false,
  tiers: { phone: resources('phone'), desktop: resources('desktop') },
};
