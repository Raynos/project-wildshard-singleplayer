import { expect, it } from 'vitest';
import * as v from 'valibot';
import { QuestGraphSchema, parseQuestGraph } from '@wildshard/format/questGraph';
import { InteractionRowsSchema, parseInteractionRows } from '@wildshard/format/questInteractions';
import { QuestGraphSchema as RuntimeGraph, parseQuestGraph as runtimeGraph } from '@wildshard/game/plugin/quests';
import { InteractionRowsSchema as RuntimeRows, parseInteractionRows as runtimeRows } from '@wildshard/game/quest/interactionRows';
import { parseQuestGraph as authorGraph } from '@wildshard/sdk/questGraph';
import { parseInteractionRows as authorRows } from '@wildshard/sdk/interactions';
import { QuestGraphSchema as ReleasedGraph } from './fixtures/quest-graph-released';
import { InteractionRowsSchema as ReleasedRows } from './fixtures/quest-interactions-released';
import { SKY_GRAPH, SKY_ACTIONS } from '../src/shards/far-reach/data/questGraph';
import { SIGNAL_GRAPH } from '../src/shards/sunscar-dunes/data/signalGraph';
import { SIGNAL_INTERACTIONS } from '../src/shards/sunscar-dunes/data/signalInteractions';

function verdict(schema: v.GenericSchema, input: unknown): string {
  const result = v.safeParse(schema, input);
  return JSON.stringify(result.success ? { success: true, output: result.output } : { success: false,
    issues: result.issues.map(issue => ({ kind: issue.kind, type: issue.type, message: issue.message, path: issue.path?.map(part => part.key) })) });
}

it('shares defining contracts and every released graph and interaction byte', () => {
  expect(RuntimeGraph).toBe(QuestGraphSchema); expect(RuntimeRows).toBe(InteractionRowsSchema);
  for (const row of [SKY_GRAPH, SIGNAL_GRAPH]) {
    const expected = JSON.stringify(v.parse(ReleasedGraph, row));
    for (const parse of [parseQuestGraph, runtimeGraph, authorGraph]) expect(JSON.stringify(parse(row))).toBe(expected);
  }
  for (const row of [SKY_ACTIONS, SIGNAL_INTERACTIONS]) {
    const expected = JSON.stringify(v.parse(ReleasedRows, row));
    for (const parse of [parseInteractionRows, runtimeRows, authorRows]) expect(JSON.stringify(parse(row))).toBe(expected);
  }
});

it('preserves bounded admission and ordered refusals for both native graph families', () => {
  for (const row of [SKY_GRAPH, SIGNAL_GRAPH]) {
    const corpus: unknown[] = [row, null, [], { ...row, extra: true }, { ...row, actions: Array.from({ length: 65 }, () => ({ row: 'r', summon: 'boss' })) }];
    for (const value of ['', 'x'.repeat(96), 'x'.repeat(97), 0, null, undefined]) corpus.push({ ...row, actor: value }, { ...row, step: value }, { ...row, actions: [{ row: value, summon: value }] });
    for (const input of corpus) expect(verdict(QuestGraphSchema, input)).toBe(verdict(ReleasedGraph, input));
  }
  for (const rows of [SKY_ACTIONS, SIGNAL_INTERACTIONS]) {
    const first = rows.rows[0]; if (first === undefined) throw new Error('Released fixture needs an interaction');
    const corpus: unknown[] = [rows, null, [], { ...rows, extra: true }, { marks: [], rows: [first, first] },
      { marks: [{ id: 'mark' }, { id: 'mark' }], rows: [] }, { marks: [], rows: [{ ...first, sets: [] }] },
      { ...rows, never: [{ all: ['one'], none: ['two'] }] }, { ...rows, rows: Array.from({ length: 257 }, () => first) }];
    for (const value of [-1, 0, 1, Number.NaN, Infinity, '0', null, undefined]) corpus.push({ marks: [], rows: [{ ...first, act: value }] });
    for (const count of [0, 1, 64, 65]) corpus.push({ marks: [], rows: [{ ...first, sets: Array.from({ length: count }, (_, index) => String(index)) }] });
    for (const input of corpus) expect(verdict(InteractionRowsSchema, input)).toBe(verdict(ReleasedRows, input));
  }
});
