import { CROWN, HIGH, STEP, VANES } from './layout';
import { STRINGS } from './strings';
import { SKY_PLACES } from './places';
import { SKY_PERSISTENCE } from './persistence';
import { FLAGS, vaneFlag } from '../quests/flags';

/** Keeper quest composition and held crown-bridge reward view. */
export const SKY_QUEST_PAGE = {
  id: 'far.quest', rewardId: 'far.reward', npc: 'far.keeper', strings: STRINGS, persistence: SKY_PERSISTENCE,
  places: SKY_PLACES, presentationFlags: true, unpaid: 'live',
  model: { id: 'keeper-hd', kind: 'pivots' },
  beat: { at: { x: STEP.x + 2, y: HIGH + 1.7, z: STEP.z - 4 }, toward: CROWN, pitch: 0.12, holdSeconds: 5 },
  capture: {
    'quest-crown': [{ call: 'finish' }, { call: 'raise' }],
    'quest-winch': [{ flag: FLAGS.notes }, { flag: FLAGS.roost }, { flag: FLAGS.vanes },
      { flag: 'far.vane.grove' }, { flag: 'far.vane.keeper' }, { flag: 'far.vane.ruin' }],
  },
  finishFlags: [...VANES.map(vane => vaneFlag(vane.id)), FLAGS.notes, FLAGS.roost, FLAGS.vanes, FLAGS.raised],
} as const;
