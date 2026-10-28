import { expect, test } from 'vitest';
import * as v from 'valibot';
import { achievementCounterRows, questStepRows, questHintRows, questServiceRows, questPageInteractionRows, questPageCompositionRows, coverCompositionRows } from '../src/sdk/rows';
import { parseAchievementCounterData } from '@wildshard/format/achievementCounters';
import { parseQuestStepRows, parseQuestHintRows, parseQuestServiceActions } from '@wildshard/format/questSteps';
import { parseQuestPageInteractions } from '@wildshard/format/questInteractions';
import { QuestPageCompositionSchema } from '@wildshard/format/questPageComposition';
import { CoverCompositionSchema } from '@wildshard/format/streamedCover';
import page from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import cover from '../src/shards/driftwood-isle/data/coverComposition.json' with { type: 'json' };
import steps from '../src/shards/driftwood-isle/data/questSteps.json' with { type: 'json' };
import hints from '../src/shards/driftwood-isle/data/questHints.json' with { type: 'json' };

const pairs: readonly { author: (input: unknown) => unknown; native: (input: unknown) => unknown; good: object }[] = [
  { author: achievementCounterRows, native: parseAchievementCounterData, good: { feats: [{ id: 'fruit', count: 3 }], flags: [{ id: 'fruit', method: 'count', value: { constant: 0 } }], prefix: 'orchard.', floorTotals: true, validateTotals: false, write: 'each' } },
  { author: questStepRows, native: parseQuestStepRows, good: steps },
  { author: questHintRows, native: parseQuestHintRows, good: hints },
  { author: questServiceRows, native: parseQuestServiceActions, good: { version: 1, actions: [] } },
  { author: questPageInteractionRows, native: parseQuestPageInteractions, good: { actions: [{ id: 'open', after: [{ kind: 'call', target: 'shop.open' }] }] } },
  { author: questPageCompositionRows, native: input => v.parse(QuestPageCompositionSchema, input), good: { ...page, events: [], deaths: [] } },
  { author: coverCompositionRows, native: input => v.parse(CoverCompositionSchema, input), good: cover },
];

test.each(pairs)('author $author.name retains the complete native admitted row and JSON wire', ({ author, native, good }) => {
  const before = structuredClone(good), expected = native(good), actual = author(good);
  expect(actual).toEqual(expected); expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
  expect(good).toEqual(before);
  const source = structuredClone(good), first = author(source);
  Reflect.set(source, 'arbitrary', 'caller mutation');
  expect(first).toEqual(expected);
});

test.each(pairs)('author $author.name retains strict malformed and executable-input refusals', ({ author, native, good }) => {
  for (const input of [null, [], { ...good, arbitrary: true }, { ...good, callback: () => undefined }]) {
    let message: string | undefined;
    try { native(input); } catch (error) {
      if (!(error instanceof Error)) throw error;
      message = error.message;
    }
    if (message === undefined) throw new Error('Native negative control unexpectedly admitted');
    expect(() => author(input)).toThrow(message);
  }
});
