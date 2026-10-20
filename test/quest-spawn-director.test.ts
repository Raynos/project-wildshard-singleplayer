import { expect, test } from 'vitest';
import { parseQuestSpawnPage, QuestSpawnPageSchema } from '../src/format/questSteps';
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
