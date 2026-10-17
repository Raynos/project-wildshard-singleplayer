import { FIXED_DRAW_ROWS } from './modelFiles';
import { ISLAND_KNOBS } from './tiers';
import { ENTRY_DECKS } from './entryDecks';
import ironSword from '../data/ironSwordScene.json' with {type:'json'};
import npcScenes from '../data/npcScenes.generated.json' with {type:'json'};
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };
import cumulusPuffs from '../data/cumulusPuffs.json' with { type: 'json' };
import chimeSlots from '../data/chimeSlots.json' with { type: 'json' };
import coveBake from '../data/coveBake.json' with { type: 'json' };
import shrineBake from '../data/shrineBake.json' with { type: 'json' };
import trophySlotsBake from '../data/trophySlots.json' with { type: 'json' };
import hut from '../data/hutBake.json' with { type: 'json' };
import lookout from '../data/lookoutBake.json' with { type: 'json' };
import trailside from '../data/trailsideBake.json' with { type: 'json' };
import piers from '../data/piers.generated.json' with { type: 'json' };
import { DRIFTWOOD_FEATS, DRIFTWOOD_ITEMS } from './questInventory';
import { GULL_FLOCK } from './gullsLook';
import { OCEAN_SURFACE } from './oceanLook';
import { OCEAN_FILES } from './oceanFiles';

const foliageRows:Readonly<Record<string,unknown>>=foliage;

/** Build-only client row assembly; the canonical registry validates it at publication. */
export const DRIFTWOOD_CLIENT_SECTIONS: readonly {name:string;value:unknown}[] = [
  {name:'custom/cumulusPuffs', value:cumulusPuffs},
  {name:'custom/gullFlock', value:GULL_FLOCK},
  {name:'custom/oceanSurface', value:{surface:OCEAN_SURFACE, files:OCEAN_FILES}},
  {name:'custom/fixedLayouts', value:{fixedDraws:FIXED_DRAW_ROWS, shadowTiers:Object.fromEntries(Object.entries(ISLAND_KNOBS).map(([tier,row])=>[tier,{bush:row.bushShadows,boulder:row.boulderShadows}])), ironSword, entryDecks:ENTRY_DECKS, foliage:{seed:foliage.seed,tiers:foliage.tiers}, npcScenes, chimeSlots, gullPerches:foliageRows['gullPerches'], cove:coveBake, shrine:shrineBake, trophySlots:trophySlotsBake, hut, lookout, piers:piers.map(({paramKey,colliders})=>({paramKey,colliders}))}},
  {name:'custom/trailside', value:trailside},
  {name:'custom/questRows', value:{feats:DRIFTWOOD_FEATS, items:DRIFTWOOD_ITEMS}},
];
