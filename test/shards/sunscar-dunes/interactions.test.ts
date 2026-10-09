// oxlint-disable-next-line import/no-nodejs-modules -- Import the interaction rules in plain Node with the renderer-denying loader.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the current Node binary for the closure proof.
import { execPath } from 'node:process';
import { expect, it } from 'vitest';
import { Flags } from '../../../src/engine/world/interact/flags';
import { SignalInteractions } from '../../../src/shards/sunscar-dunes/runtime/interactions';
import { FLAG } from '../../../src/shards/sunscar-dunes/data/flags';
import { BRAZIERS } from '../../../src/shards/sunscar-dunes/layout';
import { brazierFlag } from '../../../src/shards/sunscar-dunes/quest/brazierFlag';

const fresh = (): { flags: Flags; rules: SignalInteractions; order: string[] } => {
  const flags = new Flags('test:sunscar-interactions', false), order: string[] = [];
  flags.onChange((flag, on) => { if (on) order.push(flag); });
  return { flags, rules: new SignalInteractions(flags, BRAZIERS.length), order };
};

it('keeps the shipping quest order: logbook, well, oil, three waymarks, then the signal fire', () => {
  const { rules, order } = fresh(), visuals: string[] = [];
  expect(rules.readLogbook()).toBe(true); expect(rules.readLogbook()).toBe(false);
  expect(rules.takeOil()).toBe('unraised');
  expect(rules.pour(0)).toBe('missing');
  expect(rules.light(0)).toBe(false);
  expect(rules.pullWell()).toBe(true); expect(rules.pullWell()).toBe(false); expect(rules.raised).toBe(true);
  expect(rules.takeOil()).toBe('taken'); expect(rules.takeOil()).toBe('already');
  for (let i = 0; i < BRAZIERS.length; i++) {
    expect(rules.allLit).toBe(false);
    expect(rules.light(i)).toBe(false); // an unoiled bowl does not catch
    expect(rules.pour(i)).toBe('poured'); expect(rules.pour(i)).toBe('already');
    expect(rules.light(i, () => { visuals.push(`brazier:${String(i)}`); })).toBe(true);
    expect(rules.light(i)).toBe(false); expect(rules.pour(i)).toBe('already');
  }
  expect(rules.allLit).toBe(true);
  expect(rules.lightFire(() => { visuals.push('fire'); })).toBe(true); expect(rules.lightFire()).toBe(false);
  expect(order).toEqual([FLAG.logbook, FLAG.oil, ...BRAZIERS.map((_, i) => brazierFlag(i)), FLAG.lit]);
  expect(visuals).toEqual([...BRAZIERS.map((_, i) => `brazier:${String(i)}`), 'fire']);
});

it('runs the visual callback before the durable flag, as the browser world did', () => {
  const { flags, rules } = fresh(), seen: boolean[] = [];
  rules.pullWell(); rules.takeOil(); rules.pour(1);
  rules.light(1, () => { seen.push(flags.has(brazierFlag(1))); });
  rules.lightFire(() => { seen.push(flags.has(FLAG.lit)); });
  expect(seen).toEqual([false, false]);
});

it('starts raised from a saved oil flag and never re-sets durable flags', () => {
  const flags = new Flags('test:sunscar-saved', false); flags.set(FLAG.oil);
  const rules = new SignalInteractions(flags, BRAZIERS.length);
  expect(rules.raised).toBe(true); expect(rules.pullWell()).toBe(false); expect(rules.takeOil()).toBe('already');
  expect(rules.pour(2)).toBe('poured');
});

it('round-trips the transient oil, well and fire state exactly and refuses a corrupt one', () => {
  const { rules } = fresh();
  rules.pullWell(); rules.takeOil(); rules.pour(0); rules.light(0); rules.pour(2);
  const saved = rules.snapshot();
  const { flags: other } = fresh(); other.set(FLAG.oil); other.set(brazierFlag(0));
  const back = new SignalInteractions(other, BRAZIERS.length); back.restore(saved);
  expect(back.snapshot()).toBe(saved);
  expect(back.braziers.map(b => [b.oiled, b.lit])).toEqual([[true, true], [false, false], [true, false]]);
  expect(back.pour(2)).toBe('already'); expect(back.light(2)).toBe(true);
  const parsed: unknown = JSON.parse(saved);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('snapshot is not an object');
  for (const bad of [{ version: 2 }, { braziers: [] }, { braziers: [{ oiled: false, lit: true }, { oiled: false, lit: false }, { oiled: false, lit: false }] }, { extra: 1 }]) {
    const before = back.snapshot();
    expect(() => back.restore(JSON.stringify({ ...parsed, ...bad }))).toThrow(); expect(back.snapshot()).toBe(before);
  }
  expect(() => back.pour(BRAZIERS.length)).toThrow('Unknown signal brazier');
});

it('imports the interaction rules without DOM or renderer modules', () => {
  const result = spawnSync(execPath, ['--experimental-transform-types', '--disable-warning=ExperimentalWarning', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e',
    "await import('./src/shards/sunscar-dunes/runtime/interactions.ts'); if (typeof window !== 'undefined' || typeof document !== 'undefined') throw new Error('DOM present');"], { encoding: 'utf8', timeout: 20000 });
  expect(result.stderr).toBe(''); expect(result.status).toBe(0);
});
