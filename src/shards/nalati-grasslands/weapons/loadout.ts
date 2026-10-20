import type { MountedLoadout } from '@wildshard/game/loadout/mounted';
import type { HeldPolearmWorld } from '@wildshard/game/weapons/heldPolearm';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';


import gear from '../boot/gear.generated.json' with { type: 'json' };
import { Rng } from '@wildshard/engine/core/rng';
import { fetchLaneBake } from '@wildshard/game/plugin/geometry';
import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import { modelContext } from '@wildshard/engine/models/model';
import { Object3D } from 'three';

export const weaponCatalogue = defineSpecimenCatalogue<Record<string, object>>(gear.catalogue.map(row => ({ key: row.key, model: row.model, source: row.source })), gear.packed, gear.materials);

/** The composite recurve's baked rows and parts (generators/recurvePool.ts): the held bow draw's (H3); the Golden Bow and the
 *  Sky-Wolf skin are its paints. */
export type NalatiWorld = HeldPolearmWorld;
export type NalatiLoadout = MountedLoadout;
/** Prepare the specimen source before native page equipment assembly. */
export async function prepareWeaponCatalogue():Promise<void>{weaponCatalogue.usePacked(await fetchLaneBake(gear.packed.bin));}

/** The reward orb and Explorer resolve the same baked weapon geometry. */
export function weaponSpecimen(key: string, sky: Sky): Object3D {
  const model = weaponCatalogue.model(key);
  const built = model.build(modelContext(sky), model.defaults, new Rng(0));
  if (!(built instanceof Object3D)) throw new Error('Weapon specimen requires a scene');
  return built;
}
