import { defineSpecimenCatalogue } from '@wildshard/game/models/specimenCatalogue';
import rows from '../boot/balbalSpecimen.generated.json' with { type: 'json' };
/**
 * The balbal (E306 / E315 M3): a Turkic stone warrior (6th–8th c. kurgan stele, the Xiaohongnahai stone man) — a
 * granite pillar carved into a man holding a cup to his chest with the right hand, the left on a sabre hilt at the belt,
 * a heavy brow, a drooping moustache, lichen on the weathered tops. Two on each small kurgan's crown; B11 wakes them at dusk.
 *
 * What ships is the TRELLIS.2 model (`balbal.glb`, scripts/img2mesh/props/nalati.json), turned to face −z and scaled
 * to the carved stele's 2.15 m. The two carved code variants (bare-headed, a pointed cap and beard) are drawn until the
 * file lands and are the Explorer's other two variants. Placed instanced at the crown sites (game/boss/encounterView
 * EncounterSites, data/balbalSites.json): one InstancedMesh per carved variant, both wearing the generated model once it
 * has loaded; each site is a box that stops colliding while its warrior is awake.
 *
 * `balbalGeometry(variant)` (feet at y 0, facing −z, 2.1 m) is B11's rig's body too.
 */
import type * as THREE from 'three';
import { SHAPES } from './shapes';

export type BalbalCarving = 'bare' | 'capped';

export interface BalbalParams {
  /** a carved code stele, or null: the generated (TRELLIS.2) model */
  readonly carved: BalbalCarving | null;
}

/** A fresh copy of the admitted carving; consumers may transform it in place. */
export function balbalGeometry(variant: number, seed = 0xba1): THREE.BufferGeometry {
  return SHAPES.handle(`balbal:${String(variant)}:${String(seed)}`).copy();
}

export const balbal = defineSpecimenCatalogue<{balbal:BalbalParams}>(rows.catalogue).model('balbal');
