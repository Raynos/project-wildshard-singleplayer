import { parseBossProfile } from '@wildshard/sdk/bossProfiles';
import { strike } from '@wildshard/sdk/species';
import * as layout from './kurganLayout';
import { GOLDEN_KING_BOSS_PROFILE } from './goldenKingArena';
import { KING_ENCOUNTER, KING_REWARD, KING_TUNING, KING_PORTAL } from './goldenKingFight';
import { GOLDEN_KING_POSE } from './goldenKingPose';
import strikeRows from '../data/strikeProfiles.json' with { type: 'json' };

const createStrikes = () => ({
  wolf: strike(strikeRows.wolf), balbal: strike(strikeRows.balbal), arrow: strike(strikeRows.arrow),
  swipe: strike(strikeRows.swipe), pounce: strike(strikeRows.pounce), bite: strike(strikeRows.bite),
  stoop: strike(strikeRows.stoop), captain: strike(strikeRows.captain), stallion: strike(strikeRows.stallion),
  cuts: strikeRows.cuts.map(row => strike(row)), sunburst: strike(strikeRows.sunburst), beam: strike(strikeRows.beam),
  sand: strike(strikeRows.sand), spear: strike(strikeRows.spear), whirl: strike(strikeRows.whirl),
  wind: strike(strikeRows.wind), chain: strike(strikeRows.chain),
});

/** Preserve every authored contact row and the original cuts-array order through strict SDK admission. */
export function nalatiStrikeRows(): ReturnType<typeof createStrikes> { return createStrikes(); }

const createKing = () => {
  const strikes = nalatiStrikeRows();
  return {
    client: { light: { colour: 0xffc860, drop: 30 }, prewarm: { kind: 'balbal', variant: 'warrior' }, system: 'shard.nalati-grasslands.bind', debugZ: 13.2 },
    portal: KING_PORTAL, profile: parseBossProfile(GOLDEN_KING_BOSS_PROFILE), encounter: KING_ENCOUNTER, reward: KING_REWARD, tuning: KING_TUNING,
    page: { profile: GOLDEN_KING_BOSS_PROFILE, body: 'nalati.golden-king', identity: 'runtime',
      add: { kind: 'balbal', variant: 'warrior', memory: { floorY: layout.DUNGEON.y, emergeT: 1.9,
        minX: layout.DUNGEON.x - layout.CH + .9, maxX: layout.DUNGEON.x + layout.CH - .9,
        minZ: layout.DUNGEON.z - layout.CH + .9, maxZ: layout.DUNGEON.z + layout.CH - .9 } },
      damageTag: 'boss.golden-king', maxZ: layout.DUNGEON.z + layout.CH - 1.1,
      reward: [layout.DUNGEON.x + layout.PEDESTAL.x, layout.DUNGEON.y + layout.PEDESTAL.h + .02, layout.DUNGEON.z + layout.PEDESTAL.z],
      respawn: [layout.DUNGEON.x + layout.CHECKPOINT.x, layout.DUNGEON.y, layout.DUNGEON.z + layout.CHECKPOINT.z], yaw: layout.CHECKPOINT.yaw,
      presentation: { reach: KING_TUNING.reach, ringMax: KING_TUNING.ringMax, beamRadius: KING_TUNING.beamRadius },
      cuts: strikes.cuts, hazards: { sunburst: strikes.sunburst, sand: strikes.sand, beam: strikes.beam } },
  };
};

/** Fresh complete Golden King encounter policy, with original coordinates, tuning and strict profile admission. */
export function nalatiGoldenKingRows(): ReturnType<typeof createKing> { return structuredClone(createKing()); }
/** Fresh fixed chamber coordinates and collider descriptors; no collision world is installed. */
export function nalatiKurganLayout(): typeof layout { return structuredClone({ ...layout }); }
/** Fresh numeric pose DAGs from the defining authored recipe; no animation service is installed. */
export function nalatiGoldenKingPose(): typeof GOLDEN_KING_POSE { return structuredClone(GOLDEN_KING_POSE); }
