// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { UiLayers } from '#engine/ui/layers';
import { Scope } from '#engine/app/scope';
import { BagRegistry } from '#game/bag/registry';

describe('scoped overlay stack', () => {
  it('sends back only to the highest layer, restoring lower input on disposal', () => {
    const scope = new Scope('level'), layers = new UiLayers();
    const lower = document.createElement('div'), upper = document.createElement('div');
    const backLower = vi.fn<() => void>(), backUpper = vi.fn<() => void>();
    const a = layers.push('gameMenu', { root: lower, back: backLower }, scope);
    const b = layers.push('modal', { root: upper, back: backUpper }, scope);
    expect(layers.top).toBe('modal'); expect(lower.inert).toBe(true); expect(a.top).toBe(false);
    layers.back(); expect(backUpper).toHaveBeenCalledOnce(); expect(backLower).not.toHaveBeenCalled();
    b.dispose(); expect(a.top).toBe(true); expect(lower.inert).toBe(false);
    layers.back(); expect(backLower).toHaveBeenCalledOnce();
    scope.dispose(); expect(layers.top).toBe('hud'); expect(a.active).toBe(false);
    expect(layers.back()).toBe(false); expect(scope.census.disposers).toBe(0);
  });
  it('excludes parked resident overlays while preserving shell overlays', () => {
    const first = new Scope('first'), second = new Scope('second'), shell = new Scope('shell');
    let active: Scope | null = first;
    const layers = new UiLayers(); layers.connect(() => undefined, () => active);
    const firstBack = vi.fn<() => void>(), secondBack = vi.fn<() => void>();
    layers.push('gameMenu', { root: document.createElement('div'), back: firstBack }, first);
    active = second;
    layers.push('menu', { root: document.createElement('div'), back: secondBack }, second);
    layers.back(); expect(secondBack).toHaveBeenCalledOnce(); expect(firstBack).not.toHaveBeenCalled();
    second.dispose(); expect(layers.top).toBe('hud'); active = first; layers.refresh();
    expect(layers.top).toBe('gameMenu');
    layers.push('error', { root: document.createElement('div'), back: () => undefined }, shell);
    active = second; expect(layers.top).toBe('error'); first.dispose(); shell.dispose();
  });
  it('cannot register a view into an already disposed scope', () => {
    const scope = new Scope('closed'), layers = new UiLayers(); scope.dispose();
    const handle = layers.push('modal', { root: document.createElement('div'), back: () => undefined }, scope);
    expect(handle.active).toBe(false); expect(layers.top).toBe('hud');
  });
});
describe('registered Bag content', () => {
  it('orders tabs and fragments independently and rejects silent replacement', () => {
    const bag = new BagRegistry(), host = document.createElement('div');
    const off = bag.tab({ id: 'custom', title: 'Custom', order: 2 });
    bag.tab({ id: 'map', title: 'Map', order: 1 });
    expect(bag.registeredTabs.map((row) => row.id)).toEqual(['map', 'custom']);
    expect(() => bag.tab({ id: 'custom', title: 'Other' })).toThrow('Duplicate UI tab');
    const render = (text: string) => (element: HTMLElement): void => { element.append(text); };
    bag.fragment('custom', { id: 'last', order: 10, render: render('C') });
    const remove = bag.fragment('custom', { id: 'first', order: 0, render: render('A') });
    bag.fragment('custom', { id: 'second', order: 0, render: render('B') });
    expect(() => bag.fragment('custom', { id: 'first', render: render('D') })).toThrow('Duplicate UI fragment');
    bag.render('custom', host); expect(host.textContent).toBe('ABC');
    remove(); host.replaceChildren(); bag.render('custom', host); expect(host.textContent).toBe('BC');
    off(); expect(bag.registeredTabs.map((row) => row.id)).toEqual(['map']);
  });
});
