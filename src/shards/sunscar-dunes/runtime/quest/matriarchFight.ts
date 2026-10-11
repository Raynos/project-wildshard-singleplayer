import { parseMarkedBossPresentation } from '../shardfile/markedBossPresentation';
import { DUNE_FIELD } from '../looks/duneFieldRows';
import { MATRIARCH_ARENA } from '../../data/matriarchEncounter';
import { STRINGS } from '../../data/strings';

/**
 * Her fight's browser presentation (SF27 / SF7f, a marked boss presentation row): the coin burst leaves from the basin
 * floor; a death returns the player to the basin's south rim, 4 m out; the phase II sand storm is a weather fog (E390) of
 * 0.03 per metre in a dusty orange (about 40 % of her survives 30 m, so her silhouette reads inside it, R1B-17; the far
 * dunes are gone by 100 m) and two shells of blown sand (P2 #11: 46 m at 0.85, 22 m at 0.4) streaking down the dunes'
 * wind; the summons and reward toasts.
 */
export const MATRIARCH_PRESENTATION = parseMarkedBossPresentation({ ...MATRIARCH_ARENA,
  storm: { dist: 0.03, color: 0x8a5238, shells: [[46, 0.85], [22, 0.4]], wind: DUNE_FIELD.wind },
  toasts: { summoned: STRINGS.summoned, reward: STRINGS.bossReward, rewardAgain: STRINGS.bossRewardAgain } });
