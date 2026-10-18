import { parsePageLife } from '@wildshard/format/pageLife';
import { GULL_FLOCK } from './gullsLook';

/** The actual world-built gull draw retains its poses, calls and perches. */
export const PAGE_LIFE = parsePageLife({
  version: 1, seed: GULL_FLOCK.seed, system: GULL_FLOCK.system, draw: null, foragers: [],
  flocks: [{ id: 'gulls', row: GULL_FLOCK, perches: [], packed: false, borrowed: true, audio: 'cue' }],
});
