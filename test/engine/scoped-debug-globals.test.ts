import { describe, expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';

function reachable(root: object, target: object, seen = new Set<object>()): boolean {
  if (root === target) return true;
  if (seen.has(root)) return false;
  seen.add(root);
  const values = root instanceof Map ? [...root.values()] : Object.values(root);
  return values.some((value: unknown) => typeof value === 'object' && value !== null && reachable(value, target, seen));
}

describe('scope-owned debug globals', () => {
  it('severs every window debug path to the retired quest world, bitmap and bake roots', () => {
    const window = {}, level = new Scope('level'), world = { canvas: {} }, bitmap = { width: 4096 }, roots = [world];
    level.expose(window, '__perfHud', { counters: new Map([['questSource', { runtime: { objects: world } }]]) });
    level.expose(window, '__skyV2', { tPano: { image: bitmap } });
    level.expose(window, '__bake', { roots });
    for (const object of [world, bitmap, roots]) expect(reachable(window, object)).toBe(true);
    level.dispose();
    for (const object of [world, bitmap, roots]) expect(reachable(window, object)).toBe(false);
    expect(Object.keys(window)).toEqual([]);
  });
  it('restores live owners and exact descriptors without resurrecting an already retired parent', () => {
    const window = {}, baseline = { value: 7, writable: false, enumerable: false, configurable: true };
    Object.defineProperty(window, '__probe', baseline);
    const first = new Scope('first'), second = new Scope('second');
    first.expose(window, '__probe', { first: true }); second.expose(window, '__probe', { second: true });
    first.dispose(); expect(Reflect.get(window, '__probe')).toEqual({ second: true });
    second.dispose(); expect(Object.getOwnPropertyDescriptor(window, '__probe')).toEqual(baseline);
    const a = new Scope('a'), b = new Scope('b');
    a.expose(window, '__nested', 'a'); b.expose(window, '__nested', 'b'); b.dispose();
    expect(Reflect.get(window, '__nested')).toBe('a'); a.dispose(); expect(Object.hasOwn(window, '__nested')).toBe(false);
  });
  it('refuses late async publication and preserves a later unrelated writer on early release', async () => {
    const window = {}, level = new Scope('level');
    const late = Promise.resolve().then(() => level.expose(window, '__late', { retired: true }));
    level.dispose(); await late; expect(Object.hasOwn(window, '__late')).toBe(false);
    const owner = new Scope('next'), release = owner.expose(window, '__probe', {});
    Object.defineProperty(window, '__probe', { configurable: true, value: 'foreign' });
    release(); release(); owner.dispose(); expect(Reflect.get(window, '__probe')).toBe('foreign');
  });
});
