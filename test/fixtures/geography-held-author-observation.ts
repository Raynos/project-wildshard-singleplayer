import { withPortableMath } from '../../src/commons/bake/portableMath';
import { nalatiGeographyRows } from '../../src/shards/nalati-grasslands/generators/geographySource';
import { SIGNAL_DUNES_MAP } from '../../src/shards/sunscar-dunes/generators/minimap';
import { keeperRows } from '../../src/shards/driftwood-isle/generators/keeperRows';
import { enemyPlacements } from '../../src/shards/driftwood-isle/generators/enemyPlacement';
import { populationProjectionRows } from '../../src/shards/driftwood-isle/generators/populationProjection';
import { driftwoodBakedCove } from '../../src/shards/driftwood-isle/generators/bakedCove';
import { driftwoodHeldArms } from '../../src/shards/driftwood-isle/generators/heldArms';
import { DRIFTWOOD_ISLAND_FACTS } from './driftwood-island-facts';
import { DRIFTWOOD_LAYOUTS } from './driftwood-layout-source';
import { RETURN_PROGRAM } from './driftwood-guest-programs';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Platform-stable, complete before-controls; no source values or shipped Math are changed. */
export function geographyHeldAuthorObservation() {
  return withPortableMath(() => Object.entries({ geography: nalatiGeographyRows(), map: SIGNAL_DUNES_MAP,
    keeper: keeperRows(enemyPlacements(), RETURN_PROGRAM), projection: populationProjectionRows(DRIFTWOOD_ISLAND_FACTS, RETURN_PROGRAM),
    cove: driftwoodBakedCove(DRIFTWOOD_ISLAND_FACTS), held: driftwoodHeldArms(DRIFTWOOD_LAYOUTS.wreck) }).map(([name, row]) => {
      const bytes = new TextEncoder().encode(JSON.stringify(row)); return { name, bytes: bytes.length, hash: hashImmutableBytes(bytes) };
    }));
}
