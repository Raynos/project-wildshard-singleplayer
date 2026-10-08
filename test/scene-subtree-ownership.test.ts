import { expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Group, Mesh, MeshBasicMaterial, Scene } from 'three';
import { AssetService } from '../src/engine/app/assets';
import { Scope } from '../src/engine/app/scope';
import { ownSceneTree, SceneOwnership } from '../src/engine/app/sceneOwnership';

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
