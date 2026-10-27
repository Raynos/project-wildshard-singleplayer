import { DRIFTWOOD_GUEST_ROWS } from './driftwood-guest-programs';
import { DRIFTWOOD_ISLAND_FACTS } from './driftwood-island-facts';
import fixed from './driftwood-fixed-original.json' with { type: 'json' };
import { driftwoodFixedProductRows } from '../../src/shards/driftwood-isle/generators/fixedProduct';
import { driftwoodProductRows } from '../../src/shards/driftwood-isle/generators/product';

import { driftwoodAudio } from '../../src/shards/driftwood-isle/generators/audio';
import { DRIFTWOOD_LAYOUTS } from './driftwood-layout-source';

// Complete original fixed-world declaration oracle, frozen before the GR7 source cut.
const product: ReturnType<typeof driftwoodProductRows> = driftwoodProductRows(driftwoodFixedProductRows(fixed), driftwoodAudio(DRIFTWOOD_LAYOUTS.wreck, DRIFTWOOD_ISLAND_FACTS), DRIFTWOOD_GUEST_ROWS.bridge.pages);
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only tests borrow the original full header.
export default product;
