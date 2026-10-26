// Retained transitional painted places/specimens runner; the nine dressing recipes are independent.
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places.ts';
import { readNalatiTerrain, writeNalatiParts } from './bake-nalati-places.mjs';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareNalatiDressingInputs } from './dressingInputs.ts';
import { bakeNalatiDressingSource } from './dressingSource.ts';

/** Fresh retained native construction; publication remains the CLI's separate responsibility. */
export async function nativeNalatiPlaces() {
  const terrain = readNalatiTerrain();
  const scalarBlocks = new Map(['pond', 'red', 'green', 'blue'].map(name => {
    const file = `data/geography-${name}.bin`;
    return [file, readFileSync(resolve(import.meta.dirname, '..', file))];
  }));
  // Preserve the original continuous forest decisions and non-drawing desktop policy.
  const source = prepareNalatiDressingInputs({ terrain: new Uint8Array(terrain), scalarBlocks,
    forest: 'continuous', phone: false });
  const dressing = await bakeNalatiDressingSource(source);

  return bakeNalatiPlacesOnTerrain(terrain, withPortableMath, dressing);
}

if (import.meta.main) {
  const made = await nativeNalatiPlaces();
  writeNalatiParts([{ name: 'places', json: 'places.json', part: made.places },
    { name: 'specimens', json: 'placeSpecimens.json', part: made.specimens }], process.argv.includes('--check'));
}
