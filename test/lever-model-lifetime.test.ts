import { expect, it, vi } from 'vitest';
import { BoxGeometry, CompressedTexture, Group, Mesh, MeshStandardMaterial, RGBA_S3TC_DXT5_Format } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { app } from '../src/engine/app/runtime';
import { ownSceneTree, SceneOwnership } from '../src/engine/app/sceneOwnership';
import { Scope } from '../src/engine/app/scope';
import { finalizeCompressedMipmaps } from '../src/engine/render/compressedMipmaps';
import { releaseAfterUpload } from '../src/engine/core/ktx2';
import { preloadLeverModel } from '../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { legacyDouble } from './fake/FakeGame';

it('keeps the cached rifle atlases alive across complete regional retirement and fresh kit construction', async () => {
  const root = new Group();
  const plane = (): CompressedTexture => releaseAfterUpload(new CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4, RGBA_S3TC_DXT5_Format));
  const steel = new MeshStandardMaterial({ map: plane(), normalMap: plane(), roughnessMap: plane() });
  const wood = new MeshStandardMaterial({ map: plane(), normalMap: plane(), roughnessMap: plane() });
  for (const name of ['steel', 'forend', 'stock', 'lever', 'hammer', 'bolt']) {
    const mesh = new Mesh(new BoxGeometry(), name === 'forend' || name === 'stock' ? wood : steel); mesh.name = name; root.add(mesh);
  }
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue({ scene: root, scenes: [root], cameras: [], animations: [], asset: { version: '2.0' }, parser: legacyDouble<GLTF['parser']>({}), userData: {} });
  const page = new Scope('page');
  try {
    const cached = await preloadLeverModel();
    if (cached === null) throw new Error('Actual cached model did not parse');
    const textures = new Set([cached.steel.map, cached.steel.normalMap, cached.steel.armMap, cached.wood.map, cached.wood.normalMap, cached.wood.armMap]);
    const disposed = [...textures].map(texture => vi.spyOn(texture, 'dispose'));
    for (const texture of textures) {
      expect(texture).toBeInstanceOf(CompressedTexture); texture.onUpdate?.(texture);
      // Upload is provisional; simulate the successful first-draw retirement boundary.
      expect(texture.mipmaps.length).toBeGreaterThan(0); finalizeCompressedMipmaps(texture);
    }
    // Three cannot re-upload these compressed planes once released: only the shared GPU allocation remains.
    expect([...textures].every(texture => texture.mipmaps.length === 0)).toBe(true);
    for (let visit = 0; visit < 2; visit++) {
      expect(await preloadLeverModel()).toBe(cached);
      const resident = page.child(`visit:${String(visit)}`), scene = new Group(); ownSceneTree(scene, resident, app.assets);
      const material = new MeshStandardMaterial({ map: cached.steel.map, normalMap: cached.steel.normalMap, roughnessMap: cached.steel.armMap });
      scene.add(new Mesh(cached.geo.steel.clone(), material));
      const captures = new SceneOwnership(new Group().add(scene), page, app.assets); captures.capture();
      resident.dispose();
      for (const dispose of disposed) expect(dispose).not.toHaveBeenCalled();
      for (const texture of textures) expect(app.assets.isAcquired(texture)).toBe(true);
    }
    expect(load).toHaveBeenCalledOnce();
  } finally { page.dispose(); load.mockRestore(); }
});

it('reloads the real module memo after cache eviction instead of re-uploading released atlases', async () => {
  for (const row of app.assets.retained()) app.assets.evictCached(row.key);
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(() => {
    const root = new Group(), plane = () => new CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4, RGBA_S3TC_DXT5_Format);
    const material = new MeshStandardMaterial({ map: plane(), normalMap: plane(), roughnessMap: plane() });
    for (const name of ['steel', 'forend', 'stock', 'lever', 'hammer', 'bolt']) {
      const mesh = new Mesh(new BoxGeometry(), material); mesh.name = name; root.add(mesh);
    }
    return Promise.resolve({ scene: root, scenes: [root], cameras: [], animations: [], asset: { version: '2.0' }, parser: legacyDouble<GLTF['parser']>({}), userData: {} });
  });
  let previous: object | undefined;
  try {
    for (let visit = 0; visit < 3; visit++) {
      const model = await preloadLeverModel(); if (model === null) throw new Error('Model parse failed');
      expect(model).not.toBe(previous); previous = model; expect(await preloadLeverModel()).toBe(model);
      expect(load).toHaveBeenCalledTimes(visit + 1);
      for (const row of app.assets.retained()) app.assets.evictCached(row.key);
    }
  } finally { load.mockRestore(); }
});
