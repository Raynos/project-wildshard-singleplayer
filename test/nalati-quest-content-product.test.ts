import { expect, test } from 'vitest';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState, lineFor } from '../src/engine/quest/core';
import { readProjectAssets } from '../src/sdk/project';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };
import source from '../src/shards/nalati-grasslands/shard.config';
import chapters from '../src/shards/nalati-grasslands/data/chapterStory.json' with { type: 'json' };

// Canonical hashes captured from the original runtime declarations before compilation.
const originals = {
  "quests": "998739cb8846170e4ac49555419b3e08608cfd8340d0368c72e65ccb481ba9a3",
  "people": "03a058659dff6d3b4734f85e21f2febe2184592ece7fa0f8027520e90d973561",
  "npcs": "7a99a5f03b3d5baec3967b09ed953a0ac5473aeddb8389402a7022ffc2c48ff6",
  "carvings": "b1c378085ac1f8bd756d2c16a9dec2a5e929a3aa097ead737ae6dc57c6ec201f",
  "clueFlags": "5316881d188b046a555b2368c2617392c7bc4f48c624abaa44f08c742f7ef716",
  "featherFlags": "3d3136cc0a753d32b7ab9e456154ac0057f3e73719436c361d272deca14e970b",
  "featherElites": "6104b99c302b155013536fc6213ba0f6df1a34e1f9ee1b832578f19edd4347c2",
  "places": "ada35df4f3dcc9e80fc830cb5a0c2811459b68f155994e9737804adeae7254e6"
};
const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

test('Nalati compiles the unchanged chapters, camp dialogues, placements and discovery into its product', async () => {
  for (const key of Object.keys(originals) as (keyof typeof originals)[]) expect(hash(content[key]), key).toBe(originals[key]);
  expect(hash(source.quests)).toBe(originals.quests);
  const loaded = await readProjectAssets('src/shards/nalati-grasslands');
  expect(hash(loaded.shard.quests)).toBe(originals.quests);
  const file = loaded.output.namedFiles?.find(row => row.name === 'quests/content.json');
  const bytes = file === undefined ? undefined : loaded.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing compiled Nalati quest content');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(content);
  const chapterFile = loaded.output.namedFiles?.find(row => row.name === 'quests/chapters.json');
  const chapterBytes = chapterFile === undefined ? undefined : loaded.assets.get(chapterFile.hash);
  if (chapterBytes === undefined) throw new Error('Missing compiled chapter presentation');
  expect(JSON.parse(new TextDecoder().decode(chapterBytes))).toEqual(chapters);
}, 30_000);

test('compiled Nalati chapters resume old flag saves at every step and retain elder dialogue', () => {
  const flags = new Flags('compiled-nalati-story', false);
  for (const row of source.quests.quests) {
    for (const flag of row.startWhen?.all ?? []) flags.set(flag);
    const quest = new QuestState(row, flags);
    try {
      for (const step of row.steps) {
        expect(quest.current?.id).toBe(step.id);
        const restoredFlags = new Flags('restored-nalati-story', false);
        restoredFlags.restore(flags.all);
        const restored = new QuestState(row, restoredFlags);
        try {
          restored.restore(quest.snapshot());
          expect(restored.current?.id).toBe(step.id);
          for (const npc of Object.values(content.npcs)) expect(lineFor(npc, restoredFlags)).toEqual(lineFor(npc, flags));
        } finally { restored.dispose(); }
        for (const flag of step.done.all ?? step.done.any?.slice(0, 1) ?? []) flags.set(flag);
      }
      expect(quest.isComplete).toBe(true);
      const saved = flags.all;
      flags.reset(); flags.restore(saved);
      expect(quest.isComplete).toBe(true);
    } finally { quest.dispose(); }
  }
  expect(flags.has('quest:tulpar')).toBe(true);
  expect(flags.has('quest:golden-king')).toBe(true);
  expect(flags.has('quest:father-wind')).toBe(true);
  expect(lineFor(content.npcs.elder, flags)?.lines).toEqual(content.npcs.elder.dialogue[0]?.lines);
});
