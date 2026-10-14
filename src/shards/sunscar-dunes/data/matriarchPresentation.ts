import { DUNE_FIELD } from './duneField';
import { MATRIARCH_ARENA } from './matriarchEncounter';
import { STRINGS } from './strings';

/**
 * Her fight's browser presentation (SF27 / SF7f, a marked boss presentation row): the coin burst leaves from the basin
 * floor; a death returns the player to the basin's south rim, 4 m out; the phase II sand storm is a weather fog (E390) of
 * 0.03 per metre in a dusty orange (about 40 % of her survives 30 m, so her silhouette reads inside it, R1B-17; the far
 * dunes are gone by 100 m) and two shells of blown sand (P2 #11: 46 m at 0.85, 22 m at 0.4, in data/stormLook.ts's
 * `storm-far` / `storm-near` graphs) streaking down the dunes' wind; the summons and reward toasts. Admitted by
 * `parseMarkedBossPresentation` (@wildshard/format/bossProfiles) where it is bound; the platform's boss view presents it.
 */
export const MATRIARCH_PRESENTATION = { ...MATRIARCH_ARENA,
  storm: { dist: 0.03, color: 0x8a5238, shells: [[46, 0.85, 'storm-far'], [22, 0.4, 'storm-near']] as const, wind: DUNE_FIELD.wind },
  toasts: { summoned: STRINGS.summoned, reward: STRINGS.bossReward, rewardAgain: STRINGS.bossRewardAgain } };
