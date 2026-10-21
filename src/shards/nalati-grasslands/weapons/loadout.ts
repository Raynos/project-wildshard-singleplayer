import { MountedArsenal, type MountedLoadout } from '@wildshard/game/loadout/mounted';


import gear from '../boot/gear.generated.json' with { type: 'json' };
import { fetchLaneBake } from '@wildshard/game/plugin/geometry';
import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';

export const arsenal = new MountedArsenal(gear.loadout);

export const weaponCatalogue = defineSpecimenCatalogue<Record<string, object>>(gear.catalogue.map(row => ({ key: row.key, model: row.model, source: row.source })), gear.packed, gear.materials);

/** The composite recurve's baked rows and parts (generators/recurvePool.ts): the held bow draw's (H3); the Golden Bow and the
 *  Sky-Wolf skin are its paints. */
export type NalatiLoadout = MountedLoadout;
/** Prepare the specimen source before native page equipment assembly. */
export async function prepareWeaponCatalogue():Promise<void>{weaponCatalogue.usePacked(await fetchLaneBake(gear.packed.bin));}

