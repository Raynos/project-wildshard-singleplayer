import { defineMirror } from '@wildshard/sdk/runtimeMirrors';
import { ISLAND_FAMILIES } from './audioPlayback';
import { ISLAND_SURFACES } from './audioSurfaces';
import { COVER_LOOKS } from './coverLook';
import { BOAT_LAYOUT } from './boatLayout';
import { CAPTAIN_DEF, CAPTAIN_PRESENTATION } from './captainEncounter';
import { CASTAWAY_SMOKE } from './castawayLook';
import { COUNTER_TOP } from './counterLayout';
import { CREATURE_LOOKS } from './creatureLook';
import { FACETED_DAY_PRESET } from './facetedDayRows';
import { FP_ARMS_LOOK, FP_ARMS_MATERIALS } from './fpArmsLook';
import { GROUND_LOOK } from './groundLook';
import { FIREFLY_LOOK } from './fireflyLook';
import { GULL_GRAPH_LOOK } from './gullGraphLook';
import { GULL_BURSTS, GULL_CORRIDORS, GULL_FLIGHT, GULL_WHEEL } from './gullsLook';
import ironSwordScene from './ironSwordScene.json' with { type: 'json' };
import spots from './spots.generated.json' with { type: 'json' };
import ziplineRows from './zipline.generated.json' with { type: 'json' };
import manifest from '../manifest.json' with { type: 'json' };
import { ISLAND_LOOKS } from './islandLook';
import { ISLAND_LOOK } from './islandRows';
import { KIT_LENDS } from './kitLook';
import { DRIFTWOOD_IRON_PROFILE, DRIFTWOOD_MELEE_PROFILE } from './meleeProfile';
import { CASTAWAY_FACING, CASTAWAY_HEAD_FOCUS, TRADER_FACING, TRADER_HEAD_FOCUS } from './npcFocus';
import { CASTAWAY_POSE, TRADER_POSE } from './npcPose';
import { CASTAWAY_BINDINGS, CASTAWAY_PARTS, CASTAWAY_SCENE, TRADER_BINDINGS, TRADER_PARTS, TRADER_SCENE } from './npcScenes';
import { OCEAN_DRY_SLOTS, OCEAN_LOOK, OCEAN_NO_DRY, SEA_RES } from './oceanLook';
import { POOL_LOOK, SHRINE_POOL_LOOK } from './poolLook';
import { DECK_SLAB } from './entryRows';
import { TROPHY_LAYOUT } from './trophyLayout';
import { SHRINE_SITES } from './shrineSites';
import { REEF_LOOK } from './reefLook';
import { REEF_SPECIMENS } from './reefSpecimenRows';
import { TRAIL_SPECIMEN_ROWS } from './trailSpecimenRows';
import { TRAIL_SPECIMENS } from './trailSpecimens';
import { REEF_ROCK, SHORE_ROCK } from './rockProfiles';
import { SKY_CLOUD_LOOK, SKY_DOME_LOOK } from './skyLook';
import { MIDDAY_SKY_ROWS } from './skyPalette';
import { SMOKE_LOOK } from './smokeLook';
import { DAY_LIGHT, RAMP_FOG } from './toonLook';
import { CASCADE_LOOKS } from './waterfallLook';
import { WRECK_SITES } from './wreckSites';

/** Every value runtime/const.ts copies, next to its source (P2a spec §2.3); a drift refuses. */
export const RUNTIME_MIRRORS = [
  defineMirror('CASCADE_LOOKS', CASCADE_LOOKS),
  defineMirror('SMOKE_LOOK', SMOKE_LOOK),
  defineMirror('FIREFLY_LOOK', FIREFLY_LOOK),
  defineMirror('REEF_LOOK', REEF_LOOK),
  defineMirror('POOL_LOOK', POOL_LOOK),
  defineMirror('SHRINE_POOL_LOOK', SHRINE_POOL_LOOK),
  defineMirror('OCEAN_LOOK', OCEAN_LOOK),
  defineMirror('OCEAN_DRY_SLOTS', OCEAN_DRY_SLOTS),
  defineMirror('OCEAN_NO_DRY', OCEAN_NO_DRY),
  defineMirror('SEA_RES', SEA_RES),
  defineMirror('GULL_GRAPH_LOOK', GULL_GRAPH_LOOK),
  defineMirror('GULL_CORRIDORS', GULL_CORRIDORS),
  defineMirror('GULL_FLIGHT', GULL_FLIGHT),
  defineMirror('GULL_WHEEL', GULL_WHEEL),
  defineMirror('GULL_BURSTS', GULL_BURSTS),
  defineMirror('CREATURE_LOOKS', CREATURE_LOOKS),
  defineMirror('COVER_LOOKS', COVER_LOOKS),
  defineMirror('ISLAND_LOOKS', ISLAND_LOOKS),
  defineMirror('FP_ARMS_MATERIALS', FP_ARMS_MATERIALS),
  defineMirror('FP_ARMS_LOOK', FP_ARMS_LOOK),
  defineMirror('ISLAND_SURFACES', ISLAND_SURFACES),
  defineMirror('ISLAND_FAMILIES', ISLAND_FAMILIES),
  defineMirror('GROUND_LOOK', GROUND_LOOK),
  defineMirror('KIT_LENDS', KIT_LENDS),
  defineMirror('SKY_DOME_LOOK', SKY_DOME_LOOK),
  defineMirror('SKY_CLOUD_LOOK', SKY_CLOUD_LOOK),
  defineMirror('MIDDAY_SKY_ROWS', MIDDAY_SKY_ROWS),
  defineMirror('DAY_LIGHT', DAY_LIGHT),
  defineMirror('RAMP_FOG', RAMP_FOG),
  defineMirror('DRIFTWOOD_MELEE_PROFILE', DRIFTWOOD_MELEE_PROFILE),
  defineMirror('DRIFTWOOD_IRON_PROFILE', DRIFTWOOD_IRON_PROFILE),
  defineMirror('IRON_SWORD_SCENE', ironSwordScene),
  defineMirror('SHORE_ROCK', SHORE_ROCK),
  defineMirror('REEF_ROCK', REEF_ROCK),
  defineMirror('BOAT_LAYOUT', BOAT_LAYOUT),
  defineMirror('COUNTER_TOP', COUNTER_TOP),
  defineMirror('ISLAND_LOOK', ISLAND_LOOK),
  defineMirror('CASTAWAY_SCENE', CASTAWAY_SCENE),
  defineMirror('CASTAWAY_PARTS', CASTAWAY_PARTS),
  defineMirror('CASTAWAY_BINDINGS', CASTAWAY_BINDINGS),
  defineMirror('CASTAWAY_POSE', CASTAWAY_POSE),
  defineMirror('CASTAWAY_HEAD_FOCUS', CASTAWAY_HEAD_FOCUS),
  defineMirror('CASTAWAY_FACING', CASTAWAY_FACING),
  defineMirror('CASTAWAY_SMOKE', CASTAWAY_SMOKE),
  defineMirror('TRADER_SCENE', TRADER_SCENE),
  defineMirror('TRADER_PARTS', TRADER_PARTS),
  defineMirror('TRADER_BINDINGS', TRADER_BINDINGS),
  defineMirror('TRADER_POSE', TRADER_POSE),
  defineMirror('TRADER_HEAD_FOCUS', TRADER_HEAD_FOCUS),
  defineMirror('TRADER_FACING', TRADER_FACING),
  defineMirror('DECK_SLAB', DECK_SLAB),
  defineMirror('TROPHY_LAYOUT', TROPHY_LAYOUT),
  defineMirror('SHRINE_SITES', SHRINE_SITES),
  defineMirror('FINALE_REWARD', spots.reward),
  defineMirror('WRECK_SITES', WRECK_SITES),
  defineMirror('FACETED_DAY_PRESET', FACETED_DAY_PRESET),
  defineMirror('CAPTAIN_ID', CAPTAIN_DEF.id),
  defineMirror('CAPTAIN_ARENA_R', CAPTAIN_DEF.arena.r),
  defineMirror('CAPTAIN_NAME', CAPTAIN_PRESENTATION.name),
  defineMirror('REEF_SPECIMENS', REEF_SPECIMENS),
  defineMirror('TRAIL_SPECIMEN_ROWS', TRAIL_SPECIMEN_ROWS),
  defineMirror('TRAIL_SPECIMENS', TRAIL_SPECIMENS),
  defineMirror('ZIPLINE_ROWS', ziplineRows),
  defineMirror('CAPTURE_PROBES', manifest.captureProbes),
];
