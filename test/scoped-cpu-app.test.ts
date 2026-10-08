import { expect, it } from 'vitest';
import { App } from '../src/engine/app/app';

it('charges only trusted content registration after the level boundary, regardless of author IDs or core flags', () => {
  const app = new App(), scope = app.engineScope.child('level');
  app.addContentSystem({ id: 'pre-bootstrap', phase: 'update', run: () => undefined }, scope);
  app.cpu.bind(scope, 'fixture');
  app.addSystem({ id: 'shell', phase: 'update', run: () => undefined }, scope);
  app.addContentSystem({ id: 'engine.fake-label', phase: 'update', core: true, run: () => undefined }, scope);
  app.cpu.enabled = true; app.cpu.begin();
  for (const spec of app.systemsByPhase().update) spec.run(1 / 60, 0);
  app.cpu.end();
  expect(app.cpu.snapshot().owners).toMatchObject([{ id: 'fixture', calls: 1 }]);
  app.engineScope.dispose(); expect(app.cpu.snapshot().owners).toEqual([]);
});

it('counts a throwing content callback without changing its error, and leaves disabled counters untouched', () => {
  const app = new App(), scope = app.engineScope.child('level'); app.cpu.bind(scope, 'fixture');
  const failure = new Error('same failure');
  app.addContentSystem({ id: 'throws', phase: 'fixed.step', run: () => { throw failure; } }, scope);
  const run = app.systemsByPhase()['fixed.step'][0]?.run; if (run === undefined) throw new Error('Missing fixture system');
  expect(() => run(1 / 60, 0)).toThrow(failure); expect(app.cpu.snapshot().frame).toBe(0);
  app.cpu.enabled = true; app.cpu.begin(); expect(() => run(1 / 60, 0)).toThrow(failure); app.cpu.end();
  expect(app.cpu.snapshot().owners[0]?.calls).toBe(1);
  app.engineScope.dispose();
});
