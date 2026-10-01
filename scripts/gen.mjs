// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards } from './gen-shards.mjs';
import { genAskIds } from './gen-ask-ids.mjs';

await import('./bake-loader.mjs');
const shard = process.argv.find((arg) => arg.startsWith('--shard='))?.slice(8);
genShards(undefined, false, false, shard);
genAskIds();
const { generateBootTables } = await import('../vite/gen.ts');
generateBootTables();
// Boot tables add static imports; derive the closure from the completed graph.
genShards(undefined, false, false, shard);
