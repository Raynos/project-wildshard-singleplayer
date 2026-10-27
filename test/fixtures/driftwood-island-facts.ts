import { readFileSync } from 'node:fs';
import { driftwoodIslandFactsFrom } from '../../src/shards/driftwood-isle/generators/islandFacts';

export const DRIFTWOOD_ISLAND_FACTS = await driftwoodIslandFactsFrom(url => new Uint8Array(readFileSync(`public${url}`)));
