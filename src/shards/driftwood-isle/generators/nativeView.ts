import authoredCoverLook from '../data/groundCover.json' with { type: 'json' };
import { BOAT_LAYOUT } from './boatLayout';
import captain from '../data/bossEncounter.json' with { type: 'json' };
import { COUNTER_TOP } from './counterLayout';
import { CREATURE_LOOKS } from './creatureLook';
import { FIREFLY_LOOK } from './fireflyLook';
import { GULL_GRAPH_LOOK } from './gullGraphLook';
import spots from '../data/spots.generated.json' with { type: 'json' };
import ziplineRows from '../data/zipline.generated.json' with { type: 'json' };
import { ISLAND_LOOKS } from './islandLook';
import { ISLAND_LOOK, ISLAND_TIERS } from './islandRows';
import { CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS, TRADER_FACING, TRADER_HEAD_FOCUS } from './npcFocus';
import { CASTAWAY_POSE, TRADER_POSE } from './npcPose';
import { OCEAN_LOOK } from './oceanLook';
import authoredPoolLook from '../data/poolLook.json' with { type: 'json' };
import { TROPHY_LAYOUT } from './trophyLayout';
import SHRINE_SITES from '../data/shrineSites.json' with { type: 'json' };
import { REEF_LOOK } from './reefLook';
import { TRAIL_SPECIMEN_ROWS } from './trailSpecimenRows';
import { TRAIL_SPECIMENS } from './trailSpecimens';
import { REEF_ROCK, SHORE_ROCK } from './rockProfiles';
import { CASTAWAY_SMOKE, SMOKE_LOOK } from './smokeLook';
import { CASCADE_LOOKS } from './waterfallLook';
import WRECK_SITES from '../data/wreckSites.json' with { type: 'json' };

const { COVER_LOOKS } = authoredCoverLook;
const { POOL_LOOK, SHRINE_POOL_LOOK } = authoredPoolLook;

/** Canonical authored view rows, emitted into the admitted native-view section. */
export const NATIVE_VIEW: { BOSS_ENCOUNTER: typeof captain; BOAT_LAYOUT: typeof BOAT_LAYOUT; CAPTAIN_ARENA_R: typeof captain.arena.radius; CAPTAIN_ID: typeof captain.id; CAPTAIN_NAME: typeof captain.name; CASCADE_LOOKS: typeof CASCADE_LOOKS; CASTAWAY_FACING: typeof CASTAWAY_FACING; CASTAWAY_HEAD_FOCUS: typeof CASTAWAY_HEAD_FOCUS; CASTAWAY_POSE: typeof CASTAWAY_POSE; CASTAWAY_SMOKE: typeof CASTAWAY_SMOKE; COUNTER_TOP: typeof COUNTER_TOP; COVER_LOOKS: typeof authoredCoverLook.COVER_LOOKS; CREATURE_LOOKS: typeof CREATURE_LOOKS; FINALE_REWARD: typeof spots.reward; FIREFLY_LOOK: string; GULL_GRAPH_LOOK: string; ISLAND_LOOK: typeof ISLAND_LOOK; ISLAND_TIERS: typeof ISLAND_TIERS; ISLAND_LOOKS: typeof ISLAND_LOOKS; OCEAN_LOOK: string; POOL_LOOK: typeof authoredPoolLook.POOL_LOOK; REEF_LOOK: string; REEF_ROCK: typeof REEF_ROCK; SHORE_ROCK: typeof SHORE_ROCK; SHRINE_POOL_LOOK: typeof authoredPoolLook.SHRINE_POOL_LOOK; SHRINE_SITES: typeof SHRINE_SITES; SMOKE_LOOK: string; TRADER_FACING: typeof TRADER_FACING; TRADER_HEAD_FOCUS: typeof TRADER_HEAD_FOCUS; TRADER_POSE: typeof TRADER_POSE; TRAIL_SPECIMENS: typeof TRAIL_SPECIMENS; TRAIL_SPECIMEN_ROWS: typeof TRAIL_SPECIMEN_ROWS; TROPHY_LAYOUT: typeof TROPHY_LAYOUT; WRECK_SITES: typeof WRECK_SITES; ZIPLINE_ROWS: typeof ziplineRows; } = {
  BOSS_ENCOUNTER: captain,
  BOAT_LAYOUT,
  CAPTAIN_ARENA_R: captain.arena.radius,
  CAPTAIN_ID: captain.id,
  CAPTAIN_NAME: captain.name,
  CASCADE_LOOKS,
  CASTAWAY_FACING,
  CASTAWAY_HEAD_FOCUS,
  CASTAWAY_POSE,
  CASTAWAY_SMOKE,
  COUNTER_TOP,
  COVER_LOOKS,
  CREATURE_LOOKS,
  FINALE_REWARD: spots.reward,
  FIREFLY_LOOK,
  GULL_GRAPH_LOOK,
  ISLAND_LOOK,
  ISLAND_TIERS,
  ISLAND_LOOKS,
  OCEAN_LOOK,
  POOL_LOOK,
  REEF_LOOK,
  REEF_ROCK,
  SHORE_ROCK,
  SHRINE_POOL_LOOK,
  SHRINE_SITES,
  SMOKE_LOOK,
  TRADER_FACING,
  TRADER_HEAD_FOCUS,
  TRADER_POSE,
  TRAIL_SPECIMENS,
  TRAIL_SPECIMEN_ROWS,
  TROPHY_LAYOUT,
  WRECK_SITES,
  ZIPLINE_ROWS: ziplineRows,
};
