// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Group, MeshBasicMaterial, Scene, Texture } from 'three';
import { app } from '../../src/engine/app/runtime';
import { AssetService } from '../../src/engine/app/assets';
import { SceneOwnership, ownSceneTree } from '../../src/engine/app/sceneOwnership';
import { Scope } from '../../src/engine/app/scope';
import { enterOwner } from '../../src/engine/app/ownership';
import { UploadOwnership } from '../../src/engine/render/uploadOwnership';

it('frees uploaded orphan resources while preserving named acquisitions and already-disposed resources', () => {
  const scope = new Scope('test'); enterOwner(scope);
  const uploads = new UploadOwnership(scope, app.assets);
  const orphan = new BoxGeometry(), shared = new Texture(), gone = new MeshBasicMaterial();
  const orphanDispose = vi.fn<() => void>(), sharedDispose = vi.fn<() => void>(), goneDispose = vi.fn<() => void>();
  // These stand in for the renderer registrations: disposal removes the live GPU allocation listener.
  const uploaded = (resource: BoxGeometry | MeshBasicMaterial | Texture, dispose: () => void): void => {
    const onDispose = (): void => { dispose(); resource.removeEventListener('dispose', onDispose); };
    resource.addEventListener('dispose', onDispose); uploads.observe(resource);
  };
  uploaded(orphan, orphanDispose); uploaded(shared, sharedDispose); uploaded(gone, goneDispose);
  gone.dispose();
  app.assets.register(`test:upload:${shared.uuid}`, shared, { retain: true });
  scope.dispose(); enterOwner(null);
  expect(orphanDispose).toHaveBeenCalledOnce(); expect(goneDispose).toHaveBeenCalledOnce(); expect(sharedDispose).not.toHaveBeenCalled();
  expect(Object.values(scope.census).every((n) => n === 0)).toBe(true);
});


it('keeps delegated uploaded batches in the actual owner census until one real disposal event', () => {
  const page = new Scope('page'), owner = page.child('resident'), assets = new AssetService();
  const scene = new Scene(), root = new Group(); scene.add(root); ownSceneTree(root, owner, assets);
  const batch = new BatchedMesh(1, 24, 36, new MeshBasicMaterial()), source = new BoxGeometry();
  batch.addInstance(batch.addGeometry(source)); source.dispose(); root.add(batch);
  const dispose = vi.spyOn(batch, 'dispose'), geometryDispose = vi.spyOn(batch.geometry, 'dispose');
  const uploads = new UploadOwnership(page, assets);
  // Observe after the resident parent was registered: these fallback callbacks run before its disposal (LIFO).
  uploads.observe(batch); uploads.observe(batch.geometry); uploads.observe(batch.material);
  const scenes = new SceneOwnership(scene, page, assets); scenes.capture();
  expect(uploads.resources().has(batch)).toBe(true); expect(owner.census.resources).toBe(1);
  expect(() => { page.dispose(); }).not.toThrow();
  expect(dispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
  expect(uploads.resources().size).toBe(0); expect(scene.children).toEqual([]);
});
