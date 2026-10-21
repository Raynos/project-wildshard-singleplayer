import { CREATURE_BODIES } from '../../src/shards/driftwood-isle/species/bodies';
import { crabShell } from '../../src/shards/driftwood-isle/species/crab';
import rows from '../../src/shards/driftwood-isle/data/creatureLookRows.json' with { type: 'json' };
import sailor from '../../src/shards/driftwood-isle/data/sailorClips.generated.json' with { type: 'json' };
import crab from '../../src/shards/driftwood-isle/data/crabClips.generated.json' with { type: 'json' };
import captain from '../../src/shards/driftwood-isle/data/captainClips.generated.json' with { type: 'json' };

/** Test-only authored intake; shipping consumers bind the verified product file. */
const looks = CREATURE_BODIES.looks({ rows, poses: { sailor, crab, captain } });
export const MONKEY_LOOK = looks.get('monkey'), SAILOR_LOOK = looks.get('sailor'), CAPTAIN_LOOK = looks.get('captain');
export const CRAB_LOOK = { ...looks.get('crab'), damageMul: crabShell };
export const DRIFTWOOD_LOOKS = [CRAB_LOOK, MONKEY_LOOK, SAILOR_LOOK, CAPTAIN_LOOK];
