// Plain Node grid admission and durable regional continuation of the actual shard through its declared trusted headless
// entry. Nine Dragon Stack's cell is the dev server's (catalogue `devserver`), so it admits in that grid mode.
import source from '../../../src/shards/nine-dragon-stack/shard.config.ts';
import { proveTrustedGridReady } from '../compatibility/gridReady.mjs';

console.info(JSON.stringify(await proveTrustedGridReady(source, { developer: false, devserver: true })));
