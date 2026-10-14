import { expect, it, vi } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, PlaneGeometry, Texture } from 'three';
import { createModelLibrary } from '../src/game/plugin/geometry';

it('shares an original atlas while cloning prepared geometry and explicit NPC slots', async () => {
  const geometry = new PlaneGeometry(2, 3); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const pool = new Group(), primitive = new Mesh(geometry, new MeshStandardMaterial()); primitive.name = 'hero';
  primitive.userData['restGroups'] = [];
  primitive.userData['restBox'] = [-1, -1.5, 0, 1, 1.5, 0];
  primitive.userData['restSphere'] = [0, 0, 0, 2]; pool.add(primitive);
  const texture = new Texture(), painted = new Group(); painted.add(new Mesh(new PlaneGeometry(), new MeshStandardMaterial({ map: texture })));
  const read = vi.fn((url: string) => {
    if (url !== 'pool' && url !== 'paint') throw new Error('Undeclared asset');
    return Promise.resolve({ scene: url === 'pool' ? pool : painted });
  });
  const library = createModelLibrary<never, never>({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 0.6,
    geometryPools: [{ url: 'pool', parts: ['hero'] }], paintedModels: [{ name: 'actor', url: 'paint', geometry: 'hero', pivots: ['hero', 'hero', 'hero', null] }] }, 'test', {}, read);
  const pause = vi.fn(() => Promise.resolve());
  await library.preload(pause); await library.preload(pause);
  const first = library.painted('actor'), second = library.painted('actor');
  if (first === null || second === null || first.pivots === undefined) throw new Error('Missing prepared actor');
  expect(first.geometry).not.toBe(second.geometry); expect(first.map).toBe(texture); expect(second.map).toBe(texture);
  expect(first.geometry.boundingSphere?.radius).toBe(2);
  expect(first.pivots.fore.getAttribute('position').count).toBe(0);
  expect(first.pivots.body).not.toBe(first.geometry);
  expect(pause).toHaveBeenCalledTimes(1); expect(read).toHaveBeenCalledTimes(2);
  first.geometry.dispose(); second.geometry.dispose(); texture.dispose(); geometry.dispose();
  for (const part of Object.values(first.pivots)) part.dispose();
  if (second.pivots !== undefined) for (const part of Object.values(second.pivots)) part.dispose();
});
