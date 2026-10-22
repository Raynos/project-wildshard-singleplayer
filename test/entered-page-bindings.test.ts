// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { createLevelInstallation } from '../src/engine/level/installation';
import { shardContext, type BagVerbs } from '../src/game/plugin/context';
import { installEnteredRuntimeService, RetainedRuntimeHooks } from '../src/game/shard/retainedHooks';
import { legacyDouble } from './fake/FakeGame';
import { MANIFEST as TEMPLATE } from '../src/shards/_template/discovery.generated';

const none = (): void => undefined;

test('two runtimes on one page: Bag tabs and input contexts with one id belong to the entered runtime only', () => {
  const page = new Scope('two-runtimes'), app = new App(), tabs = new Set<string>();
  // the page's Bag: one tab per id, as the page menu refuses a duplicate
  const bag = { tab: (spec: { readonly id: string }) => { if (tabs.has(spec.id)) throw new Error(`Duplicate UI tab: ${spec.id}`); tabs.add(spec.id); return () => { tabs.delete(spec.id); }; }, fragment: () => none };
  const runtime = (name: string, deferActivation: boolean): RetainedRuntimeHooks => {
    const owner = page.child(name);
    const level = createLevelInstallation(app, owner, { inputContext: (def) => { const held = owner.child(`input.${def.id}`); app.input.register(def, held); return () => { held.dispose(); }; } },
      () => ({ set: none, detail: none }));
    return new RetainedRuntimeHooks(shardContext(level.context, TEMPLATE, { shard: TEMPLATE, rows: new Map(), bag }), { deferActivation });
  };
  const install = (hooks: RetainedRuntimeHooks): void => {
    hooks.context.bag.tab(legacyDouble<Parameters<BagVerbs['tab']>[0]>({ id: 'finds.shared' }));
    installEnteredRuntimeService(hooks.context, (scope) => {
      hooks.context.inputContext({ id: 'ride.foot', actions: ['ride.whistle'] }); app.input.push('ride.foot', scope);
    });
  };
  try {
    const home = runtime('home', false), neighbour = runtime('neighbour', true);
    install(home); install(neighbour);
    expect([...tabs]).toEqual(['finds.shared']); expect(app.input.top).toBe('ride.foot');
    home.deactivate(); expect(tabs.size).toBe(0); expect(app.input.top).not.toBe('ride.foot');
    neighbour.activate(); expect([...tabs]).toEqual(['finds.shared']); expect(app.input.top).toBe('ride.foot');
    neighbour.deactivate(); home.activate(); expect([...tabs]).toEqual(['finds.shared']);
  } finally { page.dispose(); }
  expect(tabs.size).toBe(0);
});
