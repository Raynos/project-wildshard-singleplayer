import type { NamedBlob } from '@wildshard/sdk/blobs';
import { namePopulationHabitat } from '@wildshard/sdk/nativePopulationRows';
import rows from '../data/physicsRows.json' with {type:'json'};

/** Population metadata is admitted by the existing named JSON reader. The
 * authored canopy count is part of this file's schema, not a runtime profile. */
export function nalatiPopulationMetadataBlob():NamedBlob {
  return namePopulationHabitat('sim/population-metadata.json',
    { trees: rows.trees, tops: rows.tops, ledges: rows.ledges, marmots: rows.marmots }, rows.trees.length, 6);
}
