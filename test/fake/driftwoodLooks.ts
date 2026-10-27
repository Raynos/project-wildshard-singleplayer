import { HullLookBook } from '../../src/game/looks/speciesBook';
// oxlint-disable-next-line import/no-nodejs-modules -- The fake reads the bodies' committed head and captain.
import { readFileSync } from 'node:fs';
import { driftwoodCreatureBodyBank } from '../../src/shards/driftwood-isle/generators/creatureBodyBank';
import rows from '../../src/shards/driftwood-isle/data/creatureLookRows.json' with { type: 'json' };
import { SAILOR_CLIPS as sailor, CAPTAIN_CLIPS as captain } from '../../src/shards/driftwood-isle/generators/humanoidClips';
import { CRAB_CLIPS as crab } from '../../src/shards/driftwood-isle/generators/crabClips';

/** Test-only authored intake; shipping consumers bind the verified product file and `look/hull-book` section. */
const bank = await driftwoodCreatureBodyBank(url => new Uint8Array(readFileSync(`public${url}`)));
const { fauna, ...body } = bank.rows;
/** The island's look book, as its `look/hull-book` section declares it, over the packed bodies' product file. */
export const DRIFTWOOD_BOOK = new HullLookBook({ ...fauna, body }, { file: name => name === body.file ? Promise.resolve(bank.bin) : Promise.reject(new Error(`Unknown product file ${name}`)) });
const looks = DRIFTWOOD_BOOK.packed.looks({ rows, poses: { sailor, crab, captain } });
export const MONKEY_LOOK = looks.get('monkey'), SAILOR_LOOK = looks.get('sailor'), CAPTAIN_LOOK = looks.get('captain');
export const CRAB_LOOK = looks.get('crab');
export const DRIFTWOOD_LOOKS = [CRAB_LOOK, MONKEY_LOOK, SAILOR_LOOK, CAPTAIN_LOOK];
