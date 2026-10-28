import { driftwoodOceanWaterRow } from '../../src/shards/driftwood-isle/generators/clientSections';
import { driftwoodOceanBank } from '../../src/shards/driftwood-isle/generators/oceanBank';
import { DRIFTWOOD_LAYOUTS } from './driftwood-layout-source';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Observe the complete sea row and all original pre-page-codec grid/floor bytes. */
export function driftwoodOceanObservation() {
  const bank = driftwoodOceanBank(), bytes = new TextEncoder().encode(JSON.stringify(driftwoodOceanWaterRow(DRIFTWOOD_LAYOUTS)));
  return { row: { bytes: bytes.length, hash: hashImmutableBytes(bytes) }, files: (['phone', 'desktop', 'floor'] as const).map(tier => ({ tier,
    bytes: bank.files[tier].length, hash: hashImmutableBytes(bank.files[tier]), url: bank.urls[tier] })) };
}
