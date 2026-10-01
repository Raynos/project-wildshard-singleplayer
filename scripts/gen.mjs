// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards } from './gen-shards.mjs';
import { genAskIds } from './gen-ask-ids.mjs';

await import('./bake-loader.mjs');
genShards();
genAskIds();
const { generateBootTables } = await import('../vite/gen.ts');
generateBootTables();
