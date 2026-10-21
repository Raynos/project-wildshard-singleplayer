import { expect, it } from 'vitest';
import * as v from 'valibot';
import { QuestPageSchema } from '../src/format/questPageComposition';
import { PINE_QUEST_PAGE, PINE_QUEST_PAGE_BLOB } from '../src/shards/pine-hollow/generators/pageComposition';
import { FOREST_STORY } from '../src/shards/pine-hollow/generators/forestStory';

// G565: Pine's forest story as rows of the shared quest page, its second real user after Driftwood
it("admits Pine's forest story as quest page rows with every facet", () => {
  const page = v.parse(QuestPageSchema, structuredClone(PINE_QUEST_PAGE));
  expect(page.kit?.section).toBe(FOREST_STORY.content);
  expect([page.board?.panel, page.collections?.panel]).toEqual([FOREST_STORY.panels.board, FOREST_STORY.panels.count]);
  expect(page.mover?.id).toBe(FOREST_STORY.mover.id);
  expect(page.map?.zones).toEqual(FOREST_STORY.map.zones);
  expect(page.door?.gates.gates[0]?.target).toEqual({ kind: 'piece', piece: FOREST_STORY.door.id });
  expect(page.pages.map(row => row.file)).toEqual([FOREST_STORY.files.signals, FOREST_STORY.files.door]);
  expect(page.points.map(row => row.id)).toEqual(FOREST_STORY.signals.map(row => row.id));
  expect(page.places?.map(row => row.id)).toEqual(FOREST_STORY.map.pois.map(row => row.id));
  expect(new Set(Object.values(page.systems).flat()).size).toBe(Object.values(page.systems).flat().length);
});

it('publishes the page rows with their wire schema', () => {
  expect(PINE_QUEST_PAGE_BLOB.file.name).toBe('quests/page-composition.json');
  expect(JSON.parse(new TextDecoder().decode(PINE_QUEST_PAGE_BLOB.bytes))).toEqual(structuredClone(PINE_QUEST_PAGE));
});
