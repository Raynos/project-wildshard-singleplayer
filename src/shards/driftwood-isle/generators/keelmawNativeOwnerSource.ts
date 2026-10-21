import { emptyShardfile } from '@wildshard/sdk/author';
import { parseShardfile, type Shardfile } from '@wildshard/sdk/shardfile';
import { KEELMAW_ACTORS, KEELMAW_FIELDS } from './keelmawCombat';

/** Build-only isolated actor catalogue, not a world placement or arena admission. */
export function createKeelmawNativeOwnerSource(): Shardfile {
  const base = emptyShardfile({ slug: 'driftwood-isle', name: 'Keelmaw Native Owner WIP', author: 'Wildshard', revision: 1, seed: 0x5ea1 });
  const memory = 2 * 65536;
  return parseShardfile({ ...base, state: { ...base.state, shared: KEELMAW_FIELDS },
    serverBudget: { ...base.serverBudget, memory: base.serverBudget.memory + memory },
    budgets: { ...base.budgets, sim: { ...base.budgets.sim, resident: memory } },
    runtime: { entry: 'runtime/hybrid.ts', binds: ['spawns'], spawns: { homes: [], bosses: [], actors: KEELMAW_ACTORS } },
  });
}
