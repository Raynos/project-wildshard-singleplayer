import { HullLookBook } from '../../src/game/looks/speciesBook';
import bake from '../../src/shards/driftwood-isle/data/creatureBodies.generated.json' with { type: 'json' };
import rows from '../../src/shards/driftwood-isle/data/creatureLookRows.json' with { type: 'json' };
import { SAILOR_CLIPS as sailor, CAPTAIN_CLIPS as captain } from '../../src/shards/driftwood-isle/generators/humanoidClips';
import { CRAB_CLIPS as crab } from '../../src/shards/driftwood-isle/generators/crabClips';

/** Test-only authored intake; shipping consumers bind the verified product file and `look/hull-book` section. */
const { fauna, ...body } = bake;
/** The island's look book, as its `look/hull-book` section declares it. */
export const DRIFTWOOD_BOOK = new HullLookBook({ ...fauna, body });
const looks = DRIFTWOOD_BOOK.packed.looks({ rows, poses: { sailor, crab, captain } });
export const MONKEY_LOOK = looks.get('monkey'), SAILOR_LOOK = looks.get('sailor'), CAPTAIN_LOOK = looks.get('captain');
export const CRAB_LOOK = looks.get('crab');
export const DRIFTWOOD_LOOKS = [CRAB_LOOK, MONKEY_LOOK, SAILOR_LOOK, CAPTAIN_LOOK];
