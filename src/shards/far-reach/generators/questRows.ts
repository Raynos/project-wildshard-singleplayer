import { SKY_QUEST_PAGE } from './questPage';
import { SKY_INTERACT, SKY_ACT, QUEST_STEP, SKY_SPOTS, ROOST_IDS } from './questPrompts';
import { KEEPER_AT } from './quests';

/** Fresh source values for the existing saved-page and native prompt owners. */
export function skyQuestPage(): typeof SKY_QUEST_PAGE { return structuredClone(SKY_QUEST_PAGE); }
export function skyQuestPrompts(): { SKY_INTERACT: typeof SKY_INTERACT; SKY_ACT: typeof SKY_ACT; QUEST_STEP: typeof QUEST_STEP; SKY_SPOTS: typeof SKY_SPOTS; ROOST_IDS: typeof ROOST_IDS; KEEPER_AT: typeof KEEPER_AT } {
  return structuredClone({ SKY_INTERACT, SKY_ACT, QUEST_STEP, SKY_SPOTS, ROOST_IDS, KEEPER_AT });
}

/** Compile page policy for the existing shared saved-quest owner. */
export function questPageFiles(): ReadonlyMap<string, Uint8Array> {
  const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  return new Map([
    ['data/questPage.generated.json', bytes(skyQuestPage())],
    ['data/questPrompts.generated.json', bytes(skyQuestPrompts())],
  ]);
}
