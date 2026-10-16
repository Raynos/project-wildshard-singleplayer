// SHARD-PLATFORM W2c / G466 C2: Driftwood's SF59 material graphs, emitted as JSON by the `driftwood-look-materials`
// generation job (scripts/generation-jobs.json → data/lookMaterials.generated.json, gitignored, rebuilt by `pnpm gen`).
// Every graph but the water's is authored graph JSON (data/lookGraphs.json); the water's builders stay here for O4's H7.
import authored from '../data/lookGraphs.json' with { type: 'json' };
import { CASCADE_GRAPHS } from './waterfallGraphs';
import { REEF_GRAPHS } from './reefGraphs';
import { POOL_GRAPHS } from './poolGraphs';
import { OCEAN_GRAPHS } from './oceanGraphs';

/**
 * The graphs by look.materials id, in the declaration's order: the cove's cascade, the castaway's smoke and the shrine's
 * fireflies (authored `effects`), the lagoon's reef, the cove's pools, the sea, then the authored `looks`: the faceted
 * sky's dome and cumulus, the faceted ground and its slab, the streamed cover, the baked cove's terrain and props, the
 * low-poly kit's variants, the castaway arms and their swords, the gulls and the creatures.
 */
export function driftwoodLookMaterials(): Readonly<Record<string, unknown>> {
  return { ...CASCADE_GRAPHS, ...authored.effects, ...REEF_GRAPHS, ...POOL_GRAPHS, ...OCEAN_GRAPHS, ...authored.looks };
}
