import { expect, test, vi } from 'vitest';
import { BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshDepthMaterial, PerspectiveCamera, Scene } from 'three';
import { Scope } from '../src/engine/app/scope';
import { AssetService } from '../src/engine/app/assets';
import { ownSceneTree, sceneResourceOwner } from '../src/engine/app/sceneOwnership';
import { UploadOwnership } from '../src/engine/render/uploadOwnership';
import { installShadowMaterialOwnership } from '../src/engine/render/shadowMaterialOwnership';
import type { Renderer } from '../src/engine/render/renderer';

test('retiring a resident releases native shadow leases but never owns the shared depth cache', () => {
  const page = new Scope('renderer'), resident = new Scope('resident'), assets = new AssetService();
  const root = new Group(), geometry = new BufferGeometry(), mesh = new Mesh(geometry, new MeshBasicMaterial());
  root.add(mesh); ownSceneTree(root, resident, assets);
  const depth = new MeshDepthMaterial(), temporary = new MeshDepthMaterial(), camera = new PerspectiveCamera(), scene = new Scene();
  const dispose = vi.spyOn(depth, 'dispose');
  const renderer = {
    properties: { has: () => false, get: (object: unknown) => object, remove: () => undefined, update: () => undefined, dispose: () => undefined },
    renderBufferDirect: vi.fn<Renderer['renderBufferDirect']>(),
    shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>(() => { renderer.renderBufferDirect(camera, scene, geometry, depth, mesh, null); }) },
  };
  new UploadOwnership(page, assets).attach(renderer);
  installShadowMaterialOwnership(renderer, assets, page);
  // Ordinary offscreen depth jobs remain resident-owned and are safe to dispose after compilation.
  renderer.renderBufferDirect(camera, scene, geometry, temporary, mesh, null);
  expect(assets.has(`renderer:shadow:${temporary.uuid}`)).toBe(false);
  expect(sceneResourceOwner(temporary)).toBe(resident);
  expect(() => temporary.dispose()).not.toThrow();
  renderer.shadowMap.render([], scene, camera);
  renderer.shadowMap.render([], scene, camera);
  expect(assets.retained()).toEqual([{ key: `renderer:shadow:${depth.uuid}`, refs: 1, retained: true }]);
  expect(sceneResourceOwner(depth)).toBeNull();
  expect(() => resident.dispose()).not.toThrow();
  expect(dispose).not.toHaveBeenCalled();
  expect(assets.retained()[0]?.refs).toBe(0);
  expect(() => depth.dispose()).not.toThrow();
  expect(assets.retained()).toEqual([]);
  page.dispose();
});
