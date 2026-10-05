import { expect, it } from 'vitest';
import { resumeSoakDocument, SoakDocuments } from '../scripts/soak/documents';

const value = { runId: 'pin:shipped:cells', elapsed: 143, index: 6, cycles: 1, stepSpent: 2000,
  holdSpent: null, lastResidents: ['template-1'], entered: false, events: [{ type: 'entry', admitted: true }] };
it('requires a real planned exit and preserves route progress instead of counting a far proxy or starting over', () => {
  expect(resumeSoakDocument(value, value.runId, 30, true)).toEqual(value);
  for (const [input, runId, planned] of [[value, value.runId, false], [value, 'other', true], [{ ...value, index: 30 }, value.runId, true],
    [{ ...value, elapsed: 1800 }, value.runId, true], [{ ...value, extra: 1 }, value.runId, true]] as const) {
    expect(() => resumeSoakDocument(input, runId, 30, planned)).toThrow();
  }
});
it('counts boot windows apart from active play and refuses navigation in a continuous leg', () => {
  const continuous = new SoakDocuments(false);
  continuous.observe('first', 100); continuous.ready(102);
  expect(() => continuous.observe('second', 120)).toThrow('continuous');
  const reloads = new SoakDocuments(true);
  expect(reloads.observe('first', 100)).toBe(true); reloads.ready(102);
  expect(reloads.observe('first', 110)).toBe(false);
  expect(reloads.observe('second', 120)).toBe(true); reloads.ready(123);
  expect(reloads.boots.map((boot) => boot.seconds)).toEqual([2, 3]);
  expect(() => reloads.ready(125)).toThrow('No observed');
});
