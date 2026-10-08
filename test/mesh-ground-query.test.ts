import { expect, it } from 'vitest';
import { decodeMeshCollision, encodeMeshCollision, lowestMeshHeight } from '../src/engine/core/meshCollision';
import { clientGround } from '../src/game/shardfile/clientGround';
import { emptyShardfile } from '../src/sdk/author';
import { hashImmutableBytes } from '../src/sdk/immutable';

const layer = (y: number) => [0, y, 0, 10, y, 0, 0, y, 10, 10, y, 10];
const bytes = () => encodeMeshCollision({ vertices: Float32Array.from([...layer(-2), ...layer(4)]), indices: Uint32Array.of(0, 2, 1, 1, 2, 3, 4, 6, 5, 5, 6, 7) });
it('reads the lowest projected fallback without losing the separate bridge collision layer', () => {
  const data = decodeMeshCollision(bytes());
  for (const [x, z] of [[0, 0], [5, 5], [2, 8], [10, 10]]) {
    if (x === undefined || z === undefined) throw new Error('Point fixture');
    expect(lowestMeshHeight(data, x, z)).toBe(-2);
  }
  expect(lowestMeshHeight(data, 20, 0)).toBeUndefined();
  expect(() => lowestMeshHeight(data, Number.NaN, 0)).toThrow('Invalid mesh terrain query');
  expect(data.vertices[13]).toBe(4); expect(data.indices.length).toBe(12);
});
it('interpolates real sloped triangles and excludes a vertical wall from projected ground', () => {
  const slope = decodeMeshCollision(encodeMeshCollision({ vertices: Float32Array.of(0, 0, 0, 10, 10, 0, 0, 0, 10, 2, 0, 2, 2, 10, 2, 2, 0, 8), indices: Uint32Array.of(0, 2, 1, 3, 4, 5) }));
  expect(lowestMeshHeight(slope, 2, 2)).toBeCloseTo(2); expect(lowestMeshHeight(slope, 5, 2)).toBeCloseTo(5);
});
it('the client terrain fallback reads only static chunks and treats missing ground as void, with no synthetic y=0 floor', () => {
  const source = emptyShardfile({ slug: 'mesh-height', name: 'Mesh height', author: 'Fixture', revision: 1, seed: 1 }), wire = bytes(), file = hashImmutableBytes(wire);
  source.meshCollision = { version: 1, tiles: [{ x: 4, z: 4, file }], panels: [] };
  const ground = clientGround(source, new Map([[file, wire]]));
  expect(ground.heightAt(5, 5)).toBe(-2); expect(ground.heightAt(11, 5)).toBe(-250); expect(ground.heightAt(260, 0)).toBe(0);
  expect(ground.normalAt(5, 5)).toEqual([0, 1, 0]);
  expect(() => clientGround(source, new Map())).toThrow('Missing admitted mesh terrain');
  expect(clientGround(emptyShardfile(source.identity), new Map()).heightAt(5, 5)).toBe(0);
});
