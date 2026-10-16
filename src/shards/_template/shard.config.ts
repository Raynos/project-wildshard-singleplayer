import product from './generators/product';
import { CARD } from './data/card';
import { parseShardfile } from '@wildshard/sdk/shardfile';
import boss from './behaviour/boss.json' with { type: 'json' };
import { BUILD_OPTIONS } from './generators/buildOptions';

// Edit this documented project entry; the cold producer reads the same author-only declaration.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads this project entry.
export default parseShardfile({ ...product, manifest: CARD,
  // The named critical module is added by output.ts inside this existing wire reservation.
  budgets: { ...product.budgets, sim: { ...product.budgets.sim,
    compressed: product.budgets.sim.compressed - boss.compressed } },
});


/** Explicit standalone AssemblyScript policy, consumed only by the author build. */
export const buildOptions = { ...BUILD_OPTIONS };
