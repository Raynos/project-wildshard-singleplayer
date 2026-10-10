import { parseMarkedBossPresentation, type BossDefinition, type MarkedBossFightRow } from '@wildshard/sdk/bossFight';
import { DUNE_FIELD } from './duneField';
import { BASIN } from './layout';
import { STRINGS } from './strings';
import { MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG } from '../quests/signal';

/** Her declared boss row's id (data/spawns.ts `bosses`), her encounter's id and her saved actor's identity. */
export const MATRIARCH_ID = 'sunscar.matriarch';
/** The reward: coins once, on the first fall (her paid flag). */
export const MATRIARCH_REWARD = 20;
/** Her rise out of the basin (the intro's pose), seconds. */
export const MATRIARCH_RISE = 3.2;
/** The phase II storm closes in and lifts over this many seconds. */
export const STORM_FADE = 2.5;

/** Her encounter: the intro, three phases at 100 / 66 / 33 % and their captions (the engine's `BossBrain` runs them). */
export const MATRIARCH_DEFINITION: BossDefinition = { id: MATRIARCH_ID, name: STRINGS.matriarch, title: STRINGS.matriarchTitle, retryTitle: STRINGS.retry,
  intro: MATRIARCH_RISE + 0.6, introShort: 1.2,
  phases: [{ at: 1, caption: STRINGS.phaseDives, name: STRINGS.phaseDives }, { at: 0.66, caption: STRINGS.phaseStorm, name: STRINGS.phaseStorm },
    { at: 0.33, caption: STRINGS.phaseGrounded, name: STRINGS.phaseGrounded }], reward: {} };

/** Her record's flags (SF50-p: no save of her own; `bossFlagRecord` keeps beaten and paid on the shard's flags). */
export const MATRIARCH_RECORD = { defeated: MATRIARCH_DEFEATED_FLAG, paid: MATRIARCH_PAID_FLAG } as const;

/**
 * The Dune Matriarch's fight as a marked boss fight (SF27): the fire's light is the summons (review R7), so she rises
 * while the player is anywhere from the bowl to the tower deck (78 m from its centre); a fresh body at each checkpoint
 * at full, two-thirds or one-third health; phase II (index 1) raises the sand storm over `STORM_FADE` s; her brain
 * (data/brains.ts MATRIARCH_BRAIN) reads the marks.
 */
export const MATRIARCH_FIGHT: MarkedBossFightRow = { arena: { x: BASIN.x, z: BASIN.z, r: BASIN.r + 34 }, hpShares: [1, 0.66, 0.33], riseSeconds: MATRIARCH_RISE,
  stormPhases: [1], stormFade: STORM_FADE, fields: { fight: 'fight', rise: 'rise', phase: 'phase' } };

/**
 * Her fight's browser presentation (SF27 / SF7f, a marked boss presentation row): the coin burst leaves from the basin
 * floor; a death returns the player to the basin's south rim, 4 m out; the phase II sand storm is a weather fog (E390) of
 * 0.03 per metre in a dusty orange (about 40 % of her survives 30 m, so her silhouette reads inside it, R1B-17; the far
 * dunes are gone by 100 m) and two shells of blown sand (P2 #11: 46 m at 0.85, 22 m at 0.4) streaking down the dunes'
 * wind; the summons and reward toasts.
 */
export const MATRIARCH_PRESENTATION = parseMarkedBossPresentation({ floor: DUNE_FIELD.basinFloor, respawn: { x: BASIN.x, z: BASIN.z + BASIN.r + 4, yaw: 0 },
  storm: { dist: 0.03, color: 0x8a5238, shells: [[46, 0.85], [22, 0.4]], wind: DUNE_FIELD.wind },
  toasts: { summoned: STRINGS.summoned, reward: STRINGS.bossReward, rewardAgain: STRINGS.bossRewardAgain } });
