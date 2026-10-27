import { expect, test, vi } from 'vitest';
import { BufferGeometry, DataTexture, DoubleSide, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, SkinnedMesh } from 'three';
import { Scope } from '../app/scope';
import { AssetService } from '../app/assets';
import { ownSceneTree, sceneResourceOwner } from '../app/sceneOwnership';
import { UploadOwnership } from './uploadOwnership';
import { installShadowMaterialOwnership } from './shadowMaterialOwnership';
import { guardObjectDraw } from './drawGuards';
import type { Renderer } from './renderer';

test('retiring a resident releases native shadow leases but never owns the shared depth cache', () => {
  const page = new Scope('renderer'), resident = new Scope('resident'), assets = new AssetService();
  const root = new Group(), geometry = new BufferGeometry(), mesh = new Mesh(geometry, new MeshBasicMaterial());
  root.add(mesh); ownSceneTree(root, resident, assets);
  const depth = new MeshDepthMaterial(), temporary = new MeshDepthMaterial(), camera = new PerspectiveCamera(), scene = new Scene();
  const dispose = vi.spyOn(depth, 'dispose');
  const renderer = {
    properties: { has: () => false, get: (object: unknown) => object, remove: () => undefined, update: () => undefined, dispose: () => undefined },
    renderBufferDirect: vi.fn<Renderer['renderBufferDirect']>(),
    shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>(() => { renderer.renderBufferDirect(camera, scene, geometry, depth, mesh, { start: 0, count: 0, materialIndex: 0 }); }) },
  };
  new UploadOwnership(page, assets).attach(renderer);
  installShadowMaterialOwnership(renderer, assets, page);
  // Ordinary offscreen depth jobs remain resident-owned and are safe to dispose after compilation.
  renderer.renderBufferDirect(camera, scene, geometry, temporary, mesh, { start: 0, count: 0, materialIndex: 0 });
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


test('the existing submission port refuses guarded draws and releases each guard with its scope', () => {
  const page = new Scope('renderer'), first = new Scope('first'), second = new Scope('second'), assets = new AssetService();
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial(), mesh = new Mesh(geometry, material), camera = new PerspectiveCamera(), scene = new Scene();
  const submit = vi.fn<Renderer['renderBufferDirect']>();
  const renderer = { renderBufferDirect: submit, shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>() } };
  installShadowMaterialOwnership(renderer, assets, page);
  const deny = vi.fn(() => false), allow = vi.fn(() => true);
  guardObjectDraw(mesh, deny, first); guardObjectDraw(mesh, allow, second);
  const draw = (): void => { renderer.renderBufferDirect(camera, scene, geometry, material, mesh, { start: 0, count: 0, materialIndex: 0 }); };
  try {
    draw(); expect(deny).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled();
    first.dispose(); draw(); expect(deny).toHaveBeenCalledOnce(); expect(allow).toHaveBeenCalledOnce(); expect(submit).toHaveBeenCalledOnce();
    second.dispose(); draw(); expect(allow).toHaveBeenCalledOnce(); expect(submit).toHaveBeenCalledTimes(2);
  } finally { first.dispose(); second.dispose(); page.dispose(); geometry.dispose(); material.dispose(); }
});

test('a native depth variant three disposes with its source while a resident leases it leaves at the lease\'s release', () => {
  const page = new Scope('renderer'), resident = new Scope('resident'), assets = new AssetService();
  const root = new Group(), geometry = new BufferGeometry(), mesh = new Mesh(geometry, new MeshBasicMaterial());
  root.add(mesh); ownSceneTree(root, resident, assets);
  const variant = new MeshDepthMaterial(), camera = new PerspectiveCamera(), scene = new Scene();
  const renderer = {
    properties: { has: () => false, get: (object: unknown) => object, remove: () => undefined, update: () => undefined, dispose: () => undefined },
    renderBufferDirect: vi.fn<Renderer['renderBufferDirect']>(),
    shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>(() => { renderer.renderBufferDirect(camera, scene, geometry, variant, mesh, { start: 0, count: 0, materialIndex: 0 }); }) },
  };
  new UploadOwnership(page, assets).attach(renderer);
  installShadowMaterialOwnership(renderer, assets, page);
  renderer.shadowMap.render([], scene, camera);
  expect(assets.retained()).toEqual([{ key: `renderer:shadow:${variant.uuid}`, refs: 1, retained: true }]);
  // the resident's materials step disposes the source; three's shadow map disposes the variant with it, before the
  // resident's own leases release (G782 warm Pine crossing: 'Disposed asset still acquired: renderer:shadow:…')
  expect(() => variant.dispose()).not.toThrow();
  expect(assets.retained()).toEqual([{ key: `renderer:shadow:${variant.uuid}`, refs: 1, retained: true }]);
  expect(() => resident.dispose()).not.toThrow();
  expect(assets.retained()).toEqual([]);
  // an ordinary asset still refuses a native disposal while it is acquired
  const plain = new MeshBasicMaterial();
  assets.register('plain', plain); assets.acquire('plain');
  expect(() => { assets.forgetDisposed('plain'); }).toThrow('Disposed asset still acquired: plain');
  page.dispose();
});

test('instanced casters get a depth material per kind and depth facts; plain and variant casters keep three\'s', () => {
  const page = new Scope('renderer'), assets = new AssetService(), camera = new PerspectiveCamera(), scene = new Scene();
  const stock = new MeshDepthMaterial(), geometry = new BufferGeometry(), filler = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  let pass: () => void = () => undefined;
  const renderer = { renderBufferDirect: vi.fn<Renderer['renderBufferDirect']>(), shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>(() => { pass(); }) } };
  installShadowMaterialOwnership(renderer, assets, page);
  // one shadow draw of `object` with the stock depth material, its map copied on first as three's getDepthMaterial does
  const shadowDraw = (object: Mesh): void => {
    pass = () => {
      stock.map = object.material instanceof MeshStandardMaterial ? object.material.map : null;
      renderer.renderBufferDirect(camera, scene, geometry, stock, object, { start: 0, count: 0, materialIndex: 0 });
    };
    renderer.shadowMap.render([], scene, camera);
  };
  const pbr = new MeshStandardMaterial({ map: filler }), plain = new Mesh(geometry, pbr), instanced = new InstancedMesh(geometry, pbr, 2);
  const cutout = new InstancedMesh(geometry, new MeshStandardMaterial({ map: filler, alphaTest: 0.5 }), 2);
  const bare = new InstancedMesh(geometry, new MeshStandardMaterial(), 2);
  for (const object of [plain, instanced, cutout, bare]) shadowDraw(object);
  expect(plain.customDepthMaterial).toBeUndefined(); // a plain caster keeps the stock material
  expect(cutout.customDepthMaterial).toBeUndefined(); // three gives it a variant of its own
  expect(instanced.customDepthMaterial).toBeInstanceOf(MeshDepthMaterial); // the white filler map no longer skips it
  expect(bare.customDepthMaterial).toBeInstanceOf(MeshDepthMaterial);
  expect(bare.customDepthMaterial).not.toBe(instanced.customDepthMaterial); // map presence keys a kind of its own
  const twin = new InstancedMesh(geometry, new MeshStandardMaterial({ map: filler }), 3); shadowDraw(twin);
  expect(twin.customDepthMaterial).toBe(instanced.customDepthMaterial);
  expect(assets.has('renderer:shadow-kind:instanced|map+side0')).toBe(true);
  page.dispose(); filler.dispose();
});

test('a multi-material skinned caster takes a kind only when its materials share their depth facts', () => {
  const page = new Scope('renderer'), assets = new AssetService(), camera = new PerspectiveCamera(), scene = new Scene();
  const stock = new MeshDepthMaterial(), geometry = new BufferGeometry();
  let pass: () => void = () => undefined;
  const renderer = { renderBufferDirect: vi.fn<Renderer['renderBufferDirect']>(), shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>(() => { pass(); }) } };
  installShadowMaterialOwnership(renderer, assets, page);
  const shadowDraw = (object: Mesh): void => {
    pass = () => { renderer.renderBufferDirect(camera, scene, geometry, stock, object, { start: 0, count: 0, materialIndex: 0 }); };
    renderer.shadowMap.render([], scene, camera);
  };
  const alike = new SkinnedMesh(geometry, [new MeshStandardMaterial(), new MeshStandardMaterial()]);
  const mixed = new SkinnedMesh(geometry, [new MeshStandardMaterial(), new MeshStandardMaterial({ side: DoubleSide })]);
  shadowDraw(alike); shadowDraw(mixed);
  expect(alike.customDepthMaterial).toBeInstanceOf(MeshDepthMaterial);
  expect(mixed.customDepthMaterial).toBeUndefined();
  page.dispose();
});

test('a main-pass instanced draw of a classic material wears its twin; plain, shadow and node draws keep theirs', () => {
  const page = new Scope('renderer'), assets = new AssetService(), camera = new PerspectiveCamera(), scene = new Scene(), geometry = new BufferGeometry();
  const submit = vi.fn<Renderer['renderBufferDirect']>();
  let pass: () => void = () => undefined;
  const renderer = { renderBufferDirect: submit, shadowMap: { render: vi.fn<Renderer['shadowMap']['render']>(() => { pass(); }) } };
  installShadowMaterialOwnership(renderer, assets, page);
  const shared = new MeshStandardMaterial(), node = new MeshStandardMaterial(); Reflect.set(node, 'isNodeMaterial', true);
  const instanced = new InstancedMesh(geometry, shared, 2), plain = new Mesh(geometry, shared), graph = new InstancedMesh(geometry, node, 2);
  const group = { start: 0, count: 0, materialIndex: 0 };
  renderer.renderBufferDirect(camera, scene, geometry, shared, instanced, group);
  renderer.renderBufferDirect(camera, scene, geometry, shared, plain, group);
  renderer.renderBufferDirect(camera, scene, geometry, node, graph, group);
  const drawn = submit.mock.calls.map(call => call[3]);
  expect(drawn[0]).not.toBe(shared); expect(Object.getPrototypeOf(drawn[0])).toBe(shared);
  expect(drawn[1]).toBe(shared); expect(drawn[2]).toBe(node);
  const depth = new MeshDepthMaterial();
  pass = () => { renderer.renderBufferDirect(camera, scene, geometry, depth, instanced, group); };
  renderer.shadowMap.render([], scene, camera);
  expect(submit.mock.calls.at(-1)?.[3]).toBe(depth); // the shadow pass draws the depth material it is given
  page.dispose();
});
