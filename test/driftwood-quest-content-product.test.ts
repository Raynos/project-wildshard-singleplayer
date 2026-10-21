import { expect, test } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState, lineFor } from '../src/engine/quest/core';
import { parseQuestStory } from '../src/format/questStory';
import { readProjectAssets } from '../src/sdk/project';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { DRIFTWOOD_QUESTS, DRIFTWOOD_MARKERS } from '../src/shards/driftwood-isle/generators/quests';
import source from '../src/shards/driftwood-isle/shard.config';
import { QUEST_NPCS } from '../src/shards/driftwood-isle/generators/questNpcs';
import { DRIFTWOOD_FEATS } from '../src/shards/driftwood-isle/generators/questInventory';

const QUEST_HOST = source.questHost;
const DRIFTWOOD_QUEST = DRIFTWOOD_QUESTS.quests[0];
if (DRIFTWOOD_QUEST === undefined) throw new Error('Missing declared chapter');

// Frozen canonical values from the original play-read declarations, before compilation.
const originals = {
  "DRIFTWOOD_QUESTS": "db864504348b2e29323dc304c3c7bcfd1d7ef9dd49b1b4ffddff4d6df3f79ec3",
  "DRIFTWOOD_MARKERS": "da24e56f3cbb383cae488b79fbcd4680295185d3beb1405c9690437a82ec9b59",
  "QUEST_NPCS": "46922485d24413abca301edbc06b0fcf354fed05b86d8b1c3099fcc816a07e8d"
};
const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

test('the retained DW producer preserves story, POI anchors, NPC policy and ordered command routes', async () => {
  const loaded = await readProjectAssets('src/shards/driftwood-isle');
  expect(hash(DRIFTWOOD_QUESTS)).toBe(originals.DRIFTWOOD_QUESTS);
  const { achievements, ...originalQuests } = loaded.shard.quests;
  expect(hash(originalQuests)).toBe(originals.DRIFTWOOD_QUESTS);
  expect(achievements).toEqual(DRIFTWOOD_FEATS);
  const storyFile = loaded.output.namedFiles?.find(file => file.name === 'quests/story.json');
  const storyBytes = storyFile === undefined ? undefined : loaded.assets.get(storyFile.hash);
  if (storyBytes === undefined) throw new Error('The product must contain named story rows');
  const story = parseQuestStory(JSON.parse(new TextDecoder().decode(storyBytes)));
  expect(story.quest.id).toBe('sealed-ring');
  expect(hash(story.quest.markers)).toBe(originals.DRIFTWOOD_MARKERS);
  expect(hash(DRIFTWOOD_MARKERS)).toBe(originals.DRIFTWOOD_MARKERS);
  expect(loaded.shard.questHost).toEqual(QUEST_HOST);
  expect(QUEST_HOST?.commands.routes.map(route => [route.value, route.spot])).toEqual([
    [1, 'iron-sword'], [100, 'castaway-chest'], [101, 'beacon'], [102, 'shard-lookout'],
    [103, 'hold-key'], [104, 'hold-pump'], [105, 'hold-winch'], [106, 'strongbox'],
    [110, 'sluice'], [111, 'shard-cave'], [112, 'altar'], [113, 'reef-treasure'],
    [114, 'vista-bench'], [0, 'castaway.talk'], [2, 'zipline'],
  ]);
  expect(QUEST_HOST?.commands.inputs).toMatchObject({ riding: 'event:quest.zipline-riding' });
  expect(QUEST_HOST?.observations).toContainEqual({
    binding: 'event:quest.zipline-riding', kind: 'cable', cable: 'driftwood.zipline', state: 'riding',
  });
  expect(QUEST_HOST?.commands.routes.find(route => route.spot === 'zipline')).toMatchObject({
    value: 2, when: '!riding', action: { kind: 'cable', cable: 'driftwood.zipline', command: 'start' },
  });
  expect(hash(QUEST_NPCS)).toBe(originals.QUEST_NPCS);
  expect(hash(loaded.shard.questNpcs)).toBe(originals.QUEST_NPCS);
  expect(DRIFTWOOD_MARKERS['shrine']).toEqual({ poi: 'shrine', anchor: 'shrine.altar', x: 0, z: 2.4 });
  expect(DRIFTWOOD_MARKERS['captain']).toEqual({ poi: 'shrine', anchor: 'shrine.pool', x: 0, z: 9 });
  expect(DRIFTWOOD_MARKERS['ring']).toEqual({ poi: 'shrine', anchor: 'shrine.reward', x: 0, z: 6 });
}, 30_000);

test('Wendell and the complete quest retain flag progression and old-save restoration at every beat', () => {
  const npc = QUEST_NPCS[0].npc;
  const flags = new Flags('compiled-driftwood-story', false);
  const quest = new QuestState(DRIFTWOOD_QUEST, flags);
  try {
    const opening = lineFor(npc, flags);
    expect(opening?.sets).toEqual(['talked:castaway']);
    expect(quest.isStarted).toBe(false);
    for (const flag of opening?.sets ?? []) flags.set(flag);
    expect(quest.current?.id).toBe('shards');
    for (const step of DRIFTWOOD_QUEST.steps) {
      expect(quest.current?.id).toBe(step.id);
      const restoredFlags = new Flags('restored-driftwood-story', false);
      restoredFlags.restore(flags.all);
      const restored = new QuestState(DRIFTWOOD_QUEST, restoredFlags);
      try {
        restored.restore({ version: 1, id: 'sealed-ring', started: true, currentId: step.id });
        expect(restored.current?.id).toBe(step.id);
        expect(lineFor(npc, restoredFlags)).toEqual(lineFor(npc, flags));
      } finally { restored.dispose(); }
      for (const flag of step.done.all ?? []) flags.set(flag);
    }
    expect(quest.isComplete).toBe(true);
    const saved = flags.all;
    flags.reset(); flags.restore(saved);
    expect(quest.isComplete).toBe(true);
    expect(lineFor(npc, flags)?.lines[0]).toContain('The planet, right in the ring!');
  } finally { quest.dispose(); }
});
