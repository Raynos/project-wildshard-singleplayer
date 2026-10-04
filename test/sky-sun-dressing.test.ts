import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferGeometry, Mesh, PerspectiveCamera, Scene, Sprite, Vector3 } from 'three';
import { Scope, type LevelSpec, type Renderer, type Sky, type SkyDressing } from '#engine';
import { SkyBackdropView } from '#engine-internal/world/skyBackdrop';

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
        const surface = f.view.sunDisc, corona = f.view.sunHalo;
        expect(Array.isArray(surface.material)).toBe(false);
        if (Array.isArray(surface.material)) throw new Error('Sun surface must have one material');
        expect(surface.material.visible).toBe(true);
        expect(surface.visible).toBe(disc);
        expect(corona).toBeInstanceOf(Sprite); expect(corona?.visible).toBe(halo);
        expect(corona?.parent).toBe(!disc && halo ? f.scene : surface); expect(surface.parent).toBe(f.scene);
        expect(surface.position.toArray()).toEqual([0, 1500, 0]);
        expect(f.direction.toArray()).toEqual([0, 1, 0]);
      } finally { f.scope.dispose(); }
    });
  }
  for (const sun of [undefined, {}, { disc: false }, { halo: false }]) {
    it(`defaults omitted flags on for ${JSON.stringify(sun)}`, () => {
      const f = build(sun);
      try {
        const surface = f.view.sunDisc, corona = f.view.sunHalo;
        if (Array.isArray(surface.material)) throw new Error('Sun surface must have one material');
        expect(surface.visible).toBe(sun?.disc !== false);
        expect(corona?.visible).toBe(sun?.halo !== false);
      } finally { f.scope.dispose(); }
    });
  }
  it('never presents the disabled disc geometry for upload, including a halo-only sky (G25 leak)', () => {
    for (const halo of [false, true]) {
      const f = build({ disc: false, halo });
      const visibleGeometries = new Set<string>();
      f.scene.traverseVisible((object) => {
        if (object instanceof Mesh && object.geometry instanceof BufferGeometry) visibleGeometries.add(object.geometry.uuid);
      });
      // WebGLRenderer uploads each visible mesh's geometry before testing material.visible.
      expect(visibleGeometries.has(f.view.sunDisc.geometry.uuid)).toBe(false);
      expect(visibleGeometries.size).toBe(0);
      f.scope.dispose();
      expect(f.scope.census.geometries).toBe(0);
    }
  });
  it('keeps a halo-only sun on the current camera and sun direction without a visible mesh', () => {
    const f = build({ disc: false, halo: true });
    const camera = new PerspectiveCamera(); camera.position.set(10, 20, 30);
    f.direction.set(1, 0, 0);
    f.view.updateSunHalo(camera);
    expect(f.view.sunHalo?.position.toArray()).toEqual([1510, 20, 30]);
    expect(f.view.sunDisc.visible).toBe(false);
    f.scope.dispose();
  });
});
