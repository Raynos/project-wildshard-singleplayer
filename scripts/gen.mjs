// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards } from './gen-shards.mjs';
import { genBudgetDerivations } from './gen-budget-derivations.mjs';
import { genAskIds } from './gen-ask-ids.mjs';
import { genPortShares } from './gen-port-shares.mjs';

await import('./bake-loader.mjs');
const shard = process.argv.find((arg) => arg.startsWith('--shard='))?.slice(8);
genShards(undefined, false, false, shard);
genAskIds();
const { generateBootTables } = await import('../vite/gen.ts');
generateBootTables();
await genBudgetDerivations(undefined, process.argv.includes('--check-budgets'), shard);
// Boot tables add static imports; derive the closure from the completed graph.
genShards(undefined, false, false, shard);
// SF65: SHARD SELECT's port badges (the SF6 public share), measured from the completed source tree.
genPortShares();
