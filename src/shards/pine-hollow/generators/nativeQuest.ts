import { parseNativeQuestComposition } from '@wildshard/format/nativeQuestComposition';
import authored from '../data/nativeStory.json' with { type: 'json' };
import { NATIVE_CHAPTER_DIRECTOR } from './chapterDirector';
import { PINE_QUEST_RUNTIME, PINE_QUEST_PAYLOAD } from './questRuntime';

const touchIds = Array.from({ length: PINE_QUEST_RUNTIME.policy.resinCount }, (_unused, i) => `${authored.touch.prefix}${i + 1}`);
for (const id of touchIds) {
  const row = PINE_QUEST_PAYLOAD.table.rows.find(candidate => candidate.id === id);
  if (row?.kind !== 'pickup' || row.touch !== true || row.item !== authored.touch.item) throw new Error('Story needs its declared touch pickup law');
}
/** Existing native owners, their exact phases and original saved envelope. */
export const PINE_NATIVE_QUEST = parseNativeQuestComposition({
  step: authored.step, cable: authored.cable, eye: authored.eye, counts: 'all',
  phases: ['commands', 'reading', 'cable', 'transitions', 'chapter', 'lead'],
  saved: { names: authored.savedNames,
    snapshot: ['lead', 'clock', 'fast', 'cable', 'pickup', 'counts', 'pack', 'dialogue', 'board', 'rewardOwned', 'trader', 'ammunition'],
    restore: ['clock', 'lead', 'fast', 'cable', 'pickup', 'counts', 'pack', 'dialogue', 'board', 'trader', 'ammunition', 'rewardOwned'],
    optional: ['pack', 'dialogue', 'board', 'rewardOwned', 'trader', 'ammunition'],
  },
  transitions: { ids: [...touchIds, authored.latch], rowLimit: touchIds.length + 1, flagLimit: 16, touch: 'direct', pickup: 'walk-in' },
  reading: { primary: authored.primary, delay: PINE_QUEST_RUNTIME.policy.readingDelay }, effects: { pack: authored.pack },
  board: { finish: authored.finish.id, claims: authored.finish.claims, ids: authored.finish.ids },
  trade: { pack: authored.pack, finish: authored.finish.id, speaker: authored.trader }, ammunition: { launcher: authored.launcher },
  bench: { id: authored.benchRow, pose: authored.bench }, pickup: authored.pickup, boss: { id: authored.boss },
  chapter: NATIVE_CHAPTER_DIRECTOR, lead: { step: authored.lead.step, target: authored.lead.target },
});
