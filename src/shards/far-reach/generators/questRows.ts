import { SKY_QUEST_PAGE } from './questPage';
import { SKY_INTERACT, SKY_ACT, QUEST_STEP, SKY_SPOTS, ROOST_IDS } from './questPrompts';
import { KEEPER_AT } from './quests';

/** Compile page policy for the existing shared saved-quest owner. */
export function questPageFiles(): ReadonlyMap<string, Uint8Array> {
  const bytes = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);
  return new Map([
    ['data/questPage.generated.json', bytes(SKY_QUEST_PAGE)],
    ['data/questPrompts.generated.json', bytes({ SKY_INTERACT, SKY_ACT, QUEST_STEP, SKY_SPOTS, ROOST_IDS, KEEPER_AT })],
  ]);
}
