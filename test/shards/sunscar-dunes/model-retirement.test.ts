import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { ownSceneTree, SceneOwnership } from '../../../src/engine/app/sceneOwnership';
import { preloadDuneMeshes, duneHd, duneMesh } from '../../../src/shards/sunscar-dunes/world/meshes';
import { DUNE_HD, DUNE_MESHES } from '../../../src/shards/sunscar-dunes/boot/files';
import { legacyDouble } from '../../fake/FakeGame';

it('keeps live Dunes model users valid and reconstructs evicted source caches on three admissions', async () => {
  const initial = new Set(app.assets.retained().map(row => row.key));
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => {
    const scene = new Group().add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() })));
    return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' },
      parser: legacyDouble<GLTF['parser']>({}), userData: {} });
  });
  let previous: Texture | undefined;
  try {
    for (let visit = 0; visit < 3; visit++) {
      await preloadDuneMeshes();
      const count = loaded.mock.calls.length;
      await preloadDuneMeshes(); expect(loaded).toHaveBeenCalledTimes(count);
      expect(count).toBe((visit + 1) * (DUNE_MESHES.length + DUNE_HD.length));
      const hero = duneHd('horse-hd', { size: 2, by: 'height' }), faceted = duneMesh('caravan');
      if (hero === null || faceted === null) throw new Error('Missing parsed Signal Dunes models');
      let map: Texture | undefined;
      hero.traverse(node => { if (node instanceof Mesh && node.material instanceof MeshStandardMaterial && node.material.map !== null) map = node.material.map; });
      if (map === undefined) throw new Error('Missing actual hero map');
      expect(map).not.toBe(previous); previous = map;
      expect(app.assets.isAcquired(map)).toBe(true);
      const dispose = vi.spyOn(map, 'dispose'), consumer = new Scope(`dunes.visit:${visit}`);
      ownSceneTree(hero, consumer, app.assets);
      new SceneOwnership(hero, consumer, app.assets).capture();
      expect(app.assets.evictCached(`scene:${map.uuid}`)).toBe(false);
      consumer.dispose(); expect(dispose).not.toHaveBeenCalled();
      expect(app.assets.evictCached(`scene:${map.uuid}`)).toBe(true); expect(dispose).toHaveBeenCalledOnce();
      expect(duneHd('horse-hd', { size: 2, by: 'height' })).toBeNull();
      faceted.dispose();
      for (const row of app.assets.retained()) if (!initial.has(row.key)) expect(app.assets.evictCached(row.key)).toBe(true);
      expect(duneMesh('caravan')).toBeNull();
      expect(app.assets.retained().map(row => row.key)).toEqual([...initial]);
    }
  } finally {
    loaded.mockRestore();
    for (const row of app.assets.retained()) if (!initial.has(row.key)) app.assets.evictCached(row.key);
  }
});
