import * as v from 'valibot';
import { MountedArsenal, type MountedLoadout } from '@wildshard/game/loadout/mounted';
import type { ModelDef } from '@wildshard/engine/models/model';
import { SpecimenBookSchema } from '@wildshard/format/specimenCatalogue';
import loadout from '../boot/mountedLoadout.generated.json' with { type: 'json' };
import { fetchLaneBake } from '@wildshard/game/plugin/geometry';
import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';

export const arsenal = new MountedArsenal(loadout);

let catalogue: ReturnType<typeof defineSpecimenCatalogue<Record<string, object>>> | null = null;
/** The gear's specimen catalogue: the product's gear book (models/gear-book.json), once prepared. */
export const weaponCatalogue = { model: (key: string): ModelDef<object> => {
  if (catalogue === null) throw new Error('Weapon catalogue is not prepared'); return catalogue.model(key);
} };

/** The composite recurve's baked rows and parts (generators/recurvePool.ts): the held bow draw's (H3); the Golden Bow and the
 *  Sky-Wolf skin are its paints. */
export type NalatiLoadout = MountedLoadout;
/** Prepare the specimen source (the product's gear book and its packed geometry) before native page equipment assembly. */
export async function prepareWeaponCatalogue(product: { readonly json: (name: string) => Promise<unknown> }): Promise<void> {
  const book = v.parse(SpecimenBookSchema, await product.json('models/gear-book.json')), packed = book.packed;
  if (packed === undefined) throw new Error('Gear book has no packed specimens');
  const prepared = catalogue ?? defineSpecimenCatalogue<Record<string, object>>(book.rows, packed, book.materials);
  prepared.usePacked(await fetchLaneBake(packed.bin)); catalogue = prepared;
}

