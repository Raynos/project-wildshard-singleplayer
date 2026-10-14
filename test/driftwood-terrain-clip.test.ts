import { expect, it } from 'vitest';
import { Mesh, PlaneGeometry } from 'three';
import { CHUNK_SIZE, TERRAIN_RES } from '@wildshard/engine/core/config';
import { clipGridTerrain } from '../src/shards/driftwood-isle/runtime/looks/bakedIsland';
import { inArea } from '../src/shards/driftwood-isle/world/blenderArea';

it('retains native terrain outside the baked island without replacing vertex channels', () => {
  const geometry = new PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_RES - 1, TERRAIN_RES - 1).rotateX(-Math.PI / 2);
  try {
    const position = geometry.getAttribute('position'), normal = geometry.getAttribute('normal'), before = geometry.getIndex()?.count ?? 0;
    clipGridTerrain(new Mesh(geometry));
    const index = geometry.getIndex(); if (index === null) throw new Error('Retained index missing');
    expect(geometry.getAttribute('position')).toBe(position); expect(geometry.getAttribute('normal')).toBe(normal);
    expect(index.count).toBeGreaterThan(0); expect(index.count).toBeLessThan(before);
    let inside = false;
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      if (inArea((position.getX(a) + position.getX(b) + position.getX(c)) / 3, (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3)) inside = true;
    }
    expect(inside).toBe(false);
    const other = new PlaneGeometry(2, 2);
    try { expect(() => clipGridTerrain(new Mesh(other))).toThrow('terrain topology differs'); } finally { other.dispose(); }
  } finally { geometry.dispose(); }
});
