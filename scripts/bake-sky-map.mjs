import { readFileSync } from 'node:fs';
import { skyMapSources, SKY_MAP_INPUTS } from '../src/shards/far-reach/generators/bake-map.mjs';
import { paintDataMap } from './bake-data-maps.mjs';

// The catalogue names the defining recipe separately from this I/O driver.
if (process.argv[2] !== 'src/shards/far-reach/generators/bake-map.mjs') throw new Error('Sky map driver requires its explicit defining source');

// The registered runner confines native reads to this producer's exact list.
const native = new Map(SKY_MAP_INPUTS.map(url => [url,
  new Uint8Array(readFileSync(new URL(`../public${url}`, import.meta.url)))]));
await paintDataMap(process.cwd(), 'far-reach', { sources: await skyMapSources(native) });
