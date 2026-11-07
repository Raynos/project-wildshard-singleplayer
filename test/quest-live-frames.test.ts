// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { createQuestPlacements } from '../src/engine/shared/world/interact/types';
import { parseQuestStory, parseAdventureContent } from '@wildshard/format/questStory';
import { PAGE_STORY as story } from '../src/shards/pine-hollow/generators/pageStory';

test('live story and discovery admit authored frames and resolve their actual owner', () => {
  const at = { poi: 'orchard', x: 2, z: 3 };
  const chapter = parseQuestStory({ ...story, quest: { ...story.quest, markers: { gate: at } } });
  const discovery = parseAdventureContent({ places: [{ id: 'gate', label: 'The gate', completeLabel: 'Find the gate', at, r: 2 }],
    guide: { wander: 1, idle: 1, idleSpeed: 1, cooldown: 1, retry: 1 }, glassCount: 0, shardFlags: [] });
  const resolver = createQuestPlacements({ terrain: () => 3, frames: { orchard: { x: 10, z: 20, rot: Math.PI / 2 } } });
  const marker = chapter.quest.markers['gate'], site = discovery.places[0];
  if (marker === undefined || site === undefined) throw new Error('Missing admitted authored frame');
  expect(resolver.place(marker)).toEqual({ x: 13, y: 3, z: 18, yaw: Math.PI / 2 });
  expect(resolver.place(site.at)).toEqual(resolver.place(marker));
  expect(() => createQuestPlacements({ terrain: () => 3 }).place(marker)).toThrow('Missing quest frame');
  expect(() => parseQuestStory({ ...story, quest: { ...story.quest, markers: { gate: { ...at, poi: '' } } } })).toThrow();
  expect(() => parseAdventureContent({ ...discovery, places: [{ ...site, at: { ...at, x: Infinity } }] })).toThrow();
});

