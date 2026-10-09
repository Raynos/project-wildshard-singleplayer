import { expect, it } from 'vitest';
import { Flags } from '../../src/engine/world/interact/flags';
import { InteractionRules, parseInteractionRows } from '../../src/game/quest/interactionRows';
import { parseInteractionRows as sdkParse } from '../../src/sdk/interactions';

const ROWS = { marks: [{ id: 'open' }, { id: 'primed', initial: { all: ['door.key'] } }], never: [{ all: ['open'], none: ['primed'] }],
  rows: [{ id: 'prime', act: 1, at: 'lock', needs: [{ all: ['door.key'], else: 'locked' }], sets: ['primed'] },
    { id: 'open', act: 2, at: 'door', needs: [{ none: ['open'], else: 'already' }, { all: ['primed'] }], sets: ['open', 'door.opened'] }] };

it('parses declared rows strictly through the SDK and refuses duplicates, unknown fields and empty sets', () => {
  expect(sdkParse(ROWS)).toEqual(parseInteractionRows(ROWS));
  const first = ROWS.rows[0]; if (first === undefined) throw new Error('missing row');
  for (const bad of [{ ...ROWS, rows: [first, { ...first, id: 'other' }] }, { ...ROWS, rows: [first, first] }, { ...ROWS, marks: [{ id: 'open' }, { id: 'open' }] },
    { ...ROWS, rows: [{ ...first, sets: [] }] }, { ...ROWS, rows: [{ ...first, crack: 'medium' }] }, { ...ROWS, extra: 1 }, { ...ROWS, rows: [{ ...first, act: -1 }] }])
    expect(() => parseInteractionRows(bad)).toThrow();
});

it('checks needs in order, answers the first unmet reason, and starts marks from the flags', () => {
  const flags = new Flags('test:interaction-rows', false), rules = new InteractionRules(flags, parseInteractionRows(ROWS));
  expect(rules.run('open')).toEqual({ ok: false, reason: 'refused' });
  expect(rules.run('prime')).toEqual({ ok: false, reason: 'locked' });
  flags.set('door.key');
  expect(rules.check('prime')).toEqual({ ok: true }); expect(rules.has('primed')).toBe(false);
  expect(rules.run('prime')).toEqual({ ok: true }); expect(rules.run('open')).toEqual({ ok: true });
  expect(flags.has('door.opened')).toBe(true); expect(rules.run('open')).toEqual({ ok: false, reason: 'already' });
  expect(new InteractionRules(flags, parseInteractionRows(ROWS)).has('primed')).toBe(true);
  const before = rules.snapshot();
  expect(() => { rules.restore(JSON.stringify({ version: 1, marks: { open: true, primed: false } })); }).toThrow(); expect(rules.snapshot()).toBe(before);
});
