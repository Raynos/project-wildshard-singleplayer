import { expect, test } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { GrappleTool, grappleGuard } from '../src/game/grapple/tool';
import type { GrappleSim } from '../src/game/grapple/sim';
import type { ShardContext } from '../src/game/plugin/context';
import { parseGrappleProfile, type GrappleRows } from '../src/format/grapple';
import { ItemCatalogue } from '../src/game/plugin/nativeItems';
import items from '../src/shards/nine-dragon-stack/data/items.json' with { type: 'json' };
import profile from '../src/shards/nine-dragon-stack/data/grappleProfile.json' with { type: 'json' };
import { legacyDouble } from './fake/FakeGame';

function tool(scope: Scope): GrappleTool {
  return new GrappleTool(legacyDouble<ShardContext>({ scope }), {
    equipment: new ItemCatalogue(items).equipment('tool.fei-zhua'), profile: parseGrappleProfile(profile),
    presentation: legacyDouble<GrappleRows>({}), hooks: [],
  });
}

test('a guard remains closed until it binds the same entered tool and follows its live state', () => {
  const scope = new Scope('guard'), guard = grappleGuard(scope), made = tool(scope);
  let open = false;
  made.sim = legacyDouble<GrappleSim>({ guardOpen: () => open });
  try {
    expect(grappleGuard(scope) === guard).toBe(true);
    expect(guard.open()).toBe(false);
    guard.bind(made);
    open = true; expect(guard.open()).toBe(true);
    open = false; expect(guard.open()).toBe(false);
    expect(() => guard.bind(made)).toThrow('already');
  } finally { scope.dispose(); }
  expect(guard.open()).toBe(false);
});

test('a guard refuses another entered scope before accepting its own concrete tool', () => {
  const scope = new Scope('guard'), other = new Scope('other'), guard = grappleGuard(scope);
  try {
    expect(() => guard.bind(tool(other))).toThrow('scope');
    guard.bind(tool(scope));
  } finally { scope.dispose(); other.dispose(); }
});

test('a sliced retiring ancestor closes the guard before the child cleanup and refuses binding', () => {
  const parent = new Scope('parent'), child = new Scope('child', parent), guard = grappleGuard(child), made = tool(child);
  made.sim = legacyDouble<GrappleSim>({ guardOpen: () => true });
  guard.bind(made);
  parent.onDispose(() => undefined);
  const retirement = parent.disposeSteps();
  expect(retirement.next().done).toBe(false);
  expect(child.disposed).toBe(false);
  expect(child.disposing).toBe(true);
  expect(guard.open()).toBe(false);
  expect(() => guard.bind(made)).toThrow('ended');
  for (const _step of retirement) { /* Complete the original cleanup owner. */ }
  expect(guard.open()).toBe(false);
});
