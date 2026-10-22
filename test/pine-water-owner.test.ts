import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Mesh, MeshPhysicalMaterial, MeshStandardMaterial, Scene, Texture } from 'three';
import { bindPageWater } from '../src/game/shardfile/pageWater';
import type { ShardContext } from '../src/game/plugin/context';
import { lendLooks } from '@wildshard/game/shardfile/lentLooks';
import waterRows from '../src/shards/pine-hollow/data/waterLook.json' with { type: 'json' };
import { waterTexture } from '@wildshard/engine/world/water/ripples';

const { looks: WATER_LOOKS } = waterRows;

const waterBinding = { object: 'pond', look: WATER_LOOKS.pond, looks: Object.values(WATER_LOOKS), ripples: 'ripples', skyline: 'skyline', centre: 'skyC', probe: 'waterSkyline' };
function dressWater(game: { scene: Scene; rootScene: Scene }): void { bindPageWater({ game: { runtime: { world: { game } } } } as ShardContext, waterBinding); }

const textures = vi.fn((_id: string, _name: string, _texture: Texture): void => undefined);
const materials = new Map(Object.values(WATER_LOOKS).map(id => [id, new MeshStandardMaterial()]));

function pond(scene: Scene): { mesh: Mesh; material: MeshPhysicalMaterial; ripples: Texture; skyline: Texture } {
  const ripples = new Texture(), skyline = new Texture();
  const material = new MeshPhysicalMaterial({ normalMap: ripples }), mesh = new Mesh(undefined, material);
  mesh.name = 'pond'; mesh.userData['waterSkyline'] = skyline; scene.add(mesh);
  return { mesh, material, ripples, skyline };
}

describe('Pine water scene ownership', () => {
  beforeEach(() => {
    textures.mockClear();
    lendLooks({ onDispose: () => undefined }, { materials, setParam: () => undefined, setTexture: textures, bindMeshMap: () => new MeshStandardMaterial() });
  });

  it('keeps a regional scene without a pond playable and lends real ripples without touching the page pond', () => {
    const rootScene = new Scene(), scene = new Scene(), page = pond(rootScene);
    const disposed = vi.fn((): void => undefined); page.material.addEventListener('dispose', disposed);
    dressWater({ rootScene, scene });
    expect(scene.children).toHaveLength(0);
    expect(page.mesh.material).toBe(page.material);
    expect(disposed).not.toHaveBeenCalled();
    expect(textures).toHaveBeenCalledWith(expect.any(String), 'ripples', waterTexture());
    expect(textures.mock.calls.every(([, name]) => name === 'ripples')).toBe(true);
  });

  it('still refuses a missing standalone pond', () => {
    const scene = new Scene();
    expect(() => dressWater({ rootScene: scene, scene })).toThrow('Missing native water');
    expect(textures).not.toHaveBeenCalled();
  });

  it('still refuses a malformed pond in a regional scene without mutating it', () => {
    const rootScene = new Scene(), scene = new Scene(), invalid = new Mesh(); invalid.name = 'pond'; scene.add(invalid);
    const material = invalid.material;
    expect(() => dressWater({ rootScene, scene })).toThrow('Missing native water');
    expect(invalid.material).toBe(material);
    expect(textures).not.toHaveBeenCalled();
  });

  it('dresses a valid standalone pond with its existing borrowed textures', () => {
    const scene = new Scene(), water = pond(scene), disposed = vi.fn((): void => undefined);
    water.material.addEventListener('dispose', disposed);
    dressWater({ rootScene: scene, scene });
    expect(water.mesh.material).toBe(materials.get(WATER_LOOKS.pond));
    expect(disposed).toHaveBeenCalledOnce();
    expect(textures).toHaveBeenCalledWith(expect.any(String), 'ripples', water.ripples);
    expect(textures).toHaveBeenCalledWith(expect.any(String), 'skyline', water.skyline);
  });
});
