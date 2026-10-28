import { expect, test } from 'vitest';
import * as v from 'valibot';
import { worldColourFunction, worldTargetRows } from '../src/sdk/worldScenes';
import { declaredQuestPageRows } from '../src/sdk/quests';
import { parseColourFunction } from '../src/format/colourFunction';
import { parseWorldTargets } from '../src/format/worldTargets';
import { parseDeclaredQuestPage } from '../src/format/declaredQuestPage';
import colour from '../src/shards/far-reach/data/rocSlate.json' with { type: 'json' };
import { SKY_GUST_TARGETS } from '../src/shards/far-reach/generators/gustTargets';
import { SKY_QUEST_PAGE_INTERACTIONS } from '../src/shards/far-reach/generators/questPageInteractions';

function outcome(read: () => unknown): unknown {
  try { return { rows: read() }; }
  catch (error) { if (error instanceof v.ValiError) return { issues: error.issues }; throw error; }
}

test('Sky author metadata retains complete colour, contact and prompt contracts and native refusals', () => {
  for (const [read, native, rows] of [
    [worldColourFunction, parseColourFunction, colour],
    [worldTargetRows, parseWorldTargets, { targets: SKY_GUST_TARGETS, spots: [] }],
    [declaredQuestPageRows, parseDeclaredQuestPage, SKY_QUEST_PAGE_INTERACTIONS],
  ] as const) {
    expect(JSON.stringify(read(rows))).toBe(JSON.stringify(native(rows)));
    for (const bad of [null, {}, { ...rows, extra: true }, { ...rows, callback: () => 0 }]) {
      expect(outcome(() => read(bad))).toEqual(outcome(() => native(bad)));
    }
  }
});
