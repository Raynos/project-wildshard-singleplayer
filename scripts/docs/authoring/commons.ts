import { starterBagPack } from '@wildshard/commons/packs/bag';
import { starterArmClipsPack } from '@wildshard/commons/packs/arms';
import { starterWeaponsPack } from '@wildshard/commons/packs/weapons';
import { createCatalogue, catalogueRef } from '@wildshard/commons/catalogue';
import { commonsRequirements } from '@wildshard/sdk/commons';

/** The shared starter catalogue, selected identically by two author products. */
export function commonsExample() {
  const provenance = { credit: 'Wildshard shared starter data', licence: 'First-party' };
  const built = createCatalogue([starterBagPack(provenance), starterArmClipsPack(provenance), starterWeaponsPack(provenance)]);
  const bag = catalogueRef(built.catalogue, 'bag/starter-items');
  const requirements = commonsRequirements(built, [bag.entry.id]);
  return { built, ref: bag.ref, first: requirements, second: commonsRequirements(built, [bag.entry.id]) };
}
