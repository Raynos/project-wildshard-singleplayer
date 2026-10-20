import { expect, test } from 'vitest';
import { parseQuestSpawnPage, parseQuestLeadPage, QuestSpawnPageSchema, QuestLeadPageSchema } from '../src/format/questSteps';
import { questSpawnObservations, questSpawnPublications } from '../src/game/quest/steps';
import { formatJsonSchema } from '../src/sdk/formatJsonSchema';

const rows = { quest: 'reed-watch', script: 'marsh.watch', channel: 2, limit: { phone: 2, desktop: 5 },
  flags: [{ flag: 'watch:active', when: { all: ['asked:watch'], none: ['done:watch'] } }],
  complete: [{ flag: 'watch:complete', when: { all: ['asked:watch'], none: ['done:watch'] },
    effects: [{ kind: 'flag', flag: 'done:watch' }, { kind: 'toast', text: 'The reeds fall quiet' }, { kind: 'sting', name: 'chunk' }] }],
  cues: [{ kind: 'puff', id: 9 }], puffs: { color: [0.3, 0.4, 0.8], count: 2, height: 0.5, burst: [1, 2, 0.4, 0.6] } };

test('another quest maps its facts and publishes its guest completion exactly once', () => {
  const admitted = parseQuestSpawnPage(rows), flags: string[] = [];
  expect(questSpawnObservations(admitted, flags)).toEqual([]);
  flags.push('asked:watch'); expect(questSpawnObservations(admitted, flags)).toEqual(['watch:active']);
  expect(questSpawnPublications(admitted, flags, [])).toEqual([]);
  expect(questSpawnPublications(admitted, flags, ['watch:complete'])).toEqual(rows.complete[0]?.effects);
  flags.push('done:watch'); expect(questSpawnObservations(admitted, flags)).toEqual([]);
  expect(questSpawnPublications(admitted, flags, ['watch:complete'])).toEqual([]);
});

test('ordered publications observe earlier flag effects before paying the next row', () => {
  const admitted = parseQuestSpawnPage({ ...rows, complete: [...rows.complete, { ...rows.complete[0], flag: 'watch:second' }] });
  expect(questSpawnPublications(admitted, ['asked:watch'], ['watch:complete', 'watch:second'])).toEqual(rows.complete[0]?.effects);
});

test('spawn bindings admit only bounded effects and structurally export their schema', () => {
  expect(() => formatJsonSchema(QuestSpawnPageSchema)).not.toThrow();
  expect(parseQuestSpawnPage(rows).script).toBe('marsh.watch');
  expect(() => parseQuestSpawnPage({ ...rows, cues: [...rows.cues, ...rows.cues] })).toThrow('Duplicate');
  expect(() => parseQuestSpawnPage({ ...rows, complete: [{ ...rows.complete[0], effects: [{ kind: 'call', owner: 'page' }] }] })).toThrow();
  expect(() => parseQuestSpawnPage({ ...rows, flags: () => [] })).toThrow();
});

test('guide and spawn publications admit every concrete quest effect kind', () => {
  const effects = [{ kind: 'flag', flag: 'done:watch' }, { kind: 'item', item: 'reed-token', count: 2 },
    { kind: 'toast', text: 'The reeds fall quiet' }, { kind: 'sting', name: 'chunk' },
    { kind: 'reading', title: 'The watch', lines: ['A mark in the reeds'] }];
  const spawn = parseQuestSpawnPage({ ...rows, complete: [{ ...rows.complete[0], effects }] });
  expect(questSpawnPublications(spawn, ['asked:watch'], ['watch:complete'])).toEqual(effects);
  const guide = parseQuestLeadPage({ quest: rows.quest, step: 'walk', signal: 'lead', nightAbove: 0.6,
    actor: { kind: 'deer', variant: 'guide' }, path: [[1, 2]], motion: { faceTurn: 3, trotSpeed: 4, trotTurn: 4, stopTurn: 1 }, sound: 'deer_call',
    effects: { appear: effects, complete: effects }, puffs: { color: [1, 1, 1], count: 2, height: 1, appear: [1, 1, 1, 1], fade: [1, 1, 1, 1] } });
  expect(guide.effects.complete).toEqual(effects);
  expect(() => formatJsonSchema(QuestLeadPageSchema)).not.toThrow();
});
