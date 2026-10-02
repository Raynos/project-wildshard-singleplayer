import { afterEach, describe, expect, it, vi } from 'vitest';
import { Scene, Sprite, Vector3 } from 'three';
import { Scope, type LevelSpec, type Renderer, type Sky, type SkyDressing } from '#engine';
import { SkyBackdropView } from '#engine/world/skyBackdrop';

function fixture<T extends object>(fields: Partial<T>): T {
  return new Proxy(fields, { get: (target, key) => Reflect.get(target, key) }) as T;
}
afterEach(() => { vi.stubGlobal('document', undefined); });

function build(sun: SkyDressing['sun']) {
  const context = { createRadialGradient: () => ({ addColorStop: vi.fn() }), fillRect: vi.fn(), fillStyle: '' };
  vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const scene = new Scene(), scope = new Scope('sun-dressing');
  const direction = new Vector3(0, 1, 0);
  const view = new SkyBackdropView(scene, fixture<Renderer>({}), scope, fixture<Sky>({ sunDir: direction }));
  const level = fixture<LevelSpec>({ sky: fixture<LevelSpec['sky']>({}) });
  view.configure(level, { clouds: false, planet: false, ...(sun === undefined ? {} : { sun }) });
  view.buildSunDisc();
  return { view, scene, scope, direction };
}

describe('SkyDressing sun flags', () => {
  for (const [disc, halo] of [[true, true], [false, true], [true, false], [false, false]] as const) {
    it(`selects disc=${String(disc)} and halo=${String(halo)} independently`, () => {
      const f = build({ disc, halo });
      try {
        const surface = f.view.sunDisc, corona = surface.children[0];
        expect(Array.isArray(surface.material)).toBe(false);
        if (Array.isArray(surface.material)) throw new Error('Sun surface must have one material');
        expect(surface.material.visible).toBe(disc);
        expect(surface.visible).toBe(true); // parent remains available when only the halo is selected
        expect(corona).toBeInstanceOf(Sprite); expect(corona?.visible).toBe(halo);
        expect(corona?.parent).toBe(surface); expect(surface.parent).toBe(f.scene);
        expect(surface.position.toArray()).toEqual([0, 1500, 0]);
        expect(f.direction.toArray()).toEqual([0, 1, 0]);
      } finally { f.scope.dispose(); }
    });
  }
  for (const sun of [undefined, {}, { disc: false }, { halo: false }]) {
    it(`defaults omitted flags on for ${JSON.stringify(sun)}`, () => {
      const f = build(sun);
      try {
        const surface = f.view.sunDisc, corona = surface.children[0];
        if (Array.isArray(surface.material)) throw new Error('Sun surface must have one material');
        expect(surface.material.visible).toBe(sun?.disc !== false);
        expect(corona?.visible).toBe(sun?.halo !== false);
      } finally { f.scope.dispose(); }
    });
  }
});
