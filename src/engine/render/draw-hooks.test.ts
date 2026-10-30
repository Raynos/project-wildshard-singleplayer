import { expect, test, vi } from 'vitest';
import { BufferGeometry, Camera, CompressedTexture, Mesh, MeshBasicMaterial, MeshDepthMaterial, Scene, Texture } from 'three';
import type { Renderer } from './renderer';
import { drawHooks, propertyHooks } from './drawHooks';

function fixture() {
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial(), object = new Mesh(geometry, material);
  const camera = new Camera(), scene = new Scene(), group = { start: 0, count: 3, materialIndex: 0 };
  const stock = vi.fn<Renderer['renderBufferDirect']>();
  const renderer = { renderBufferDirect: stock };
  return { renderer, stock, geometry, material, object, camera, scene, group,
    draw: () => { renderer.renderBufferDirect(camera, scene, geometry, material, object, group); } };
}

test('late registration keeps one renderer hook and shadow state encloses every observer', () => {
  const f = fixture(), hooks = drawHooks(f.renderer), installed = f.renderer.renderBufferDirect;
  const depth = new MeshDepthMaterial(), events: string[] = [];
  let shadow = false;
  hooks.outer = (draw, camera, scene, geometry, _material, object, group) => {
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
  const resource = new CompressedTexture(), frozen = Object.freeze({}), initial = {}, replacement = {};
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
