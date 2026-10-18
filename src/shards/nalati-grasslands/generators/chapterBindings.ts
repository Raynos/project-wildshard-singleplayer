import { parseChapterStoryPresentation } from '@wildshard/format/questStory';
import type { QuestEffect } from '@wildshard/format/questSteps';
import content from '../data/questContent.json' with { type: 'json' };

/** Story actions are immutable rows; the existing guest selects their identities. */
export function chapterPresentation(story: unknown): ReturnType<typeof parseChapterStoryPresentation> {
  const flag = (name: string): QuestEffect => ({ kind: 'flag', flag: name });
  const actions: Record<string, QuestEffect[]> = {
    qBonded: [flag('tamed:horse')], qArgymaq: [flag('tamed:argymaq'), flag('felled:argymaq')],
    qInside: [flag('entered:kurgan')], qKing: [flag('dead:golden-king')],
    qTied: [flag('lit:cairn')], qTitan: [flag('dead:jel-ata')],
  };
  const observations: Record<string, { source: { flag: string } | { quest: string; step?: string; state?: 'active' } | { saved: { record: 'elites' | 'bosses'; id: string; field: 'kills' | 'defeated' } }; on: string }> = {
    king: { source: { saved: { record: 'bosses', id: 'golden-king', field: 'defeated' } }, on: 'quest' },
    titan: { source: { saved: { record: 'bosses', id: 'storm-titan', field: 'defeated' } }, on: 'quest' },
    clueStep: { source: { quest: 'golden-king', step: 'clues', state: 'active' }, on: 'carving' },
  };
  content.clueFlags.forEach((name, i) => {
    const lines = content.carvings[i]; if (lines === undefined) throw new Error('Missing clue reading');
    observations[`clue${i}`] = { source: { flag: name }, on: 'carving' };
    actions[`qClue${i}`] = [{ kind: 'toast', text: `A carving on its back · clue ${i + 1} / ${content.clueFlags.length}` },
      { kind: 'reading', title: `A toppled balbal · ${i + 1} / ${content.clueFlags.length}`, lines }, flag(name)];
  });
  content.featherElites.forEach((elite, i) => {
    observations[`elite${i}`] = { source: { saved: { record: 'elites', id: elite.id, field: 'kills' } }, on: 'feathers' };
    observations[`felled${i}`] = { source: { flag: `felled:${elite.id}` }, on: 'feathers' }; actions[`qElite${i}`] = [flag(`felled:${elite.id}`)];
  });
  content.featherFlags.forEach((name, i) => {
    observations[`feather${i}`] = { source: { flag: name }, on: 'feathers' }; actions[`qFeather${i}`] = [flag(name)];
    actions[`qNotice${i}`] = [{ kind: 'toast', when: { quest: 'father-wind', state: 'active' }, text: `Storm feather · ${i + 1} / ${content.featherFlags.length}` }];
  });
  return parseChapterStoryPresentation({ ...parseChapterStoryPresentation(story), decision: { observations, actions } });
}
