import { COVER_LOOKS } from '../data/coverLook';
import { BOAT_LAYOUT } from './boatLayout';
import { CAPTAIN_DEF, CAPTAIN_PRESENTATION } from '../data/captainEncounter';
import { COUNTER_TOP } from './counterLayout';
import { CREATURE_LOOKS } from './creatureLook';
import { FP_ARMS_LOOK, FP_ARMS_MATERIALS } from './fpArmsLook';
import { GROUND_LOOK } from './groundLook';
import { FIREFLY_LOOK } from './fireflyLook';
import { GULL_GRAPH_LOOK } from './gullGraphLook';
import spots from '../data/spots.generated.json' with { type: 'json' };
import ziplineRows from '../data/zipline.generated.json' with { type: 'json' };
import { ISLAND_LOOKS } from '../data/islandLook';
import { ISLAND_LOOK, ISLAND_TIERS } from './islandRows';
import { KIT_LENDS } from './kitLook';
import { CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS, TRADER_FACING, TRADER_HEAD_FOCUS } from './npcFocus';
import { CASTAWAY_POSE, TRADER_POSE } from './npcPose';
import { OCEAN_LOOK } from './oceanLook';
import { POOL_LOOK, SHRINE_POOL_LOOK } from '../data/poolLook';
import { TROPHY_LAYOUT } from './trophyLayout';
import { SHRINE_SITES } from '../data/shrineSites';
import { REEF_LOOK } from './reefLook';
import { REEF_SPECIMENS } from './reefSpecimenRows';
import { TRAIL_SPECIMEN_ROWS } from './trailSpecimenRows';
import { TRAIL_SPECIMENS } from './trailSpecimens';
import { REEF_ROCK, SHORE_ROCK } from './rockProfiles';
import { SKY_CLOUD_LOOK, SKY_DOME_LOOK } from './skyLook';
import { MIDDAY_SKY_ROWS } from '../data/skyPalette';
import { CASTAWAY_SMOKE, SMOKE_LOOK } from './smokeLook';
import { DAY_LIGHT, RAMP_FOG } from './toonLook';
import { CASCADE_LOOKS } from './waterfallLook';
import { WRECK_SITES } from '../data/wreckSites';

/** Canonical authored view rows, emitted into the admitted native-view section. */
export const NATIVE_VIEW = {
  BOAT_LAYOUT,
  CAPTAIN_ARENA_R: CAPTAIN_DEF.arena.r,
  CAPTAIN_ID: CAPTAIN_DEF.id,
  CAPTAIN_NAME: CAPTAIN_PRESENTATION.name,
  CASCADE_LOOKS,
  CASTAWAY_FACING,
  CASTAWAY_HEAD_FOCUS,
  CASTAWAY_POSE,
  CASTAWAY_SMOKE,
  COUNTER_TOP,
  COVER_LOOKS,
  CREATURE_LOOKS,
  DAY_LIGHT,
  FINALE_REWARD: spots.reward,
  FIREFLY_LOOK,
  FP_ARMS_LOOK,
  FP_ARMS_MATERIALS,
  GROUND_LOOK,
  GULL_GRAPH_LOOK,
  ISLAND_LOOK,
  ISLAND_TIERS,
  ISLAND_LOOKS,
  KIT_LENDS,
  MIDDAY_SKY_ROWS,
  OCEAN_LOOK,
  POOL_LOOK,
  RAMP_FOG,
  REEF_LOOK,
  REEF_ROCK,
  REEF_SPECIMENS,
  SHORE_ROCK,
  SHRINE_POOL_LOOK,
  SHRINE_SITES,
  SKY_CLOUD_LOOK,
  SKY_DOME_LOOK,
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
