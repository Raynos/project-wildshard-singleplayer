// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext } from '../src/game/plugin/context';
import { QuestViews } from '../src/game/plugin/ui';
import { RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { DialogueBox } from '../src/engine/quest/view/ui';
import { TEMPLATE } from '../src/shards/_template/manifest';

test('quest views borrow home ownership, recreate modal clocks and refuse stale or duplicate widgets', () => {
  const scope = new Scope('quest-view-test'), app = new App();
  const level = createLevelInstallation(app, scope, {}, () => ({ set: () => { /* No external service in this lifetime fixture. */ }, detail: () => { /* No external service in this lifetime fixture. */ } }));
  const context = shardContext(level.context, TEMPLATE, { shard: TEMPLATE, rows: new Map(), bag: { tab: () => () => { /* No external service in this lifetime fixture. */ }, fragment: () => () => { /* No external service in this lifetime fixture. */ } } });
  const retained = new RetainedRuntimeHooks(context), views = new QuestViews(retained.context);
  const events: string[] = [];
  try {
    const dialogue = views.view('dialogue', owner => { events.push('dialogue'); return new DialogueBox(owner); });
    views.enter(() => { events.push('wire'); });
    const first = dialogue(); first.open('Friend', ['Still reading.'], () => { /* No external service in this lifetime fixture. */ });
    expect(first.isOpen).toBe(true);
    expect(() => views.view('dialogue', () => { throw new Error('must not construct'); })).toThrow('Invalid or duplicate');
    expect(() => views.view('../escape', () => { throw new Error('must not construct'); })).toThrow('Invalid or duplicate');
    views.leave(() => { events.push('leave'); });
    let fired = false; views.timeout(60_000, () => { fired = true; });
    retained.deactivate(); expect(() => dialogue()).toThrow('left its home');
    expect(() => views.timeout(0, () => { /* No external service in this lifetime fixture. */ })).toThrow('left its home');
    expect(first.isOpen).toBe(false); expect(fired).toBe(false); expect(events).toContain('leave');
    retained.activate(); expect(dialogue()).not.toBe(first); expect(dialogue().isOpen).toBe(false);
    expect(events.slice(-2)).toEqual(['dialogue', 'wire']);
    const ordinary = new QuestViews(context), resident = ordinary.view('dialogue', owner => new DialogueBox(owner));
    ordinary.enter(() => { resident().open('Friend', ['Same clock.'], () => { /* No external service in this lifetime fixture. */ }); });
    expect(resident().isOpen).toBe(true); ordinary.disposeLegacy(() => { resident().dispose(); });
    expect(resident().isOpen).toBe(false);
  } finally { scope.dispose(); }
  expect(() => new QuestViews(context)).toThrow('live scope');
});
