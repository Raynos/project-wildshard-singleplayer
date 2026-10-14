import { STRINGS } from './strings';
import { DISCOVERY_PLACES } from './questPresentation';
import { SIGNAL_PERSISTENCE } from './persistence';
import { QUEST_MARKERS } from './questMarkers';
import { QUEST_REPAIR, QUEST_REPAIR_INITIAL } from './questRepair';

/** Scout presentation and old-save repair over the original flag owner. */
export const SIGNAL_QUEST_PAGE = {
  id: 'sunscar.signal', rewardId: 'sunscar.reward', npc: 'sunscar.scout', strings: STRINGS,
  persistence: SIGNAL_PERSISTENCE, places: DISCOVERY_PLACES, markers: QUEST_MARKERS, projectProgress: true,
  repair: { data: QUEST_REPAIR, initial: [QUEST_REPAIR_INITIAL], legacyObservation: 'event:legacy.sunscar.signal', advances: 3 },
} as const;
