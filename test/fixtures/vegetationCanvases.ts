import { expect, vi } from 'vitest';
import { Color, type Material, MeshStandardMaterial, type Texture, Vector3 } from 'three';
import { Grass } from '../../src/engine/world/Grass';
import type { Forest } from '../../src/engine/world/forest/Forest';
import type { SkyRig } from '../../src/engine/world/skyRig';
import { Undergrowth } from '../../src/shards/pine-hollow/world/undergrowth';
import { legacyDouble } from '../fake/FakeGame';
import { PINE_HOLLOW } from '../../src/shards/pine-hollow/manifest';
import { toLevelSpec } from '../../src/game/shard/spec';
import { configureLevel } from '../../src/engine/level/selection';
import { isDev, setDev } from '../../src/engine/core/devMode';
import { overrideSetting } from '../../src/engine/ui/Settings';
const noop = (): unknown => new Proxy(() => undefined, { get: () => noop(), apply: () => noop() });
class Canvas { width = 0; height = 0; getContext(): unknown { return noop(); } }
const sky = legacyDouble<SkyRig>({ sunDir: new Vector3(0, 1, 0), sunColor: new Color(1, 1, 1), setupMaterial: () => undefined });
const forest = legacyDouble<Forest>({ trees: [{ x: 30, y: 0, z: 30, r: 1, variant: 0, scale: 1, rot: 0, height: 10, tint: new Color(1, 1, 1) }], nearby: () => [] });

const map = (material: Material | Material[]): Texture => {
  if (!(material instanceof MeshStandardMaterial) || material.map === null) throw new Error('No generated map');
  return material.map;
};
const canvas = (texture: Texture): Canvas => {
  const image: unknown = texture.image; if (!(image instanceof Canvas)) throw new Error('No generated canvas'); return image;
};

export function vegetationCanvasLifetime(enabled: boolean): void {
  const developer = isDev(); setDev(true); overrideSetting('memorySaver', enabled ? 'on' : 'off');
  configureLevel(toLevelSpec(PINE_HOLLOW));
  try {
    vi.stubGlobal('HTMLCanvasElement', Canvas); vi.stubGlobal('document', { createElement: () => new Canvas() });
    let previous: readonly Texture[] = [];
    for (let visit = 0; visit < 2; visit++) {
      const grass = new Grass(sky, forest).build(), under = new Undergrowth(sky, forest).build();
      const textures = [map(grass.material), map(grass.flowers.material), ...Object.values(under.kinds).map(kind => map(kind.material))];
      expect(textures).toHaveLength(8);
      expect(textures.every(texture => !previous.includes(texture))).toBe(true);
      const sizes = textures.map(texture => [canvas(texture).width, canvas(texture).height]);
      expect(sizes).toEqual([[1024, 512], [64, 128], [512, 1024], [512, 512], [512, 512], [256, 256], [256, 256], [128, 512]]);
      const versions = textures.map(texture => texture.version), disposed = textures.map(() => 0);
    textures.forEach((texture, index) => { texture.addEventListener('dispose', () => { disposed[index] = (disposed[index] ?? 0) + 1; }); });
      for (const texture of textures) texture.onUpdate?.(texture); // The real first-upload retirement hook.
      expect(textures.map(texture => [canvas(texture).width, canvas(texture).height])).toEqual(enabled ? sizes.map(() => [1, 1]) : sizes);
      expect(textures.map(texture => texture.version)).toEqual(versions); // No second upload requested by the CPU release.
      for (const kind of Object.values(under.kinds)) {
        if (kind.customDepthMaterial === undefined) continue;
        expect(Reflect.get(kind.customDepthMaterial, 'map')).toBe(kind.material.map);
      }
      for (const texture of textures) { texture.onUpdate?.(texture); texture.dispose(); }
      for (const kind of Object.values(under.kinds)) { kind.geometry.dispose(); kind.material.dispose(); kind.customDepthMaterial?.dispose(); }
      grass.mesh.geometry.dispose(); grass.material.dispose(); grass.flowers.geometry.dispose();
      const flowerMaterial = grass.flowers.material; if (Array.isArray(flowerMaterial)) flowerMaterial.forEach(material => { material.dispose(); }); else flowerMaterial.dispose();
      expect(disposed).toEqual(textures.map(() => 1));
      previous = textures;
    }
  } finally { overrideSetting('memorySaver', null); setDev(developer); vi.unstubAllGlobals(); }
}
