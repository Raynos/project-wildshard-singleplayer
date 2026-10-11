import { parseQuestGraph } from '@wildshard/sdk/questGraph';
import { SIGNAL_SPAWNS } from './spawns';
import { SIGNAL_INTERACT } from './signalInteractions';

/**
 * "The signal"'s quest graph runtime row (SF27): its interaction rows ride `script` commands on `sunscar.interact`, their
 * marks continue under the `sunscar.interactions` step, and the tower fire's row summons the Dune Matriarch.
 */
export const SIGNAL_GRAPH = parseQuestGraph({ actor: SIGNAL_INTERACT, step: 'sunscar.interactions', actions: [{ row: 'fire', summon: SIGNAL_SPAWNS.bosses[0]?.id }] });
