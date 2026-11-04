import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Group, Mesh, type Object3D } from 'three';
import { createModelLibrary, type ModelGeometryPool, type RestPoolStore } from '../plugin/geometry';
import { homeSeedKey } from './homeSeed';
import { scenePoolKey } from './scenePools';

// DL6: a pool library's prepared parts kept outside it (the home build cache and cold seed, behind Debug > Home geometry
// seed 'On + pools'): a kept pool skips its file's parse; a parsed one is offered to the store.
const part = (): BufferGeometry => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  return geometry;
};
const scene = (): { readonly scene: Object3D } => {
  const root = new Group();
  for (const name of ['tile', 'edge']) {
    const mesh = new Mesh(part()); mesh.name = name; mesh.userData = { restGroups: [], restSphere: null, restBox: null }; root.add(mesh);
  }
  return { scene: root };
};
const POOL: ModelGeometryPool = { url: 'https://example.test/shardfiles/x/blobs/pool.glb', parts: ['tile', 'edge'] };
const library = (store: RestPoolStore, read: (url: string) => Promise<{ readonly scene: Object3D }>, pool: ModelGeometryPool = POOL) =>
  createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1, geometryPools: [pool], restPools: store }, 'test', {}, read);

test('a kept pool restores its declared parts without reading its file', async () => {
  const kept = new Map([['tile', part()], ['edge', part()]]), read = vi.fn(() => Promise.resolve(scene()));
  const store = { read: vi.fn(() => Promise.resolve(kept)), save: vi.fn() };
  const models = library(store, read); await models.preload();
  expect(read).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled();
  expect(models.geometry('tile')?.getAttribute('position').count).toBe(3);
  expect(models.geometry('edge')).not.toBeNull();
});

test('a partial or failed keep parses the file as before and offers the parsed parts', async () => {
  for (const kept of [Promise.resolve(new Map([['tile', part()]])), Promise.reject(new Error('cache down')), Promise.resolve(null)]) {
    const read = vi.fn(() => Promise.resolve(scene())), saved: string[][] = [];
    const store: RestPoolStore = { read: () => kept, save: (_pool, parts) => { saved.push([...parts.keys()]); } };
    const models = library(store, read); await models.preload();
    expect(read).toHaveBeenCalledTimes(1); expect(saved).toEqual([['tile', 'edge']]);
    expect(models.geometry('tile')).not.toBeNull();
  }
});

test('a pool with atlases is never kept: its textures live in the file', async () => {
  const store = { read: vi.fn(() => Promise.resolve(null)), save: vi.fn() };
  const models = library(store, () => Promise.resolve(scene()), { ...POOL, atlases: [{ id: 'a', part: 'tile', anisotropy: 4 }] });
  await models.preload();
  expect(store.read).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled();
});

test("a pool key's seed form drops the page origin, so the build's bake and the page agree", () => {
  const page = scenePoolKey({ ...POOL, channels: [{ name: 'aTint', source: '_tint', width: 3 }] });
  const bake = scenePoolKey({ url: 'http://seed.invalid/shardfiles/x/blobs/pool.glb', parts: POOL.parts, channels: [{ name: 'aTint', source: '_tint', width: 3 }] });
  expect(page).not.toBe(bake);
  expect(homeSeedKey(page)).toBe(homeSeedKey(bake));
  expect(homeSeedKey(page)).toMatch(/^pool:\["\/shardfiles\/x\/blobs\/pool\.glb",/u);
  expect(homeSeedKey('pool:not json')).toBe('pool:not json');
});
