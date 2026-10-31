import { expect, test, vi } from 'vitest';
import { BufferGeometry, Camera, CompressedTexture, Mesh, MeshBasicMaterial, MeshDepthMaterial, Scene, Texture } from 'three';
import type { Renderer } from './renderer';
import { drawHooks, invalidatePropertyObservation, propertyHooks } from './drawHooks';
import { installFrameCounter } from './frameCounter';

function fixture(material: MeshBasicMaterial | MeshDepthMaterial = new MeshBasicMaterial()) {
  const geometry = new BufferGeometry(), object = new Mesh(geometry, material);
  const camera = new Camera(), scene = new Scene(), group = { start: 0, count: 3, materialIndex: 0 };
  const stock = vi.fn<Renderer['renderBufferDirect']>();
  const renderer = { renderBufferDirect: stock };
  return { renderer, stock, geometry, material, object, camera, scene, group,
    draw: () => { renderer.renderBufferDirect(camera, scene, geometry, material, object, group); } };
}

test('late registration keeps one renderer hook and shadow state encloses every observer', () => {
  const f = fixture(new MeshDepthMaterial()), hooks = drawHooks(f.renderer), installed = f.renderer.renderBufferDirect;
  const depth = new MeshDepthMaterial(), events: string[] = [];
  let shadow = false;
  hooks.shadow = (draw, camera, scene, geometry, _material, object, group) => {
    shadow = true;
    try { draw(camera, scene, geometry, depth, object, group); } finally { shadow = false; }
  };
  hooks.retire = complete => { expect(complete).toBe(true); events.push('retire'); };
  hooks.material = (_camera, _scene, _geometry, material) => { expect(material).toBe(depth); events.push('admit'); return material; };
  hooks.ownership = { begin: (_camera, _scene, _geometry, material) => { expect(material).toBe(depth); events.push('owner'); }, end: () => { events.push('release'); } };
  hooks.memory = () => { expect(shadow).toBe(true); events.push('memory'); };
  expect(drawHooks(f.renderer)).toBe(hooks); expect(f.renderer.renderBufferDirect).toBe(installed);
  f.draw(); expect(f.stock).toHaveBeenCalledExactlyOnceWith(f.camera, f.scene, f.geometry, depth, f.object, f.group);
  expect(events).toEqual(['admit', 'owner', 'release', 'retire', 'memory']);
  expect(shadow).toBe(false);
});

test('failed submission restores ownership, refuses retirement and never queues memory release', () => {
  const f = fixture(), hooks = drawHooks(f.renderer);
  const leave = vi.fn<() => void>(), memory = vi.fn<Renderer['renderBufferDirect']>(), retire = vi.fn<(complete: boolean) => void>();
  hooks.ownership = { begin: () => { hooks.retire = retire; }, end: leave }; hooks.memory = memory;
  f.stock.mockImplementationOnce(() => { throw new Error('native draw failed'); });
  expect(f.draw).toThrow('native draw failed');
  expect(leave).toHaveBeenCalledOnce(); expect(retire).toHaveBeenCalledWith(false); expect(memory).not.toHaveBeenCalled();
  f.draw(); expect(leave).toHaveBeenCalledTimes(2); expect(retire).toHaveBeenLastCalledWith(true); expect(memory).toHaveBeenCalledOnce();
});

test('ordinary draws bypass shadow dispatch and nested casts retain their own substitution', () => {
  const ordinary = fixture(), ordinaryHooks = drawHooks(ordinary.renderer), ignored = vi.fn<NonNullable<typeof ordinaryHooks.shadow>>();
  ordinaryHooks.shadow = ignored; ordinary.draw(); expect(ignored).not.toHaveBeenCalled();
  const f = fixture(new MeshDepthMaterial()), hooks = drawHooks(f.renderer), replacement = new MeshDepthMaterial();
  let calls = 0, nested = false, active = 0;
  hooks.shadow = (draw, camera, scene, geometry, _material, object, group) => {
    calls++; active++;
    try { draw(camera, scene, geometry, replacement, object, group); } finally { active--; }
  };
  f.stock.mockImplementation((_camera, _scene, _geometry, material) => {
    expect(material).toBe(replacement); expect(active).toBeGreaterThan(0);
    if (!nested) { nested = true; f.draw(); }
  });
  f.draw(); expect(calls).toBe(2); expect(active).toBe(0); expect(hooks.depth).toBe(0);
});

test('an ownership failure unwinds its entered state and admission refusal never enters it', () => {
  const f = fixture(), hooks = drawHooks(f.renderer), leave = vi.fn<() => void>();
  hooks.ownership = { begin: () => { throw new Error('owner failed'); }, end: leave };
  expect(f.draw).toThrow('owner failed'); expect(leave).toHaveBeenCalledOnce(); expect(f.stock).not.toHaveBeenCalled();
  hooks.material = () => null; f.draw(); expect(leave).toHaveBeenCalledOnce(); expect(f.stock).not.toHaveBeenCalled();
});

test('property observers share one native lookup and diagnostics receive its exact identity', () => {
  const resource = new Texture(), native = {}, proxy = {}, get = vi.fn((_resource: unknown) => native);
  const renderer = { properties: { get } }, hooks = propertyHooks(renderer), installed = renderer.properties.get;
  const ownership = vi.fn<(resource: unknown) => void>(), texture = vi.fn<(resource: Texture) => void>(); hooks.ownership = ownership; hooks.texture = texture;
  hooks.labels = (observed, properties) => { expect(observed).toBe(resource); expect(properties).toBe(native); return proxy; };
  expect(propertyHooks(renderer)).toBe(hooks); expect(renderer.properties.get).toBe(installed);
  expect(renderer.properties.get(resource)).toBe(proxy); expect(get).toHaveBeenCalledExactlyOnceWith(resource);
  expect(ownership).toHaveBeenCalledExactlyOnceWith(resource); expect(texture).toHaveBeenCalledExactlyOnceWith(resource);
});

test('classification preserves changed native rows, compressed observers and frozen inputs', () => {
  const resource = new CompressedTexture([], 1, 1), frozen = Object.freeze({}), initial = {}, replacement = {};
  let current = initial;
  const renderer = { properties: { get: (_resource: unknown) => current } }, hooks = propertyHooks(renderer);
  const before = vi.fn<(resource: CompressedTexture) => void>(), after = vi.fn<(resource: CompressedTexture, properties: unknown) => void>();
  hooks.compressed = { before, after };
  expect(renderer.properties.get(resource)).toBe(initial); expect(after).toHaveBeenLastCalledWith(resource, initial);
  current = replacement;
  expect(renderer.properties.get(resource)).toBe(replacement); expect(after).toHaveBeenLastCalledWith(resource, replacement);
  expect(renderer.properties.get(frozen)).toBe(replacement); expect(renderer.properties.get(frozen)).toBe(replacement);
  expect(before).toHaveBeenCalledTimes(2); expect(Object.getOwnPropertySymbols(frozen)).toHaveLength(0);
});

test('native rows stay live until removal and disposal, including within one draw', () => {
  const f = fixture(), resource = new Texture(); let native = { value: 1 };
  const renderer = { ...f.renderer, properties: { get: (_value: unknown) => native,
    remove: (_value: unknown) => { native = { value: 2 }; }, dispose: () => { native = { value: 3 }; } },
  render: (_scene: Scene, _camera: Camera) => { renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group); } };
  installFrameCounter(renderer); drawHooks(renderer); propertyHooks(renderer);
  f.stock.mockImplementation(() => {
    const first = renderer.properties.get(resource); first.value = 42;
    expect(renderer.properties.get(resource)).toBe(first); expect(renderer.properties.get(resource).value).toBe(42);
    renderer.properties.remove(resource); const second = renderer.properties.get(resource);
    expect(second).not.toBe(first); expect(second.value).toBe(2);
    renderer.properties.dispose(); expect(renderer.properties.get(resource).value).toBe(3);
  });
  renderer.render(f.scene, f.camera);
});

test('native material rows never consult texture label policy', () => {
  const f = fixture(), native = { version: 1 };
  const renderer = { ...f.renderer, properties: { get: (_resource: unknown) => native } };
  drawHooks(renderer); const hooks = propertyHooks(renderer);
  hooks.labels = () => { throw new Error('Nontexture label traversal'); };
  hooks.labelsVersion = () => { throw new Error('Nontexture label policy'); };
  f.stock.mockImplementation(() => {
    expect(renderer.properties.get(f.material)).toBe(native);
    native.version = 2;
    expect(renderer.properties.get(f.material).version).toBe(2);
  });
  renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group);
});

test('native metadata stays live across consumers and is renewed by native removal or disposal', () => {
  const f = fixture(), metadata = new Texture().source; let rows = new WeakMap<object, { version: number }>();
  const get = vi.fn((resource: unknown) => {
    if (typeof resource !== 'object' || resource === null) throw new Error('Expected native resource');
    let row = rows.get(resource);
    if (row === undefined) { row = { version: 1 }; rows.set(resource, row); }
    return row;
  });
  const renderer = { ...f.renderer, properties: { get,
    remove: (resource: unknown) => { if (typeof resource === 'object' && resource !== null) rows.delete(resource); }, dispose: () => { rows = new WeakMap(); } },
  render: (_scene: Scene, _camera: Camera) => { renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group); } };
  installFrameCounter(renderer); const draws = drawHooks(renderer), hooks = propertyHooks(renderer);
  hooks.ownership = () => { throw new Error('Metadata has no upload owner'); };
  hooks.labels = () => { throw new Error('Metadata has no texture label'); };
  const first = renderer.properties.get(metadata); first.version = 42;
  f.stock.mockImplementation(() => { expect(renderer.properties.get(metadata)).toBe(first); });
  renderer.render(f.scene, f.camera); draws.ownerToken = Symbol('next consumer'); invalidatePropertyObservation();
  renderer.render(f.scene, f.camera); expect(renderer.properties.get(metadata).version).toBe(42);
  expect(get).toHaveBeenCalledOnce();
  renderer.properties.remove(metadata); const second = renderer.properties.get(metadata);
  expect(second).not.toBe(first); expect(second.version).toBe(1);
  renderer.properties.dispose(); expect(renderer.properties.get(metadata)).not.toBe(second);
});

test('metadata without native invalidation methods keeps consulting the native producer', () => {
  const source = new Texture().source; let row = { version: 1 };
  const renderer = { properties: { get: (_resource: unknown) => row } };
  propertyHooks(renderer); expect(renderer.properties.get(source)).toBe(row);
  row = { version: 2 }; expect(renderer.properties.get(source)).toBe(row);
});

test('a later frame counter shares ownership observation across draws but not renders', () => {
  const f = fixture(), native = {}, get = vi.fn((_value: unknown) => native);
  let drawsPerRender = 1;
  const renderer = { ...f.renderer, properties: { get },
    render: (_scene: Scene, _camera: Camera) => {
      for (let draw = 0; draw < drawsPerRender; draw++) renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group);
    } };
  drawHooks(renderer); const hooks = propertyHooks(renderer), observe = vi.fn<(resource: unknown) => void>(); hooks.ownership = observe;
  f.stock.mockImplementation(() => {
    expect(renderer.properties.get(f.material)).toBe(native);
    expect(renderer.properties.get(f.material)).toBe(native);
  });
  // Uncounted test renderers retain the conservative per-draw observations.
  renderer.render(f.scene, f.camera); expect(observe).toHaveBeenCalledTimes(1);
  // Epoch 1 and counted render 1 coincide: adopting the new clock must
  // discard the old stamp rather than suppress this render's residency.
  drawsPerRender = 2; installFrameCounter(renderer);
  renderer.render(f.scene, f.camera); expect(observe).toHaveBeenCalledTimes(2);
  renderer.render(f.scene, f.camera); expect(observe).toHaveBeenCalledTimes(3);
});

test('new render, consuming owner, label policy and upload registrations invalidate reuse', () => {
  const f = fixture(), resource = new Texture(), native = {}, proxies = [{}, {}];
  const renderer = { ...f.renderer, properties: { get: (_value: unknown) => native },
    render: (_scene: Scene, _camera: Camera) => { renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group); } };
  installFrameCounter(renderer); const draws = drawHooks(renderer), hooks = propertyHooks(renderer);
  const owners: (symbol | null)[] = []; let policy = 0;
  hooks.ownership = () => { owners.push(draws.ownerToken); };
  hooks.labelsVersion = () => policy; hooks.labels = () => proxies[policy];
  const uploaded = vi.fn<(resource: Texture) => void>(); hooks.uploaded = uploaded;
  f.stock.mockImplementation(() => {
    expect(renderer.properties.get(resource)).toBe(proxies[policy]);
    expect(renderer.properties.get(resource)).toBe(proxies[policy]);
  });
  const first = Symbol('first owner'), second = Symbol('second owner');
  draws.ownerToken = first; renderer.render(f.scene, f.camera); renderer.render(f.scene, f.camera);
  draws.ownerToken = second; renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group);
  expect(owners).toEqual([first, first, second]);
  f.stock.mockImplementation(() => {
    renderer.properties.get(resource); policy = 1;
    expect(renderer.properties.get(resource)).toBe(proxies[1]);
    invalidatePropertyObservation(); renderer.properties.get(resource);
  });
  renderer.renderBufferDirect(f.camera, f.scene, f.geometry, f.material, f.object, f.group);
  expect(uploaded).toHaveBeenCalledTimes(5);
});
