import { MeshStandardMaterial, type Material, type Texture } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { EmissiveLook } from '@wildshard/engine/render/families/emissive';
import { setGroundPools, updateGround, type GroundPool } from '@wildshard/engine/render/families/ground';
import { parseFamilyMaterial } from '@wildshard/format/materialFamilies';
import { curvedParams } from '@wildshard/format/materials';
import { mappedFamilyMaterial } from './bakedGround';
import type { DuskSandRow, DuskSkyRow } from '../../data/familyLook';

/**
 * Dusk family surfaces (SHARD-PLATFORM M3; ex a dune shard's sky and sand): a sand that is the PBR family's ground layer
 * over three baked maps (a grain tile, a trail mask, a key-shadow map) and a painted sky that is the emissive family's sky
 * over two dusk stages, both moved by one dusk value (0 the first frame … 1 the end of the dusk) through uniforms only.
 * The sand's dusk terms are state-bound material curves (the format's `look.curves` rows, `curvedParams`); the burning
 * fires are the ground layer's light pools. Nothing here knows a shard: the maps' names and numbers come in as rows.
 */

/** The live sand: its material and the adapter that moves it with the dusk and the fires. */
export interface DuskSand {
  readonly material: MeshStandardMaterial;
  /** feed the dusk (uniforms, only when it moved) and the burning fires */
  readonly update: (dusk: number, fires: readonly GroundPool[]) => void;
}

/** A dusk sand as a PBR family material over its baked maps (keyed by the row's map names), at `dusk`; freed with `scope`. */
export function duskSand(row: DuskSandRow, maps: Readonly<Record<string, Texture>>, dusk: number, scope: Scope): DuskSand {
  let fed = dusk;
  const base = parseFamilyMaterial(row.entry), fedDusk = (): number => fed;
  const material = mappedFamilyMaterial(curvedParams(base, row.curves, fedDusk), maps, scope, row.name);
  if (!(material instanceof MeshStandardMaterial)) throw new Error(`${row.name}: the PBR family compiles to a MeshStandardMaterial`);
  return { material, update: (next, fires) => {
    if (next !== fed) { fed = next; const moved = curvedParams(base, row.curves, fedDusk); if (moved.family === 'pbr' && moved.ground !== null) updateGround(material, moved.ground); }
    setGroundPools(material, fires);
  } };
}

/** A painted dusk sky's family entry: the emissive family's sky over its two stages. */
export function duskSkyEntry(row: DuskSkyRow): unknown {
  return { family: 'emissive', sky: { maps: row.maps, elevation: row.elevation, window: row.window, firstGain: row.firstGain, hold: row.hold } };
}

/** The live sky: the dome's material and the adapter that feeds the dusk as its look's blend. */
export interface DuskSky {
  readonly material: Material;
  readonly update: (dusk: number) => void;
}

/** A painted dusk sky as an emissive family sky over its two stages; freed with `scope`. */
export function duskSky(row: DuskSkyRow, stages: readonly [Texture, Texture], dusk: number, scope: Scope): DuskSky {
  const look = new EmissiveLook({ blend: Math.min(1, Math.max(0, dusk)) });
  const material = mappedFamilyMaterial(duskSkyEntry(row), { [row.maps[0]]: stages[0], [row.maps[1]]: stages[1] }, scope, row.name, look);
  let fed = look.params.blend;
  return { material, update: (next) => {
    const blend = Math.min(1, Math.max(0, next));
    if (blend !== fed) { fed = blend; look.set({ blend }); }
  } };
}
