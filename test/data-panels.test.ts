// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { parsePanelDefinition } from '../src/format/panelTemplate';
import { DataPanel, readDataPanels } from '../src/game/ui/dataPanels';
import { expandPanelTemplates } from '../src/game/ui/panelTemplates';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { PINE_PANELS } from '../src/shards/pine-hollow/generators/panels';
import horsePanel from '../src/shards/nalati-grasslands/data/namePanel.json' with { type: 'json' };
import { newBoard } from '../src/game/quest/contracts';
import { CONTRACTS } from './fixtures/pine-contracts';

const hash = (value: unknown): string => hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(value)));

test('compiled board and name markup retain the frozen pre-conversion hashes', () => {
  const board = newBoard(CONTRACTS), template = PINE_PANELS.board.body;
  if (template === undefined) throw new Error('The board must publish its body');
  expect(hash(expandPanelTemplates(template, board).nodes)).toBe('a10f1a9be5c59981d7c57809eee38b747c35948b99f6ef6e7c03aa88747dab21');
  for (const row of board.slots) row.have = row.need;
  board.claimed = 3; board.streak = 2; board.best = 4;
  expect(hash(expandPanelTemplates(template, board).nodes)).toBe('9d6e96a27f6e302e4d78c66db7cacc0ebb04fd7dd7c5213b741066fe75806471');
  const name = parsePanelDefinition(horsePanel);
  expect(hash(expandPanelTemplates([name.frame], { current: 'Camp horse' }).nodes[0])).toBe('b02352a58b3c685d08602f0e2f25b1cca8738669053e93054d89b4ce9feefc45');
  expect(hash(expandPanelTemplates([name.frame], { current: 'Tulpar' }).nodes[0])).toBe('3443f2699d0ca402acb87b307ed346a35dacd39fd2b376738ae43db7891cc5f8');
});

test('a transient count refresh replaces its hide clock and retires on scope disposal', () => {
  vi.useFakeTimers();
  const scope = new Scope('count-test'), panel = new DataPanel(PINE_PANELS.count, { scope });
  try {
    panel.show({ label: 'Amber resin', n: 4, of: 30 });
    expect(panel.view.node('label').textContent).toBe('Amber resin'); expect(panel.view.node('n').textContent).toBe('4 / 30');
    expect(panel.root.classList.contains('show')).toBe(true); expect(panel.root.classList.contains('full')).toBe(false);
    vi.advanceTimersByTime(3000); panel.show({ label: 'Carved tokens', n: 8, of: 8 });
    vi.advanceTimersByTime(600); expect(panel.root.classList.contains('show')).toBe(true); expect(panel.root.classList.contains('full')).toBe(true);
    vi.advanceTimersByTime(3000); expect(panel.root.classList.contains('show')).toBe(false);
    scope.dispose(); panel.show({ label: 'Late', n: 0, of: 1 }); expect(panel.root.isConnected).toBe(false);
  } finally { scope.dispose(); vi.useRealTimers(); }
});

test('program admission refuses unsafe paths, deep trees and unbounded expansions', () => {
  for (const text of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) expect(() => parsePanelDefinition({ lifetime: 'persistent', frame: { text } })).toThrow();
  const definition = { lifetime: 'persistent', frame: { cls: { read: 'constructor.prototype' } } };
  expect(() => parsePanelDefinition(definition)).toThrow();
  expect(() => parsePanelDefinition({ lifetime: 'persistent', frame: { attrs: [['onclick', 'run()']] } })).toThrow();
  let nested: unknown = {};
  for (let i = 0; i < 34; i++) nested = { children: [nested] };
  expect(() => parsePanelDefinition({ lifetime: 'persistent', frame: nested })).toThrow('bound');
  const rows = [{ repeat: { source: 'count', as: 'item' }, cls: '' }];
  expect(() => expandPanelTemplates(rows, { count: 257 })).toThrow('bound');
  expect(() => expandPanelTemplates(rows, { count: -1 })).toThrow('repeat');
});

test('named panel content admits both real shard consumers through one product reader', async () => {
  for (const rows of [PINE_PANELS, { name: horsePanel }]) {
    const names: string[] = [];
    const parsed = await readDataPanels({ file: name => { names.push(name); return Promise.resolve(new TextEncoder().encode(JSON.stringify(rows))); } });
    expect(names).toEqual(['quests/panels.json']); expect(Object.keys(parsed)).toEqual(Object.keys(rows));
  }
});
