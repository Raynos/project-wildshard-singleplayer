import product from './generators/product';
import { CARD } from './data/card';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import boss from './behaviour/boss.json' with { type: 'json' };
import { BUILD_OPTIONS } from './generators/buildOptions';

// Edit this documented project entry; the cold producer reads the same author-only declaration.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads this project entry.
export default parseShardfile({ ...product, manifest: CARD,
  // Reserve 1 MB for critical bytes (the actual closure is below 0.3 MB).
  // The output compiler adds its module within the 2 MB platform cap.
  budgets: { ...product.budgets, sim: { ...product.budgets.sim,
    compressed: 1_000_000 - boss.compressed } },
});


/** Explicit standalone AssemblyScript policy, consumed only by the author build. */
export const buildOptions = { ...BUILD_OPTIONS };
