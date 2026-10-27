import original from './driftwood-layout-original.json' with { type: 'json' };
import { parseDriftwoodFixedLayouts } from '../../src/shards/driftwood-isle/generators/namedSchemas';
import { driftwoodHeldArms } from '../../src/shards/driftwood-isle/generators/heldArms';

/** Complete original native site facts, frozen before GR7 reader retirement. */
export const DRIFTWOOD_LAYOUTS = parseDriftwoodFixedLayouts(original);
export const HELD_ARMS = driftwoodHeldArms(DRIFTWOOD_LAYOUTS.wreck);
