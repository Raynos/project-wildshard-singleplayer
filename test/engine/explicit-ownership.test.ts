// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { App } from '../../src/engine/app/app';
import { Scope, registrationTimerIds, scopeRegistrations } from '../../src/engine/app/scope';
import { currentOwner, enterOwner, withOwner } from '../../src/engine/app/ownership';

it('re-enters level owners under the retained engine frame and restores the caller even on failure', () => {
  const app = new App(), level = new Scope('level'); enterOwner(app.engineScope);
  const observed: (Scope | null)[] = [];
  app.addSystem({ id: 'level.callback', phase: 'update', run: () => { observed.push(currentOwner()); } }, level);
  app.events.on('app.state', () => { observed.push(currentOwner()); }, level);
  app.input.register({ id: 'test', actions: ['use'], keys: { use: ['KeyE'] } }, level); app.input.push('test', level);
  app.input.bind('use', () => { observed.push(currentOwner()); }, level);
  app.systemsByPhase().update[0]?.run(1 / 60, 0); app.events.emit('app.state', { prev: 'boot', next: 'play' }); app.events.flush('update'); app.input.press('use');
  expect(observed).toEqual([level, level, level]); expect(currentOwner()).toBe(app.engineScope);
  expect(() => withOwner(level, () => { throw new Error('owned failure'); })).toThrow('owned failure');
  expect(currentOwner()).toBe(app.engineScope);
  level.dispose(); app.engineScope.dispose(); enterOwner(null);
});

it('keeps live native categories, abort hooks and canceled/finished timer IDs exact without intercepting globals', async () => {
  const scope = new Scope('operation'), abort = new AbortController(), fn = vi.fn<() => void>();
  scope.listen(window, 'test', fn, { signal: abort.signal });
  expect(scopeRegistrations((owner) => owner === scope).listeners).toEqual({ window: 1, document: 0, canvas: 0, other: 1 });
  abort.abort(); expect(scopeRegistrations((owner) => owner === scope).listeners).toEqual({ window: 0, document: 0, canvas: 0, other: 0 });
  const canceled = scope.timeout(100_000, fn); expect(registrationTimerIds().timeouts).toContain(Number(canceled));
  scope.cancelTimer(canceled); expect(registrationTimerIds().timeouts).not.toContain(Number(canceled));
  await new Promise<void>((resolve) => { scope.timeout(0, resolve); });
  expect(registrationTimerIds().timeouts).toHaveLength(0);
  const raf = scope.raf(fn); scope.cancelRaf(raf);
  expect(scopeRegistrations((owner) => owner === scope).timers).toEqual({ timeouts: 0, intervals: 0, raf: 0 });
  const element = scope.ownNode(document.createElement('div')); document.body.append(element); scope.dispose();
  expect(element.isConnected).toBe(false); expect(fn).not.toHaveBeenCalled();
});
