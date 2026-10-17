import { parseQuestData } from '@wildshard/sdk/quests';
import LAYOUT from '../data/layout.generated.json' with { type: 'json' };
import { STRINGS } from '../data/strings';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from '../data/flags';
import { MATRIARCH_FLAG, COMPLETE_FLAG, PAID_FLAG, MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG, FACT } from '../data/signalQuest';

const waymarks = LAYOUT.BRAZIERS.map((_, i) => `${FLAG.brazierPrefix}${String(i)}`);
/** Any step after Sefa's: a save from before her (loop 2), or a player who walked past her, counts her step done. */
export const LATER_FLAGS = [FLAG.logbook, FLAG.oil, ...waymarks, FLAG.lit, MATRIARCH_FLAG] as const;

/**
 * "The signal" as declared quest data (SHARD-PLATFORM SF50-p, the template's quest rows): flags, the six steps, their
 * done conditions, chips, hints and markers, and the reward (a fact and five coins). Markers on world pieces carry their
 * layout spot here; the trusted runtime places them on the built piece (quest/install.ts), as the world decides its height.
 */
export const SIGNAL_QUESTS = parseQuestData({
  flags: [SCOUT_FLAG, ...LATER_FLAGS, COMPLETE_FLAG, PAID_FLAG, MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG],
  quests: [{ id: 'sunscar.signal', title: STRINGS.quest, completeFlag: COMPLETE_FLAG, onComplete: { fact: FACT.signal, coins: 5 }, steps: [
    { id: 'scout', objective: STRINGS.stepScout, chip: STRINGS.chipScout, hint: STRINGS.hintScout, done: { any: [SCOUT_FLAG, ...LATER_FLAGS] },
      markers: [{ id: 'scout', label: STRINGS.scoutPin, short: STRINGS.shortScout, at: { poi: 'world', x: SCOUT_AT.x, z: SCOUT_AT.z } }] },
    { id: 'logbook', objective: STRINGS.stepLog, chip: STRINGS.chipLog, hint: STRINGS.hintLog, done: { all: [FLAG.logbook] },
      markers: [{ id: 'logbook', label: STRINGS.readLog, short: STRINGS.shortLog, at: { poi: 'world', x: LAYOUT.CARAVAN.x, z: LAYOUT.CARAVAN.z } }] },
    { id: 'oil', objective: STRINGS.stepOil, chip: STRINGS.chipOil, hint: STRINGS.hintOil, done: { all: [FLAG.oil] },
      markers: [{ id: 'well', label: STRINGS.well, short: STRINGS.shortWell, at: { poi: 'world', x: LAYOUT.WELL.x, z: LAYOUT.WELL.z } }] },
    { id: 'waymarks', objective: STRINGS.stepWaymarks, chip: STRINGS.chipWaymarks, hint: STRINGS.hintWaymarks, done: { all: waymarks }, count: waymarks,
      markers: LAYOUT.BRAZIERS.map((b, i) => ({ id: `waymark.${String(i)}`, label: STRINGS.waymark, short: STRINGS.shortWaymark, at: { poi: 'world' as const, x: b.x, z: b.z }, hideWhen: { all: [`${FLAG.brazierPrefix}${String(i)}`] } })) },
    { id: 'fire', objective: STRINGS.step, chip: STRINGS.chipFire, hint: STRINGS.hintFire, done: { all: [FLAG.lit] },
      markers: [{ id: 'tower', label: STRINGS.tower, short: STRINGS.shortTower, at: { poi: 'world', x: LAYOUT.TOWER.x, z: LAYOUT.TOWER.z } }] },
    { id: 'matriarch', objective: STRINGS.stepBoss, chip: STRINGS.chipBoss, hint: STRINGS.hintBoss, done: { all: [MATRIARCH_FLAG] },
      markers: [{ id: 'basin', label: STRINGS.placeBasin, short: STRINGS.shortBasin, at: { poi: 'world', x: LAYOUT.BASIN.x, y: 2, z: LAYOUT.BASIN.z } }] },
  ] }],
  triggers: [], dialogue: [],
});
