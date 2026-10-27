import fixed from './driftwood-fixed-original.json' with { type: 'json' };
import { driftwoodFixedProductRows } from '../../src/shards/driftwood-isle/generators/fixedProduct';
import { driftwoodProductRows } from '../../src/shards/driftwood-isle/generators/product';

// Complete original fixed-world declaration oracle, frozen before the GR7 source cut.
const product: ReturnType<typeof driftwoodProductRows> = driftwoodProductRows(driftwoodFixedProductRows(fixed));
// oxlint-disable-next-line import/no-default-export -- Existing declaration-only tests borrow the original full header.
export default product;
