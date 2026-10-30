import { expect, test } from 'vitest';
import { parsePersistedQuestPage } from '../src/sdk/quests';
import { skyQuestPage, skyQuestPrompts } from '../src/shards/far-reach/generators/questRows';
import { page as signalPage } from './fixtures/sunscar-source-program';
import { SKY_SPOTS, SKY_ACT, SKY_INTERACT, QUEST_STEP, ROOST_IDS } from '../src/shards/far-reach/generators/questPrompts';
import { KEEPER_AT } from '../src/shards/far-reach/generators/quests';

const skyPage = skyQuestPage(), skyPrompts = skyQuestPrompts();

test('Sky source page and prompts return independent caller-owned values', () => {
  const page = skyQuestPage(), prompts = skyQuestPrompts();
  const beforePage = structuredClone(page), beforePrompts = structuredClone(prompts);
  Reflect.set(page.strings, 'notes', 'changed'); Reflect.set(prompts.SKY_SPOTS[0], 'x', 999);
  expect(skyQuestPage()).toEqual(beforePage);
  expect(skyQuestPrompts()).toEqual(beforePrompts);
});

// Keep the parser acceptance and malformed persistence/refusal laws.
for (const [slug, page] of [
  ['far-reach', skyPage],
  ['sunscar-dunes', signalPage],
] as const) {
  test(`${slug} accepts its saved page and refuses malformed persistence`, () => {
    expect(parsePersistedQuestPage(page)).toEqual(page);
    expect(() => parsePersistedQuestPage({ ...page, persistence: { reward: { kind: 'other', key: 'paid', legacy: 'paid' } } })).toThrow();
    expect(() => parsePersistedQuestPage({ ...page, unexpectedCursor: 1 })).toThrow();
  });
}

test('Sky prompt compilation retains native command and position order', () => {
  expect(skyPrompts).toEqual({ SKY_INTERACT, SKY_ACT, QUEST_STEP, SKY_SPOTS, ROOST_IDS, KEEPER_AT });
});

