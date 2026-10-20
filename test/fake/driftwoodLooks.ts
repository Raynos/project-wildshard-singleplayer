import { CREATURE_BODIES } from '../../src/shards/driftwood-isle/species/bodies';
import { CRAB_LOOK } from '../../src/shards/driftwood-isle/species/crab';
import { CAPTAIN_LOOK } from '../../src/shards/driftwood-isle/species/captain';
import rows from '../../src/shards/driftwood-isle/data/creatureLookRows.json' with { type: 'json' };
import sailor from '../../src/shards/driftwood-isle/data/sailorClips.generated.json' with { type: 'json' };

/** Test-only authored intake; shipping consumers bind the verified product file. */
const looks = CREATURE_BODIES.looks({ rows, poses: { sailor } });
export const MONKEY_LOOK = looks.get('monkey'), SAILOR_LOOK = looks.get('sailor');
export const DRIFTWOOD_LOOKS = [CRAB_LOOK, MONKEY_LOOK, SAILOR_LOOK, CAPTAIN_LOOK];
