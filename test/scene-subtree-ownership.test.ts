import { expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene, Texture, WebGLRenderTarget } from 'three';
import { AssetService } from '../src/engine/app/assets';
import { Scope } from '../src/engine/app/scope';
import { ownSceneResource, ownSceneTree, sceneResources, SceneOwnership } from '../src/engine/app/sceneOwnership';

it.each(['outer-first', 'inner-first', 'page-first'] as const)('owns nested resources exactly once with %s disposal and a truthful page census', order => {
  const page = new Scope('page'), outer = page.child('outer'), inner = page.child('inner');
  const assets = new AssetService(), scene = new Scene(), root = new Group(), subtree = new Group();
  scene.add(root); root.add(subtree);
  ownSceneTree(root, outer, assets); ownSceneTree(subtree, inner, assets);
  const material = new MeshBasicMaterial(), batch = new BatchedMesh(1, 24, 36, material);
  const source = new BoxGeometry(); batch.addInstance(batch.addGeometry(source)); source.dispose(); subtree.add(batch);
  const batchDispose = vi.spyOn(batch, 'dispose'), geometryDispose = vi.spyOn(batch.geometry, 'dispose'), materialDispose = vi.spyOn(material, 'dispose');
  const ordinary = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); root.add(ordinary);
  const ordinaryDispose = vi.spyOn(ordinary.geometry, 'dispose');
  const ownership = new SceneOwnership(scene, page, assets);
  ownership.capture(); ownership.capture();
  // Resources remain visible under their real independent owner, without a second page owner.
  expect(outer.census).toMatchObject({ geometries: 1, materials: 1 });
  expect(inner.census).toMatchObject({ geometries: 0, materials: 1, resources: 1 });
  expect(page.census).toMatchObject({ geometries: 1, materials: 2, resources: 1 });
  if (order === 'outer-first') { outer.dispose(); ownership.capture(); inner.dispose(); }
  else if (order === 'inner-first') { inner.dispose(); ownership.capture(); outer.dispose(); }
  else page.dispose();
  page.dispose();
  expect(batchDispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
  expect(materialDispose).toHaveBeenCalledOnce(); expect(ordinaryDispose).toHaveBeenCalledOnce();
  expect(scene.children).toEqual([]); expect(Object.values(page.census).every(count => count === 0)).toBe(true);
});

it('captures uncaptured late resources at owner exit, leaving shared assets with their sole asset owner', () => {
  const page = new Scope('page'), owner = page.child('subtree'), assets = new AssetService();
  const scene = new Scene(), root = new Group(); scene.add(root); ownSceneTree(root, owner, assets);
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(); root.add(new Mesh(geometry, material));
  assets.register('shared-material', material); assets.acquire('shared-material');
  const geometryDispose = vi.spyOn(geometry, 'dispose'), materialDispose = vi.spyOn(material, 'dispose');
  owner.dispose(); page.dispose();
  expect(geometryDispose).toHaveBeenCalledOnce(); expect(materialDispose).not.toHaveBeenCalled();
  expect(scene.children).toEqual([]); assets.release('shared-material'); expect(materialDispose).toHaveBeenCalledOnce();
});

it('does not adopt an observed texture again during its own closing tree capture', () => {
  const page = new Scope('page'), owner = page.child('observed tree'), assets = new AssetService(), scene = new Scene();
  const root = new Group(), texture = new Texture(), material = new MeshBasicMaterial({ map: texture }), geometry = new BoxGeometry();
  scene.add(root); root.add(new Mesh(geometry, material)); ownSceneTree(root, owner, assets);
  const textureDispose = vi.spyOn(texture, 'dispose'), materialDispose = vi.spyOn(material, 'dispose'), geometryDispose = vi.spyOn(geometry, 'dispose');
  const ownership = new SceneOwnership(scene, page, assets); ownership.capture(); ownership.capture();
  expect(owner.census.textures).toBe(1); expect(textureDispose).not.toHaveBeenCalled();
  owner.dispose(); page.dispose();
  expect(textureDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
  expect(scene.children).toEqual([]); expect(Object.values(page.census).every(count => count === 0)).toBe(true);
});


it('never lets page post capture retain a regional sampler after its owner retires', () => {
  const page = new Scope('page'), assets = new AssetService(), ownership = new SceneOwnership(new Scene(), page, assets);
  for (let visit = 0; visit < 3; visit++) {
    const resident = page.child('resident'), lut = new Texture(), dispose = vi.spyOn(lut, 'dispose');
    ownSceneResource(lut, resident); ownership.retainContainer({ effects: [{ uniforms: { e7Lut: { value: lut } } }] });
    expect(assets.isAcquired(lut)).toBe(false);
    if (visit === 1) lut.dispose();
    resident.dispose(); expect(dispose).toHaveBeenCalledOnce();
  }
  page.dispose(); expect(assets.retained()).toEqual([]);
});

it('releases generated engine scene resources at the last level consumer, preserving live shared cache users', () => {
  const assets = new AssetService(), first = new Scope('first'), second = new Scope('second'), scene = new Scene();
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), halo = new Texture(); material.map = halo;
  scene.add(new Mesh(geometry, material));
  const geometryDispose = vi.spyOn(geometry, 'dispose'), haloDispose = vi.spyOn(halo, 'dispose');
  const a = new SceneOwnership(scene, first, assets), b = new SceneOwnership(scene, second, assets);
  a.retain(scene); b.retain(scene);
  first.dispose(); expect(geometryDispose).not.toHaveBeenCalled(); expect(haloDispose).not.toHaveBeenCalled();
  second.dispose(); expect(geometryDispose).toHaveBeenCalledOnce(); expect(haloDispose).toHaveBeenCalledOnce(); expect(assets.retained()).toEqual([]);
  const cached = new Texture(), cachedDispose = vi.spyOn(cached, 'dispose'), user = new Scope('user');
  assets.register('cache', cached, { retain: true, cache: true }); assets.acquire('cache');
  const c = new SceneOwnership(new Scene(), user, assets); c.retainContainer({ map: cached }); user.dispose();
  expect(cachedDispose).not.toHaveBeenCalled(); expect(assets.evictCached('cache')).toBe(false);
  assets.release('cache'); expect(assets.evictCached('cache')).toBe(true); expect(cachedDispose).toHaveBeenCalledOnce();
});

it('keeps distinct native render targets without UUIDs independent across two consumer lifetimes', () => {
  const assets = new AssetService(), first = new Scope('first'), second = new Scope('second');
  const targets = [new WebGLRenderTarget(8, 8), new WebGLRenderTarget(16, 16)], dispose = targets.map(target => vi.spyOn(target, 'dispose'));
  const a = new SceneOwnership(new Scene(), first, assets), b = new SceneOwnership(new Scene(), second, assets);
  expect(() => { a.retainContainer({ targets }); a.retainContainer({ targets }); b.retainContainer({ targets }); }).not.toThrow();
  for (const target of targets) expect(assets.acquiredResources()).toContain(target);
  const entries = assets.retained(); expect(new Set(entries.map(entry => entry.key)).size).toBe(entries.length);
  first.dispose(); for (const freed of dispose) expect(freed).not.toHaveBeenCalled();
  second.dispose(); for (const freed of dispose) expect(freed).toHaveBeenCalledOnce();
  expect(assets.retained()).toEqual([]);
});


it('walks shared containers once per capture and discovers their changed late resources on the next capture', () => {
  const page = new Scope('shared capture'), assets = new AssetService(), root = new Group();
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), early = new Texture(), late = new Texture();
  let reads = 0, texture = early;
  Object.defineProperty(material, 'fixtureUniforms', { enumerable: true, get: () => { reads++; return { value: texture }; } });
  for (let copy = 0; copy < 512; copy++) root.add(new Mesh(geometry, material));
  expect(sceneResources(root)).toEqual(new Set([geometry, material, early])); expect(reads).toBe(1);
  texture = late;
  expect(sceneResources(root)).toEqual(new Set([geometry, material, late])); expect(reads).toBe(2);
  const foreign = page.child('foreign'), subtree = new Group(), foreignMaterial = new MeshBasicMaterial();
  subtree.add(new Mesh(new BoxGeometry(), foreignMaterial)); root.add(subtree); ownSceneTree(subtree, foreign, assets);
  expect(sceneResources(root)).toEqual(new Set([geometry, material, late]));
  const geometryDispose = vi.spyOn(geometry, 'dispose'), materialDispose = vi.spyOn(material, 'dispose'), lateDispose = vi.spyOn(late, 'dispose');
  ownSceneTree(root, page, assets); page.dispose();
  expect(geometryDispose).toHaveBeenCalledOnce(); expect(materialDispose).toHaveBeenCalledOnce(); expect(lateDispose).toHaveBeenCalledOnce();
  early.dispose();
});


it('finds nested delegated owners in one tree walk, preserving parent-first resource ownership', () => {
  const page = new Scope('page'), outer = page.child('outer'), inner = page.child('inner'), assets = new AssetService();
  const scene = new Scene(), root = new Group(), nested = new Group(), shared = new Texture();
  const material = new MeshBasicMaterial({ map: shared }), geometry = new BoxGeometry();
  const freed = vi.spyOn(shared, 'dispose'); scene.add(root);
  let parent = root, reads = 0;
  for (let depth = 0; depth < 32; depth++) {
    const group = new Group(), children = group.children; parent.add(group); parent = group;
    Object.defineProperty(group, 'children', { get: () => { reads++; return children; } });
  }
  parent.add(new Mesh(geometry, material), nested); nested.add(new Mesh(geometry, material));
  ownSceneTree(root, outer, assets); ownSceneTree(nested, inner, assets);
  const ownership = new SceneOwnership(scene, page, assets); reads = 0; ownership.capture();
  expect(reads).toBe(32); expect(outer.census.textures).toBe(1); expect(inner.census.textures).toBe(0);
  inner.dispose(); expect(freed).not.toHaveBeenCalled();
  const late = new Texture(), lateMaterial = new MeshBasicMaterial({ map: late }), lateFreed = vi.spyOn(late, 'dispose');
  parent.add(new Mesh(new BoxGeometry(), lateMaterial)); outer.dispose();
  expect(freed).toHaveBeenCalledOnce(); expect(lateFreed).toHaveBeenCalledOnce();
  page.dispose(); expect(Object.values(page.census).every(count => count === 0)).toBe(true);
});

it('captures a delegated sibling only at its own final cleanup during shared parent teardown', () => {
  const page = new Scope('page'), inner = page.child('world'), outer = page.child('view'), assets = new AssetService();
  const scene = new Scene(), root = new Group(), nested = new Group(); scene.add(root); root.add(nested);
  ownSceneTree(root, outer, assets); ownSceneTree(nested, inner, assets);
  const geometry = new BoxGeometry(), material = new MeshBasicMaterial(), early = new Texture(), late = new Texture();
  let reads = 0, texture = early;
  Object.defineProperty(material, 'fixtureUniforms', { enumerable: true, get: () => { reads++; return { value: texture }; } });
  nested.add(new Mesh(geometry, material));
  const ownership = new SceneOwnership(scene, page, assets); ownership.capture();
  const earlyFree = vi.spyOn(early, 'dispose'), lateFree = vi.spyOn(late, 'dispose');
  reads = 0; texture = late; page.dispose();
  expect(reads).toBe(1); expect(earlyFree).toHaveBeenCalledOnce(); expect(lateFree).toHaveBeenCalledOnce();
  expect(scene.children).toEqual([]); expect(Object.values(page.census).every(count => count === 0)).toBe(true);
});

it('still captures late resources for an independent delegated sibling that outlives the outer root', () => {
  const page = new Scope('page'), inner = page.child('world'), outer = page.child('view'), assets = new AssetService();
  const root = new Group(), nested = new Group(); root.add(nested);
  ownSceneTree(root, outer, assets); ownSceneTree(nested, inner, assets);
  const late = new Texture(), material = new MeshBasicMaterial({ map: late }); nested.add(new Mesh(new BoxGeometry(), material));
  const freed = vi.spyOn(late, 'dispose');
  outer.dispose(); expect(inner.census.textures).toBe(1); expect(freed).not.toHaveBeenCalled();
  inner.dispose(); expect(freed).toHaveBeenCalledOnce(); page.dispose();
});

it('does not re-adopt shared resources from an already closed sibling in the same parent teardown', () => {
  const page = new Scope('page'), inner = page.child('world'), outer = page.child('view'), assets = new AssetService();
  const root = new Group(), nested = new Group(), texture = new Texture(), material = new MeshBasicMaterial({ map: texture });
  const geometry = new BoxGeometry(); root.add(new Mesh(geometry, material), nested); nested.add(new Mesh(geometry, material));
  ownSceneTree(root, outer, assets); ownSceneTree(nested, inner, assets);
  const freed = [texture, material, geometry].map(resource => vi.spyOn(resource, 'dispose'));
  // Deliberately no prior capture: both owners discover the shared resources during their final cleanups.
  page.dispose(); for (const dispose of freed) expect(dispose).toHaveBeenCalledOnce();
  expect(Object.values(page.census).every(count => count === 0)).toBe(true);
});
