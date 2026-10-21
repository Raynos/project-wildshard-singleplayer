import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';

/** A scope tree whose cleanups log their names: a parent with an early and a late cleanup around one child scope. */
function tree(log: string[]): { root: Scope; child: Scope } {
  const root = new Scope('root');
  root.onDispose(() => { log.push('root:first'); });
  const child = root.child('child');
  child.onDispose(() => { log.push('child:a'); });
  child.onDispose(() => { log.push('child:b'); });
  root.onDispose(() => { log.push('root:last'); });
  return { root, child };
}

test('O20 disposeSteps runs dispose()\'s cleanups in the same order, one step each', () => {
  const sync: string[] = [], stepped: string[] = [];
  tree(sync).root.dispose();
  const { root, child } = tree(stepped);
  const steps = [...root.disposeSteps()];
  expect(stepped).toEqual(sync);
  expect(steps.map(step => step.scope)).toEqual(['root', 'child', 'child', 'root']);
  expect(root.disposed && child.disposed).toBe(true);
});

test('O20 a stepped retirement closes at once and reports disposing across its yields', () => {
  const log: string[] = [], { root, child } = tree(log);
  const steps = root.disposeSteps();
  steps.next();
  expect(root.disposed).toBe(true);
  expect(log).toEqual(['root:last']);
  // between steps (other frames run here) the whole tree is one teardown: lookups are not new uses
  expect(child.disposing && root.disposing).toBe(true);
  expect(child.sharesTeardown(root) && root.sharesTeardown(child)).toBe(true);
  root.dispose(); // a closed scope's dispose adds nothing: the caller drains
  expect(log).toEqual(['root:last']);
  for (let step = steps.next(); step.done !== true; step = steps.next()) { /* drained */ }
  expect(log).toEqual(['root:last', 'child:b', 'child:a', 'root:first']);
  expect(child.disposing || root.disposing).toBe(false);
});

test('O20 disposeSteps still runs every cleanup when one throws, then throws them together', () => {
  const log: string[] = [], root = new Scope('root');
  root.onDispose(() => { log.push('after'); });
  root.onDispose(() => { throw new Error('boom'); });
  expect(() => { for (const step of root.disposeSteps()) void step; }).toThrow(/root disposal failed: boom/u);
  expect(log).toEqual(['after']);
});
