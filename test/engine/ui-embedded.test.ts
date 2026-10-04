// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { UiLayers } from '../../src/engine/ui/layers';
import { Scope } from '../../src/engine/app/scope';

describe('embedded layer handles', () => {
  it('registers map/debug descendants without blocking or inerting their menu ancestor', () => {
    const layers = new UiLayers(), scope = new Scope('menu');
    const menu = document.createElement('div'), map = document.createElement('div'), debug = document.createElement('div');
    menu.append(map, debug);
    const back = vi.fn<() => void>(), embeddedBack = vi.fn<() => void>();
    const owner = layers.push('gameMenu', { root: menu, back, order: 0 }, scope);
    const mapHandle = layers.push('gameMenu', { root: map, embedded: true, back: embeddedBack, order: 0 }, scope);
    const debugHandle = layers.push('menu', { root: debug, embedded: true, back: embeddedBack, order: 0 }, scope);
    expect(owner.top).toBe(true); expect(menu.inert).toBe(false); expect(map.inert).toBe(false); expect(debug.inert).toBe(false);
    expect(layers.top).toBe('gameMenu'); expect(layers.isTop(debugHandle)).toBe(false);
    expect(map.style.zIndex).toBe('calc(var(--ws-layer-gameMenu) + 0)');
    layers.back(); expect(back).toHaveBeenCalledOnce(); expect(embeddedBack).not.toHaveBeenCalled();
    const modalScope = scope.child('modal');
    layers.push('modal', { root: document.createElement('div'), back: () => undefined }, modalScope);
    expect(menu.inert).toBe(true); modalScope.dispose(); expect(menu.inert).toBe(false);
    scope.dispose(); expect(owner.active).toBe(false); expect(mapHandle.active).toBe(false); expect(debugHandle.active).toBe(false);
  });
  it('keeps a HUD placement nonblocking and disposes a nested handle independently', () => {
    const scope = new Scope('hud'), child = scope.child('map-open'), layers = new UiLayers();
    const hud = layers.push('hud', { root: document.createElement('div'), order: 6, embedded: true, back: () => undefined }, scope);
    const map = layers.push('gameMenu', { root: document.createElement('div'), embedded: true, back: () => undefined }, child);
    expect(layers.blocking).toBe(false); expect(layers.back()).toBe(false);
    child.dispose(); expect(map.active).toBe(false); expect(hud.active).toBe(true); scope.dispose();
    expect(scope.census.disposers).toBe(0);
  });
});
