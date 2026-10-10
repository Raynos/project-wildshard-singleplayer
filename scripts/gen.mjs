// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards } from './gen-shards.mjs';
import { genBudgetDerivations } from './gen-budget-derivations.mjs';
import { genAskIds } from './gen-ask-ids.mjs';
import { prepareGeneration } from './generate.mjs';
import { genPortShares } from './gen-port-shares.mjs';

// G292 admitted outputs are ready before asset sizes, versions and shard packing read them.
await prepareGeneration(`${import.meta.dirname}/..`);
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
// SF74 W13 (G281): the API surface, docs/api/*.md and the export index are build outputs, gitignored (~1 s).
const { writeApiDocs } = await import('./gen-api.mjs');
writeApiDocs();
