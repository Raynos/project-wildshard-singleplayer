// SHARD-PLATFORM W2c (build-time look graphs): Driftwood's SF59 material graphs, built at build time and emitted as JSON
// by the `driftwood-look-materials` generation job (scripts/generation-jobs.json → data/lookMaterials.generated.json,
// gitignored, rebuilt by `pnpm gen`). shard.config.ts reads that JSON into the shardfile's `look.materials`, so play code
// that reads the declaration never runs a graph builder. Until the runtime data API (P2a `product.section('look/materials')`)
// lands, the declaration is still the TypeScript shard.config.ts that play code imports.
import type { GraphIr } from '@wildshard/format/materialGraph';
import { CASCADE_GRAPHS } from './waterfallGraphs';
import { SMOKE_GRAPHS } from './smokeGraphs';
import { FIREFLY_GRAPHS } from './fireflyGraphs';
import { REEF_GRAPHS } from './reefGraphs';
import { POOL_GRAPHS } from './poolGraphs';
import { OCEAN_GRAPHS } from './oceanGraphs';
import { SKY_GRAPHS } from './skyGraphs';
import { GROUND_GRAPHS } from './groundGraphs';
import { COVER_GRAPHS } from './coverGraphs';
import { ISLAND_GRAPHS } from './islandGraphs';
import { KIT_GRAPHS } from './kitGraphs';
import { FP_ARMS_GRAPHS } from './fpArmsGraphs';
import { GULL_GRAPHS } from './gullGraphs';
import { CREATURE_GRAPHS } from './creatureGraphs';

/**
 * The graphs by look.materials id, in the declaration's order: the cove's cascade, the castaway's smoke, the shrine's
 * fireflies, the lagoon's reef, the cove's pools, the sea, the faceted sky's dome and cumulus, the faceted ground and its
 * slab, the streamed cover, the baked cove's terrain and props, the low-poly kit's variants, the castaway arms and their
 * swords, the gulls and the creatures.
 */
export function driftwoodLookMaterials(): Record<string, GraphIr> {
  return { ...CASCADE_GRAPHS, ...SMOKE_GRAPHS, ...FIREFLY_GRAPHS, ...REEF_GRAPHS, ...POOL_GRAPHS, ...OCEAN_GRAPHS, ...SKY_GRAPHS,
    ...GROUND_GRAPHS, ...COVER_GRAPHS, ...ISLAND_GRAPHS, ...KIT_GRAPHS, ...FP_ARMS_GRAPHS, ...GULL_GRAPHS, ...CREATURE_GRAPHS };
}
