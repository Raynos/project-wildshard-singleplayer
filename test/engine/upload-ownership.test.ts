// @vitest-environment happy-dom
import { expect, it, vi } from 'vitest';
import { BatchedMesh, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshDepthMaterial, Scene, Texture, DataTexture, PerspectiveCamera, WebGLRenderTarget, type Object3D, type WebGLRenderer } from 'three';
import { app } from '../../src/engine/app/runtime';
import { AssetService } from '../../src/engine/app/assets';
import { SceneOwnership, linkStandIn, ownSceneTree, ownSceneResource, sceneResourceOwner } from '../../src/engine/app/sceneOwnership';
import { Scope } from '../../src/engine/app/scope';
import { enterOwner } from '../../src/engine/app/ownership';
import { legacyDouble } from '../fake/FakeGame';
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


it('retires detached uniform uploads with each drawn resident, keeping shared acquisitions and batch-private ownership', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const scene = new Scene(), camera = new PerspectiveCamera(), shared = new Texture();
  assets.register('shared', shared); assets.acquire('shared');
  const sharedDispose = vi.spyOn(shared, 'dispose');
  let samplers: readonly Texture[] = [], target: WebGLRenderTarget | null = null;
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => { for (const sampler of samplers) renderer.properties.get(sampler); if (target !== null) renderer.properties.get(target); },
  });
  uploads.attach(renderer);
  for (let visit = 0; visit < 3; visit++) {
    const resident = page.child(`resident:${visit}`), root = new Group(); scene.add(root); ownSceneTree(root, resident, assets);
    const material = new MeshBasicMaterial(), batch = new BatchedMesh(1, 24, 36, material), source = new BoxGeometry();
    batch.addInstance(batch.addGeometry(source)); source.dispose(); root.add(batch);
    const detached = new Texture(); target = new WebGLRenderTarget(16, 16); samplers = [detached, shared];
    const detachedDispose = vi.spyOn(detached, 'dispose'), targetDispose = vi.spyOn(target, 'dispose');
    const batchDispose = vi.spyOn(batch, 'dispose'), geometryDispose = vi.spyOn(batch.geometry, 'dispose');
    // Async setup may allocate a texture before its scene exists; drawing must adopt that already observed upload.
    renderer.properties.get(detached);
    renderer.renderBufferDirect(camera, scene, batch.geometry, material, batch, { start: 0, count: 36, materialIndex: 0 });
    renderer.properties.get(batch.geometry);
    expect(uploads.resources().has(detached)).toBe(true);
    expect(resident.census).toMatchObject({ textures: 1, renderTargets: 1, resources: 1, geometries: 0 });
    resident.dispose();
    expect(detachedDispose).toHaveBeenCalledOnce(); expect(targetDispose).toHaveBeenCalledOnce();
    expect(batchDispose).toHaveBeenCalledOnce(); expect(geometryDispose).toHaveBeenCalledOnce();
    expect(sharedDispose).not.toHaveBeenCalled();
    expect(uploads.resources()).toEqual(new Set([shared]));
    expect(scene.children).toEqual([]);
  }
  page.dispose(); expect(sharedDispose).not.toHaveBeenCalled();
  assets.release('shared'); expect(sharedDispose).toHaveBeenCalledOnce(); expect(uploads.resources().size).toBe(0);
});

it('adopts a reused CPU-backed sampler again after its prior scene owner has retired', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const scene = new Scene(), camera = new PerspectiveCamera(), map = new DataTexture(new Uint8Array(4), 1, 1);
  const disposed = vi.spyOn(map, 'dispose');
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => { renderer.properties.get(map); },
  });
  uploads.attach(renderer);
  for (let visit = 0; visit < 3; visit++) {
    const resident = page.child(`resident:${visit}`), root = new Group(); scene.add(root); ownSceneTree(root, resident, assets);
    const material = new MeshBasicMaterial(), batch = new BatchedMesh(1, 24, 36, material), geometry = new BoxGeometry();
    batch.addInstance(batch.addGeometry(geometry)); geometry.dispose(); root.add(batch);
    renderer.renderBufferDirect(camera, scene, batch.geometry, material, batch, { start: 0, count: 36, materialIndex: 0 });
    expect(resident.census.textures).toBe(1);
    resident.dispose(); expect(disposed).toHaveBeenCalledTimes(visit + 1); expect(uploads.resources().size).toBe(0);
  }
  page.dispose(); expect(disposed).toHaveBeenCalledTimes(3);
});

it('retires a late upload after its prior owner has ended, without a delegated draw owner', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const resident = page.child('resident'), map = new DataTexture(new Uint16Array(512), 16, 16);
  const disposed = vi.spyOn(map, 'dispose');
  ownSceneResource(map, resident); uploads.observe(map);
  resident.dispose();
  expect(disposed).toHaveBeenCalledOnce(); expect(uploads.resources().size).toBe(0);
  // The renderer can encounter a lazy CPU-backed uniform again after the resident has left.
  // Observing it must establish a live owner before a new native upload, without another premature disposal.
  uploads.observe(map);
  expect(sceneResourceOwner(map)).toBe(page); expect(page.census.textures).toBe(1);
  expect(disposed).toHaveBeenCalledOnce(); expect(uploads.resources().has(map)).toBe(true);
  page.dispose();
  expect(disposed).toHaveBeenCalledTimes(2); expect(uploads.resources().size).toBe(0);
  expect(Object.values(page.census).every(n => n === 0)).toBe(true);
});

it('SF57: a retiring owner\'s dispose-time lookup (three\'s deallocateMaterial) never hands the resource to the page', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
  });
  uploads.attach(renderer);
  for (let visit = 0; visit < 3; visit++) {
    const resident = page.child(`resident:${visit}`), material = new MeshBasicMaterial();
    ownSceneResource(material, resident);
    // the renderer's own dispose handler reads the material's properties while the resident tears it down
    const onDispose = (): void => { material.removeEventListener('dispose', onDispose); renderer.properties.get(material); };
    material.addEventListener('dispose', onDispose);
    uploads.observe(material);
    resident.dispose();
    expect(sceneResourceOwner(material)).toBe(resident); // not adopted by the page
    expect(uploads.resources().has(material)).toBe(false);
  }
  expect(page.census.materials).toBe(0);
  page.dispose();
});

it('SF57 upload-owner: a compile attributes each stand-in\'s uploads to the owner of the mesh it stands in for', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
    compile: (scene: Object3D) => { scene.traverse((node) => { if (node instanceof Mesh) renderer.properties.get(node.material); }); return new Set(); },
  });
  uploads.attach(renderer);
  for (let visit = 0; visit < 3; visit++) {
    const resident = page.child(`resident:${visit}`), root = new Group(); ownSceneTree(root, resident, assets);
    const map = new Texture(), material = new MeshBasicMaterial({ map }), depth = new MeshDepthMaterial();
    const mesh = new Mesh(new BoxGeometry(), material); mesh.customDepthMaterial = depth; root.add(mesh);
    const materialDispose = vi.spyOn(material, 'dispose'), mapDispose = vi.spyOn(map, 'dispose'), depthDispose = vi.spyOn(depth, 'dispose');
    // the warm-up compiles detached clones: one with the mesh's material, one with its custom depth material
    const job = new Group(), lit = mesh.clone(false), shadow = new Mesh(mesh.geometry, depth);
    linkStandIn(lit, mesh); linkStandIn(shadow, mesh); job.add(lit, shadow);
    renderer.compile(job, new PerspectiveCamera());
    expect(sceneResourceOwner(map)).toBe(null); // a sampler is only attributed by its own upload (the warm-up's texture pass)
    renderer.properties.get(map);
    // the mesh then leaves the resident's tree before it ever draws (a pooled creature): only the upload-time owner remains
    root.remove(mesh);
    expect(sceneResourceOwner(material)).toBe(resident); expect(sceneResourceOwner(map)).toBe(resident); expect(sceneResourceOwner(depth)).toBe(resident);
    resident.dispose();
    expect(materialDispose).toHaveBeenCalledOnce(); expect(mapDispose).toHaveBeenCalledOnce(); expect(depthDispose).toHaveBeenCalledOnce();
    expect(uploads.resources().size).toBe(0);
  }
  page.dispose();
});

it('SF57 upload-owner: an upload with no owner is held weakly, adopted by a later owned draw, and freed by the level otherwise', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const scene = new Scene(), camera = new PerspectiveCamera(), resident = page.child('resident'), root = new Group();
  scene.add(root); ownSceneTree(root, resident, assets);
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
  });
  uploads.attach(renderer);
  const drawn = new MeshBasicMaterial(), global = new MeshBasicMaterial(), mesh = new Mesh(new BoxGeometry(), drawn); root.add(mesh);
  const drawnDispose = vi.spyOn(drawn, 'dispose'), globalDispose = vi.spyOn(global, 'dispose');
  renderer.properties.get(drawn); renderer.properties.get(global); // uploaded before any draw: no owner yet
  expect(uploads.orphanCensus().live).toBe(2); expect(uploads.has(drawn)).toBe(true);
  renderer.renderBufferDirect(camera, scene, mesh.geometry, drawn, mesh, { start: 0, count: 36, materialIndex: 0 });
  expect(sceneResourceOwner(drawn)).toBe(resident); expect(uploads.orphanCensus().live).toBe(1);
  resident.dispose(); expect(drawnDispose).toHaveBeenCalledOnce(); expect(uploads.has(drawn)).toBe(false);
  expect(globalDispose).not.toHaveBeenCalled(); expect(uploads.has(global)).toBe(true);
  page.dispose(); expect(globalDispose).toHaveBeenCalledOnce(); expect(uploads.resources().size).toBe(0);
  expect(uploads.orphanCensus()).toEqual({ live: 0, collected: 0 });
});

it('SF57 upload-owner: three\'s dispose-time lookup of an explicitly disposed upload never puts it back in the live set', () => {
  const page = new Scope('page'), assets = new AssetService(), uploads = new UploadOwnership(page, assets);
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
  });
  uploads.attach(renderer);
  const resident = page.child('resident'), owned = new Texture(), orphan = new MeshBasicMaterial();
  ownSceneResource(owned, resident);
  for (const resource of [owned, orphan]) {
    renderer.properties.get(resource);
    // the renderer's own listener, registered after ours at upload, reads the properties while deallocating
    const onDispose = (): void => { resource.removeEventListener('dispose', onDispose); renderer.properties.get(resource); };
    resource.addEventListener('dispose', onDispose);
  }
  expect(uploads.has(owned)).toBe(true); expect(uploads.has(orphan)).toBe(true);
  owned.dispose(); orphan.dispose(); // disposed by their code while the owner lives on
  expect(uploads.has(owned)).toBe(false); expect(uploads.has(orphan)).toBe(false); expect(uploads.resources().size).toBe(0);
  resident.dispose(); page.dispose();
});
