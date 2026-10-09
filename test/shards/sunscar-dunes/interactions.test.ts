// oxlint-disable-next-line import/no-nodejs-modules -- Import the interaction rules in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { Flags } from '../../../src/engine/world/interact/flags';
import { InteractionRules, type InteractionResult } from '../../../src/game/quest/interactionRows';
import { SIGNAL_INTERACTIONS } from '../../../src/shards/sunscar-dunes/quests/interactions';
import { FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { BRAZIERS } from '../../../src/shards/sunscar-dunes/data/layout';
import { brazierFlag } from '../../../src/shards/sunscar-dunes/quests/brazierFlag';

const fresh = (): { flags: Flags; rules: InteractionRules; order: string[] } => {
  const flags = new Flags('test:sunscar-interactions', false), order: string[] = [];
  flags.onChange((flag, on) => { if (on) order.push(flag); });
  return { flags, rules: new InteractionRules(flags, SIGNAL_INTERACTIONS), order };
};
const OK: InteractionResult = { ok: true }, no = (reason: string): InteractionResult => ({ ok: false, reason });
const pour = (i: number): string => `pour.${String(i)}`, light = (i: number): string => `light.${String(i)}`;

it('keeps the shipping quest order: logbook, well, oil, three waymarks, then the signal fire', () => {
  const { rules, order } = fresh(), visuals: string[] = [];
  expect(rules.run('logbook')).toEqual(OK); expect(rules.run('logbook')).toEqual(no('already'));
  expect(rules.run('well')).toEqual(no('unraised'));
  expect(rules.run(pour(0))).toEqual(no('missing'));
  expect(rules.run(light(0))).toEqual(no('unoiled'));
  expect(rules.run('crank')).toEqual(OK); expect(rules.run('crank')).toEqual(no('already')); expect(rules.has('raised')).toBe(true);
  expect(rules.run('well')).toEqual(OK); expect(rules.run('well')).toEqual(no('already'));
  for (let i = 0; i < BRAZIERS.length; i++) {
    expect(rules.check('fire')).toEqual(no('unlit'));
    expect(rules.run(light(i)).ok).toBe(false); // an unoiled bowl does not catch
    expect(rules.run(pour(i))).toEqual(OK); expect(rules.run(pour(i))).toEqual(no('already'));
    expect(rules.run(light(i), () => { visuals.push(`brazier:${String(i)}`); })).toEqual(OK);
    expect(rules.run(light(i)).ok).toBe(false); expect(rules.run(pour(i))).toEqual(no('already'));
  }
  expect(rules.check('fire')).toEqual(OK);
  expect(rules.run('fire', () => { visuals.push('fire'); })).toEqual(OK); expect(rules.run('fire')).toEqual(no('already'));
  expect(order).toEqual([FLAG.logbook, FLAG.oil, ...BRAZIERS.map((_, i) => brazierFlag(i)), FLAG.lit]);
  expect(visuals).toEqual([...BRAZIERS.map((_, i) => `brazier:${String(i)}`), 'fire']);
});

it('runs the visual callback after the marks and before the durable flag, as the browser world did', () => {
  const { flags, rules } = fresh(), seen: boolean[][] = [];
  rules.run('crank'); rules.run('well'); for (let i = 0; i < BRAZIERS.length; i++) rules.run(pour(i));
  rules.run(light(1), () => { seen.push([rules.has('lit.1'), flags.has(brazierFlag(1))]); });
  rules.run(light(0)); rules.run(light(2));
  rules.run('fire', () => { seen.push([rules.has('fire'), flags.has(FLAG.lit)]); });
  expect(seen).toEqual([[true, false], [true, false]]);
});

it('starts raised from a saved oil flag and never re-sets durable flags', () => {
  const flags = new Flags('test:sunscar-saved', false); flags.set(FLAG.oil);
  const rules = new InteractionRules(flags, SIGNAL_INTERACTIONS);
  expect(rules.has('raised')).toBe(true); expect(rules.run('crank').ok).toBe(false); expect(rules.run('well')).toEqual(no('already'));
  expect(rules.run(pour(2))).toEqual(OK);
});

it('round-trips the transient oil, well and fire marks exactly and refuses a corrupt one', () => {
  const { rules } = fresh();
  rules.run('crank'); rules.run('well'); rules.run(pour(0)); rules.run(light(0)); rules.run(pour(2));
  const saved = rules.snapshot();
  const { flags: other } = fresh(); other.set(FLAG.oil); other.set(brazierFlag(0));
  const back = new InteractionRules(other, SIGNAL_INTERACTIONS); back.restore(saved);
  expect(back.snapshot()).toBe(saved);
  expect(BRAZIERS.map((_, i) => [back.has(`oiled.${String(i)}`), back.has(`lit.${String(i)}`)])).toEqual([[true, true], [false, false], [true, false]]);
  expect(back.run(pour(2))).toEqual(no('already')); expect(back.run(light(2))).toEqual(OK);
  const parsed: unknown = JSON.parse(saved);
  if (typeof parsed !== 'object' || parsed === null || !('marks' in parsed) || typeof parsed.marks !== 'object' || parsed.marks === null) throw new Error('snapshot is not an object');
  const marks = parsed.marks, missing = Object.fromEntries(Object.entries(marks).filter(([key]) => key !== 'raised'));
  for (const bad of [{ version: 2 }, { marks: missing }, { marks: { ...marks, 'lit.1': true } }, { marks: { ...marks, extra: true } }, { marks: { ...marks, raised: 1 } }, { extra: 1 }]) {
    const before = back.snapshot();
    expect(() => { back.restore(JSON.stringify({ ...parsed, ...bad })); }).toThrow(); expect(back.snapshot()).toBe(before);
  }
  expect(() => back.run(pour(BRAZIERS.length))).toThrow('Unknown interaction row');
  expect(() => { back.mark('unknown'); }).toThrow('Unknown interaction mark');
});

it('imports the interaction rules without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "await import('./src/game/quest/interactionRows.ts'); await import('./src/shards/sunscar-dunes/quests/interactions.ts'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
