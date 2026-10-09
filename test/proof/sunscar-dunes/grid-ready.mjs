// Plain Node grid admission and durable regional continuation of the actual shard through its declared trusted headless entry.
import source from '../../../src/shards/sunscar-dunes/shard.config.ts';
import { proveTrustedGridReady } from '../compatibility/gridReady.mjs';

console.info(JSON.stringify(await proveTrustedGridReady(source)));
