import { expect, it, vi } from 'vitest';
import { BoxGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { app } from '../../../src/engine/app/runtime';
import { PageResidency } from '../../../src/game/grid/pageResidency';
import { coverRuntimeAssets } from '../../../src/game/grid/assetResidency';
import { cachedResourceAllocations } from '../../../src/engine/render/textureBytes';
import { Scope } from '../../../src/engine/app/scope';
import { ownSceneTree, SceneOwnership } from '../../../src/engine/app/sceneOwnership';
import { preloadDuneMeshes, duneHd, duneMesh, duneRig } from '../../../src/shards/sunscar-dunes/world/meshes';
import { DUNE_HD, DUNE_MESHES, DUNE_RIGS } from '../../../src/shards/sunscar-dunes/data/files';
import { legacyDouble } from '../../fake/FakeGame';

it('keeps live Dunes model users valid and reconstructs evicted source caches on three admissions', async () => {
  const initial = new Set(app.assets.retained().map(row => row.key));
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation((url) => {
    const box = new BoxGeometry();
    // a baked rig (SF72) carries its colours and its bones as `_JOINTS` / `_WEIGHTS`
    if (url.includes('/rigs/')) for (const [name, size] of [['color', 3], ['_joints', 4], ['_weights', 4]] as const) box.setAttribute(name, new Float32BufferAttribute(new Float32Array(box.getAttribute('position').count * size), size));
    const scene = new Group().add(new Mesh(box, new MeshStandardMaterial({ map: new Texture() })));
    return Promise.resolve({ scene, scenes: [scene], animations: [], cameras: [], asset: { version: '2.0' },
      parser: legacyDouble<GLTF['parser']>({}), userData: {} });
  });
  let previous: Texture | undefined;
  try {
    for (let visit = 0; visit < 3; visit++) {
      // Exercise both borrowed standalone coverage and an admitted grid runtime. Concrete caches exceed
      // this deliberately small measured claim; the horse must load with the excess charged independently.
      const page = new PageResidency(), renderer = new Scope('renderer'), level = renderer.child('level');
      page.admitHome('home', 512);
      page.bindAssets(app.assets, renderer, visit === 0 ? level : null, () => level, cachedResourceAllocations);
      const regional = visit === 0 ? null : page.allocator.reserve({ id: 'sim:dunes', owner: 'dunes', category: 'sim', bytes: 512, distance: 0, needed: true });
      if (visit !== 0 && regional === null) throw new Error('fixture regional admission');
      if (regional !== null) coverRuntimeAssets(page.allocator, level, regional);
      await preloadDuneMeshes();
      const count = loaded.mock.calls.length;
      await preloadDuneMeshes(); expect(loaded).toHaveBeenCalledTimes(count);
      expect(count).toBe((visit + 1) * (DUNE_MESHES.length + DUNE_HD.length + DUNE_RIGS.length));
      expect(page.allocator.cost().input.commons).toBeGreaterThan(0);
      const covered = page.allocator.entries().filter(row => row.coveredBy !== undefined);
      expect(covered.reduce((sum, row) => sum + row.bytes, 0)).toBeLessThanOrEqual(512);
      const hero = duneHd('horse-hd', { size: 2, by: 'height' }), faceted = duneMesh('dry-well'), rig = duneRig('skitterer');
      if (hero === null || faceted === null || rig === null) throw new Error('Missing parsed Signal Dunes models');
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
      faceted.dispose(); rig.dispose();
      for (const row of app.assets.retained()) if (!initial.has(row.key)) expect(app.assets.evictCached(row.key)).toBe(true);
      expect(duneMesh('dry-well')).toBeNull(); expect(duneRig('skitterer')).toBeNull();
      expect(app.assets.retained().map(row => row.key)).toEqual([...initial]);
      level.dispose(); regional?.release(); page.dispose(); renderer.dispose();
      expect(page.allocator.entries()).toEqual([]);
    }
  } finally {
    loaded.mockRestore();
    for (const row of app.assets.retained()) if (!initial.has(row.key)) app.assets.evictCached(row.key);
  }
});
