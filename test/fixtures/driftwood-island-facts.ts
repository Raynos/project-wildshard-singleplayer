import original from './driftwood-island-original.json' with { type: 'json' };
import { parseDriftwoodIslandFacts } from '../../src/shards/driftwood-isle/generators/islandFacts';

/** Complete original native observations, retained independently of later producer changes. */
export const DRIFTWOOD_ISLAND_FACTS = parseDriftwoodIslandFacts(new TextEncoder().encode(JSON.stringify(original)));
