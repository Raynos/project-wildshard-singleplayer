// Native construction for the map and independent original-bake comparisons.
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places.ts';
import { readNalatiTerrain } from './bake-nalati-places.mjs';

import { nalatiGeographySources } from './geographySource.ts';
import { prepareNalatiDressingInputs } from './dressingInputs.ts';
import { bakeNalatiDressingSource } from './dressingSource.ts';

/** Fresh native construction without publishing source or public handoffs. */
export async function nativeNalatiPlaces(geography) {
  const terrain = readNalatiTerrain();
  const scalarBlocks = geography ?? nalatiGeographySources();
  // Preserve the original continuous forest decisions and non-drawing desktop policy.
  const source = prepareNalatiDressingInputs({ terrain: new Uint8Array(terrain), scalarBlocks,
    forest: 'continuous', phone: false });
  const dressing = await bakeNalatiDressingSource(source);

  return bakeNalatiPlacesOnTerrain(terrain, withPortableMath, dressing);
}
