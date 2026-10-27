import { defineSpecimenCatalogue } from '@wildshard/sdk/bake/specimenCatalogue';
import gear from '../data/gear.json' with { type: 'json' };

/** The eight prepared gear cards are data; their original packed shapes own every draw and paint variant. */
const catalogue = defineSpecimenCatalogue({
  rows: gear.catalogue.map(({ key, model, source }) => ({ key, model, source })),
  packed: gear.packed, materials: gear.materials,
});

/** The same complete book emitted by the cover producer and consumed by the entered arsenal and Explorer. */
export const GEAR_BOOK = catalogue.book;
export const bow = catalogue.model('bow');
export const arrow = catalogue.model('arrow');
export const sabre = catalogue.model('sabre');
export const spear = catalogue.model('spear');
export const javelin = catalogue.model('javelin');
export const goldenBow = catalogue.model('goldenBow');
export const naizagai = catalogue.model('naizagai');
export const ar15 = catalogue.model('ar15');
