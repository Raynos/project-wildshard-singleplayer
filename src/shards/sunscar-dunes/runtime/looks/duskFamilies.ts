import type { Material, Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { mappedFamilyMaterial } from './bakedGround';
import type { DuskSkyRow } from '../../data/familyLook';

/**
 * Dusk family surfaces (SHARD-PLATFORM M3; ex a dune shard's sky and sand): a sand that is the PBR family's ground layer
 * over three baked maps (a grain tile, a trail mask, a key-shadow map) and a painted sky that is the emissive family's sky
 * over two dusk stages, both moved by one dusk value (0 the first frame … 1 the end of the dusk) through uniforms only.
 * The sand's dusk terms are state-bound material curves (the format's `look.curves` rows, `curvedParams`); the burning
 * fires are the ground layer's light pools. Nothing here knows a shard: the maps' names and numbers come in as rows.
 */

/** A painted dusk sky's family entry: the emissive family's sky over its two stages. */
export function duskSkyEntry(row: DuskSkyRow): unknown {
  return { family: 'emissive', sky: { maps: row.maps, elevation: row.elevation, window: row.window, firstGain: row.firstGain, hold: row.hold } };
}

/** The live sky: the dome's material and the adapter that feeds the dusk as its look's blend. */
export interface DuskSky {
  readonly material: Material;
  readonly blend: (dusk: number) => void;
}

/** A painted dusk sky as an emissive family sky over its two stages; freed with `scope`. */
export function duskSky(row: DuskSkyRow, stages: readonly [Texture, Texture], dusk: number, scope: Scope): DuskSky {
  const look = new EmissiveLook({ blend: Math.min(1, Math.max(0, dusk)) });
  const material = mappedFamilyMaterial(duskSkyEntry(row), { [row.maps[0]]: stages[0], [row.maps[1]]: stages[1] }, scope, row.name, look);
  let fed = look.params.blend;
  return { material, blend: (next) => {
    const blend = Math.min(1, Math.max(0, next));
    if (blend !== fed) { fed = blend; look.set({ blend }); }
  } };
}
