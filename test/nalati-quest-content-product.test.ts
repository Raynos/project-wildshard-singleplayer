import { expect, test } from 'vitest';
import { parseChapterStoryPresentation } from '../src/format/questStory';
import { Flags } from '../src/engine/world/interact/flags';
import { QuestState, lineFor } from '../src/engine/quest/core';
import { readProjectAssets } from '../src/sdk/project';
import feats from '../src/shards/nalati-grasslands/data/feats.json' with { type: 'json' };
import content from '../src/shards/nalati-grasslands/data/questContent.json' with { type: 'json' };
import kokpar from '../src/shards/nalati-grasslands/data/kokpar.generated.json' with { type: 'json' };
import source from '../src/shards/nalati-grasslands/shard.config';
import chapters from '../src/shards/nalati-grasslands/data/chapterStory.json' with { type: 'json' };

test('Nalati compiles its chapters, camp dialogues, placements and discovery into its product', async () => {
  const { achievements, ...quests } = source.quests;
  expect(quests).toEqual(content.quests);
  expect(achievements).toEqual(feats);
  expect(content.quests.quests.length).toBeGreaterThan(0);
  expect(Object.keys(content.people).length).toBeGreaterThan(0);
  expect(content.places.length).toBeGreaterThan(0);
  for (const npc of Object.values(content.npcs)) expect(npc.dialogue.length).toBeGreaterThan(0);
  const loaded = await readProjectAssets('src/shards/nalati-grasslands');
  expect(loaded.shard.quests).toEqual(source.quests);
  const file = loaded.output.namedFiles?.find(row => row.name === 'quests/content.json');
  const bytes = file === undefined ? undefined : loaded.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing compiled Nalati quest content');
  expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({ npcs: content.npcs, places: content.places, kokpar });
  const module = loaded.output.namedFiles?.find(row => row.name === 'behaviour/nalati.kokpar.wasm');
  expect(module?.hash).toBe(kokpar.program.script.module.split('/').at(-1)?.slice(0, -5));
  expect(module?.critical).toBe(true);
  const chapterFile = loaded.output.namedFiles?.find(row => row.name === 'quests/chapters.json');
  const chapterBytes = chapterFile === undefined ? undefined : loaded.assets.get(chapterFile.hash);
  if (chapterBytes === undefined) throw new Error('Missing compiled chapter presentation');
  const { decision, ...display } = parseChapterStoryPresentation(JSON.parse(new TextDecoder().decode(chapterBytes)));
  expect(display).toEqual(chapters);
  const readings = Object.values(decision?.actions ?? {}).flat().filter(effect => effect.kind === 'reading');
  expect(readings.map(reading => reading.lines)).toEqual(content.carvings);
  const eliteReads = Object.values(decision?.observations ?? {}).filter(row => 'saved' in row.source && row.source.saved.record === 'elites').map(row => 'saved' in row.source ? row.source.saved.id : '');
  expect(eliteReads).toEqual(content.featherElites.map(elite => elite.id));
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
