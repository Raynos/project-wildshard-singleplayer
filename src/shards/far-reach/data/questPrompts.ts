import { DECK, NOTES, WINCH } from './layout';
import { KEEPER_AT } from './quests';
import { SKY_FLOCK_GROUPS } from './spawns';

/** The native script actor retains its shipping identity. */
export const SKY_INTERACT = 'far.interact';
/** Script values name the keeper, lectern and winch in their original order. */
export const SKY_ACT = { talk: 0, notes: 1, winch: 2 } as const;
/** The quest's flags are its continuation; this step has no separate cursor. */
export const QUEST_STEP = 'far.quest';
/** Keeper head, lectern and winch drum points and radii, in world metres. */
export const SKY_PROMPTS = {
  [SKY_ACT.talk]: { at: [KEEPER_AT.x, DECK + 1.8, KEEPER_AT.z], radius: 3.5 },
  [SKY_ACT.notes]: { at: [NOTES.x, NOTES.y + 1.3, NOTES.z], radius: 2.6 },
  [SKY_ACT.winch]: { at: [WINCH.x, WINCH.y + 1.2, WINCH.z], radius: 3 },
} as const;
/** The quest observes the same finite roost order as both living flock owners. */
export const ROOST_IDS: readonly string[] = SKY_FLOCK_GROUPS.roost.map(row => row.id);
