// SHARD-PLATFORM W2c (build-time look graphs): Driftwood's SF59 material graphs, built at build time and emitted as JSON
// by the `driftwood-look-materials` generation job (scripts/generation-jobs.json → data/lookMaterials.generated.json,
// gitignored, rebuilt by `pnpm gen`). shard.config.ts reads that JSON into the shardfile's `look.materials`, so play code
// that reads the declaration never runs a graph builder. Until the runtime data API (P2a `product.section('look/materials')`)
// lands, the declaration is still the TypeScript shard.config.ts that play code imports.
import type { GraphIr } from '@wildshard/format/materialGraph';
import { GROUND_GRAPHS } from './groundGraphs';
import { COVER_GRAPHS } from './coverGraphs';
import { ISLAND_GRAPHS } from './islandGraphs';

/** The graphs by look.materials id, in the declaration's order (the ground, the cover, the baked cove). */
export function driftwoodLookMaterials(): Record<string, GraphIr> {
  return { ...GROUND_GRAPHS, ...COVER_GRAPHS, ...ISLAND_GRAPHS };
}
