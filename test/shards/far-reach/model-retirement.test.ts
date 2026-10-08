import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { app } from '../../../src/engine/app/runtime';
import { Scope } from '../../../src/engine/app/scope';
import { ownSceneTree, SceneOwnership } from '../../../src/engine/app/sceneOwnership';
import { preloadSkyMeshes, skyHd, skyMesh } from '../../../src/shards/far-reach/world/meshes';
import { SKY_HD, SKY_MESHES } from '../../../src/shards/far-reach/boot/files';
import { legacyDouble } from '../../fake/FakeGame';

it('charges Sky model sources once, preserves live map users, and reconstructs evicted module caches on three cold admissions', async () => {
  const initial = new Set(app.assets.retained().map(row => row.key));
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => {
    const scene = new Group().add(new Mesh(new BoxGeometry(), new MeshStandardMaterial({ map: new Texture() })));
    return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' },
      parser: legacyDouble<GLTF['parser']>({}), userData: {} });
  });
  let previous: Texture | undefined;
  try {
    for (let visit = 0; visit < 3; visit++) {
      await preloadSkyMeshes();
      const count = loaded.mock.calls.length;
      await preloadSkyMeshes(); expect(loaded).toHaveBeenCalledTimes(count);
      expect(count).toBe((visit + 1) * (SKY_MESHES.length + SKY_HD.length));
      const hero = skyHd('keeper-hd'), faceted = skyMesh('keeper');
      if (hero === null || faceted === null) throw new Error('Missing actual parsed Sky models');
      expect(hero.map).not.toBe(previous); previous = hero.map;
      expect(app.assets.isAcquired(hero.map)).toBe(true);
      const dispose = vi.spyOn(hero.map, 'dispose'), consumer = new Scope(`sky.visit:${visit}`);
      const root = new Group().add(new Mesh(hero.geometry, new MeshStandardMaterial({ map: hero.map })));
      ownSceneTree(root, consumer, app.assets);
      new SceneOwnership(root, consumer, app.assets).capture();
      expect(app.assets.evictCached(`scene:${hero.map.uuid}`)).toBe(false);
      consumer.dispose(); expect(dispose).not.toHaveBeenCalled();
      expect(app.assets.evictCached(`scene:${hero.map.uuid}`)).toBe(true); expect(dispose).toHaveBeenCalledOnce();
      expect(skyHd('keeper-hd')).toBeNull();
      faceted.dispose();
      for (const row of app.assets.retained()) if (!initial.has(row.key)) expect(app.assets.evictCached(row.key)).toBe(true);
      expect(skyMesh('keeper')).toBeNull();
      expect(app.assets.retained().map(row => row.key)).toEqual([...initial]);
    }
  } finally {
    loaded.mockRestore();
    for (const row of app.assets.retained()) if (!initial.has(row.key)) app.assets.evictCached(row.key);
  }
});
