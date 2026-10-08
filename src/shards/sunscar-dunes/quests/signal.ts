import { parseQuestData } from '@wildshard/sdk/quests';
import { BASIN, BRAZIERS, CARAVAN, TOWER, WELL } from '../layout';
import { STRINGS } from '../strings';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from '../data/flags';

/** Raised when the Dune Matriarch falls (combat/matriarch.ts): the quest's last step. */
export const MATRIARCH_FLAG = 'sunscar.matriarch.down';
/** Raised when every step is done. */
export const COMPLETE_FLAG = 'sunscar.complete';
/** Raised once the signal reward has paid (SF50-p: a quest flag in place of the old `sunscar.signal` shard save). */
export const PAID_FLAG = 'sunscar.signal.paid';
/** The ledger facts Signal Dunes emits (SF14): the platform grants their achievements once per (shard, achievement). */
export const FACT = { signal: 'sunscar.signal', matriarch: 'sunscar.matriarch' } as const;

const waymarks = BRAZIERS.map((_, i) => FLAG.brazier(i));
/** Any step after Sefa's: a save from before her (loop 2), or a player who walked past her, counts her step done. */
export const LATER_FLAGS = [FLAG.logbook, FLAG.oil, ...waymarks, FLAG.lit, MATRIARCH_FLAG] as const;

/**
 * "The signal" as declared quest data (SHARD-PLATFORM SF50-p, the template's quest rows): flags, the six steps, their
 * done conditions, chips, hints and markers, and the reward (a fact and five coins). Markers on world pieces carry their
 * layout spot here; the trusted runtime places them on the built piece (quest/install.ts), as the world decides its height.
 */
export const SIGNAL_QUESTS = parseQuestData({
  flags: [SCOUT_FLAG, ...LATER_FLAGS, COMPLETE_FLAG, PAID_FLAG],
  quests: [{ id: 'sunscar.signal', title: STRINGS.quest, completeFlag: COMPLETE_FLAG, onComplete: { fact: FACT.signal, coins: 5 }, steps: [
    { id: 'scout', objective: STRINGS.stepScout, chip: STRINGS.chipScout, hint: STRINGS.hintScout, done: { any: [SCOUT_FLAG, ...LATER_FLAGS] },
      markers: [{ id: 'scout', label: STRINGS.scoutPin, short: STRINGS.shortScout, at: { poi: 'world', x: SCOUT_AT.x, z: SCOUT_AT.z } }] },
    { id: 'logbook', objective: STRINGS.stepLog, chip: STRINGS.chipLog, hint: STRINGS.hintLog, done: { all: [FLAG.logbook] },
      markers: [{ id: 'logbook', label: STRINGS.readLog, short: STRINGS.shortLog, at: { poi: 'world', x: CARAVAN.x, z: CARAVAN.z } }] },
    { id: 'oil', objective: STRINGS.stepOil, chip: STRINGS.chipOil, hint: STRINGS.hintOil, done: { all: [FLAG.oil] },
      markers: [{ id: 'well', label: STRINGS.well, short: STRINGS.shortWell, at: { poi: 'world', x: WELL.x, z: WELL.z } }] },
    { id: 'waymarks', objective: STRINGS.stepWaymarks, chip: STRINGS.chipWaymarks, hint: STRINGS.hintWaymarks, done: { all: waymarks }, count: waymarks,
      markers: BRAZIERS.map((b, i) => ({ id: `waymark.${String(i)}`, label: STRINGS.waymark, short: STRINGS.shortWaymark, at: { poi: 'world' as const, x: b.x, z: b.z }, hideWhen: { all: [FLAG.brazier(i)] } })) },
    { id: 'fire', objective: STRINGS.step, chip: STRINGS.chipFire, hint: STRINGS.hintFire, done: { all: [FLAG.lit] },
      markers: [{ id: 'tower', label: STRINGS.tower, short: STRINGS.shortTower, at: { poi: 'world', x: TOWER.x, z: TOWER.z } }] },
    { id: 'matriarch', objective: STRINGS.stepBoss, chip: STRINGS.chipBoss, hint: STRINGS.hintBoss, done: { all: [MATRIARCH_FLAG] },
      markers: [{ id: 'basin', label: STRINGS.placeBasin, short: STRINGS.shortBasin, at: { poi: 'world', x: BASIN.x, y: 2, z: BASIN.z } }] },
  ] }],
  triggers: [], dialogue: [],
});
