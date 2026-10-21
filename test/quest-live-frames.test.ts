// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { Scope } from '../src/engine/app/scope';
import { QuestState } from '../src/engine/quest/core';
import { Flags } from '../src/engine/world/interact/flags';
import { createQuestPlacements, type Place, type PoiId } from '../src/engine/world/interact/types';
import { presentQuest } from '../src/game/plugin/ui';
import { parseQuestStory, parseAdventureContent } from '../src/format/questStory';
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

test('a live marker uses its authored frame while frozen Place callbacks retain checked narrowing', () => {
  const scope = new Scope('quest-live-frame'), flags = new Flags('quest-live-frame', false), at = { poi: 'hut', x: 2, z: 3 };
  const quest = new QuestState({ id: 'frames', title: 'Frames', completeFlag: 'done',
    steps: [{ id: 'find', objective: 'Find', done: { all: ['found'] }, markers: [{ id: 'gate', label: 'Gate', at }] }] }, flags);
  const player = { position: new Vector3(), velocity: new Vector3(), yaw: 0, pitch: 0, carried: false };
  const host = { scope, player, toast: () => undefined, sting: () => undefined };
  // The unchanged legacy contract must still narrow a closed record after world.
  const frames: Record<Exclude<PoiId, 'world'>, { x: number; z: number }> = {
    hut: { x: 10, z: 20 }, lookout: { x: 0, z: 0 }, wreck: { x: 0, z: 0 },
    shrine: { x: 0, z: 0 }, cave: { x: 0, z: 0 }, pier: { x: 0, z: 0 },
  };
  const place = (row: Place): { x: number; y: number; z: number } => {
    if (row.poi === 'world') return { x: row.x, y: 0, z: row.z };
    const frame = frames[row.poi]; return { x: frame.x + row.x, y: 0, z: frame.z + row.z };
  };
  try {
    const legacy = presentQuest(host, quest, { place });
    expect(legacy.markers()[0]).toMatchObject({ x: 12, z: 23 });
    at.poi = 'orchard';
    expect(() => legacy.markers()).toThrow('live frame resolver');
    const resolver = createQuestPlacements({ terrain: () => 3, frames: { orchard: { x: 10, z: 20, rot: Math.PI / 2 } } });
    const placements = { [JSON.stringify(at)]: resolver.place(at) };
    const live = presentQuest({ ...host, scope: scope.child('live') }, quest, { placements });
    expect(live.markers()[0]).toMatchObject({ x: 13, z: 18 });
    const missing = presentQuest({ ...host, scope: scope.child('missing') }, quest, { placements: {} });
    expect(() => missing.markers()).toThrow('admitted frame placement');
    expect(() => presentQuest(host, quest, { place, placements })).toThrow('one frame resolver');
  } finally { scope.dispose(); quest.dispose(); }
});
