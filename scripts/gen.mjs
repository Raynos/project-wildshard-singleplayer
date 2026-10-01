// Node's TypeScript/asset hooks let the CLI and Vite share the same table writers.
import { genShards } from './gen-shards.mjs';

await import('./bake-loader.mjs');
genShards();
const { generateBootTables } = await import('../vite/gen.ts');
generateBootTables();
