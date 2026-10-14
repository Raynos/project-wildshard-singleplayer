import { CROWN, HIGH, STEP, VANES } from './layout';
import { STRINGS } from './strings';
import { SKY_PLACES } from './places';
import { SKY_PERSISTENCE } from './persistence';
import { SKY_QUEST_STAGES, SKY_QUEST_STAGE_INITIAL } from './questStages';
import { FLAGS, vaneFlag } from '../quest/flags';

/** Keeper quest composition and held crown-bridge reward view. */
export const SKY_QUEST_PAGE = {
  id: 'far.quest', rewardId: 'far.reward', npc: 'far.keeper', strings: STRINGS, persistence: SKY_PERSISTENCE,
  places: SKY_PLACES, presentationFlags: true, unpaid: 'live',
  beat: { at: { x: STEP.x + 2, y: HIGH + 1.7, z: STEP.z - 4 }, toward: CROWN, pitch: 0.12, holdSeconds: 5 },
  stages: [{ system: 'far.vanes', data: SKY_QUEST_STAGES.vanes, initial: SKY_QUEST_STAGE_INITIAL.vanes }],
  finishFlags: [...VANES.map(vane => vaneFlag(vane.id)), FLAGS.notes, FLAGS.roost, FLAGS.vanes, FLAGS.raised],
} as const;
