import foliage from './foliagePlacements.generated.json' with { type: 'json' };
import cumulusPuffs from './cumulusPuffs.json' with { type: 'json' };
import islandClips from './islandClips.generated.json' with { type: 'json' };
import chimeSlots from './chimeSlots.json' with { type: 'json' };
import coveBake from './coveBake.json' with { type: 'json' };
import shrineBake from './shrineBake.json' with { type: 'json' };
import trophySlotsBake from './trophySlots.json' with { type: 'json' };
import hut from './hutBake.json' with { type: 'json' };
import lookout from './lookoutBake.json' with { type: 'json' };
import trailside from './trailsideBake.json' with { type: 'json' };
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from './questInventory';
import { GULL_FLOCK } from './gullsLook';
import { OCEAN_SURFACE } from './oceanLook';
import { OCEAN_FILES } from './oceanFiles';

const foliageRows:Readonly<Record<string,unknown>>=foliage;

/** Authored client rows; the generated canonical registry validates them at publication. */
export const DRIFTWOOD_CLIENT_SECTIONS: readonly {name:string;value:unknown}[] = [
  {name:'custom/cumulusPuffs', value:cumulusPuffs},
  {name:'custom/islandClips', value:islandClips},
  {name:'custom/gullFlock', value:GULL_FLOCK},
  {name:'custom/oceanSurface', value:{surface:OCEAN_SURFACE, files:OCEAN_FILES}},
  {name:'custom/fixedLayouts', value:{chimeSlots, gullPerches:foliageRows['gullPerches'], cove:coveBake, shrine:shrineBake, trophySlots:trophySlotsBake, hut, lookout}},
  {name:'custom/trailside', value:trailside},
  {name:'custom/questRows', value:{feats:DRIFTWOOD_FEATS, items:DRIFTWOOD_ITEMS}},
];
