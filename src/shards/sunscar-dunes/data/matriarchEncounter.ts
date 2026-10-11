import { MATRIARCH_BOSS_PROFILE } from './matriarchBoss';
import { STRINGS } from './strings';
import { MATRIARCH_DEFEATED_FLAG, MATRIARCH_PAID_FLAG } from './signalQuest';

/** The declared boss, encounter and saved actor share this stable identity. */
export const MATRIARCH_ID = 'sunscar.matriarch';
/** Coins paid once, on her first fall, through the carried paid flag. */
export const MATRIARCH_REWARD = 20;
/** The encounter's intro and three native health checkpoints, with their authored captions. */
export const MATRIARCH_DEFINITION = { id: MATRIARCH_ID, name: STRINGS.matriarch, title: STRINGS.matriarchTitle, retryTitle: STRINGS.retry,
  intro: MATRIARCH_BOSS_PROFILE.fight.riseSeconds + 0.6, introShort: 1.2,
  phases: [{ at: 1, caption: STRINGS.phaseDives, name: STRINGS.phaseDives }, { at: 0.66, caption: STRINGS.phaseStorm, name: STRINGS.phaseStorm },
    { at: 0.33, caption: STRINGS.phaseGrounded, name: STRINGS.phaseGrounded }], reward: {} };
/** Current-save defeated and paid flags used by both native encounter owners. */
export const MATRIARCH_RECORD = { defeated: MATRIARCH_DEFEATED_FLAG, paid: MATRIARCH_PAID_FLAG } as const;
