import { expect, it } from 'vitest';
import { PlaneGeometry } from 'three';
import { CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import { islandClippedIndex } from '../src/shards/driftwood-isle/generators/islandClips';
import { inArea } from '../src/shards/driftwood-isle/generators/blenderArea';

it('bakes the native terrain index without the baked island, keeping its runs in order', () => {
  const geometry = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_RES - 1, TERRAIN_RES - 1).rotateX(-Math.PI / 2);
  try {
    const position = geometry.getAttribute('position'), source = geometry.getIndex(); if (source === null) throw new Error('Grid index missing');
    const index = islandClippedIndex(Array.from(source.array));
    expect(index.length).toBeGreaterThan(0); expect(index.length).toBeLessThan(source.count);
    expect(Array.from(index.subarray(0, 6))).toEqual(Array.from(source.array.subarray(0, 6)));
    let inside = false;
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i] ?? 0, b = index[i + 1] ?? 0, c = index[i + 2] ?? 0;
      if (inArea((position.getX(a) + position.getX(b) + position.getX(c)) / 3, (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3)) inside = true;
    }
    expect(inside).toBe(false);
    expect(() => islandClippedIndex([0, 1, 2])).toThrow('terrain topology differs');
  } finally { geometry.dispose(); }
});
