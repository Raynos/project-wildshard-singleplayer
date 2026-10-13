// Retained transitional painted places/specimens runner; the nine dressing recipes are independent.
import { withPortableMath } from '@wildshard/commons/bake/portableMath';
import { bakeNalatiPlacesOnTerrain } from './places.ts';
import { readNalatiTerrain, writeNalatiParts } from './bake-nalati-places.mjs';

const made = bakeNalatiPlacesOnTerrain(readNalatiTerrain(), withPortableMath);
writeNalatiParts([{ name: 'places', json: 'places.json', part: made.places },
  { name: 'specimens', json: 'placeSpecimens.json', part: made.specimens }], process.argv.includes('--check'));
