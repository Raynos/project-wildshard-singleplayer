// The built world on the maps (E130, src/ui/mapShapes.ts): a shard's ChunkDef.map picks registered pieces by id (with a
// trailing-* prefix), and their colliders become world-XZ footprints — a yawed box's four corners, a hull's outline, a
// capsule's crown dot — never anything hand-placed.
import { describe, expect, test } from 'vitest';
import { mapLook, mapShapes, mapWants } from '../src/ui/mapShapes';
import type { ChunkMapDef } from '../src/chunks/ChunkDef';
import type { Piece } from '../src/world/registry';

const def: ChunkMapDef = { pieces: [{ ids: ['hut', 'jetty-*'], look: 'timber' }, { ids: ['palms'], look: 'dot' }] };
const piece = (id: string, colliders: Piece['colliders']): Piece => ({ id, name: id, category: 'buildings', file: 'x', ...(colliders ? { colliders } : {}) });

describe('mapShapes', () => {
  test('ids match exactly or by a trailing * prefix', () => {
    expect(mapLook(def, 'hut')).toBe('timber');
    expect(mapLook(def, 'jetty-2')).toBe('timber');
    expect(mapWants(def, 'hut-roof')).toBe(false);
    expect(mapWants(undefined, 'hut')).toBe(false);
  });
  test('a yawed box is its four corners, a capsule a dot, unlisted pieces nothing', () => {
    const s = mapShapes(def, [
      piece('hut', [{ kind: 'box', x: 10, y: 1, z: -5, hx: 2, hy: 1, hz: 1, yaw: Math.PI / 2 }]),
      piece('palms', [{ kind: 'capsule', x: 3, y: 2, z: 4, halfHeight: 2, radius: 0.3 }]),
      piece('rocks', [{ kind: 'ball', x: 0, y: 0, z: 0, radius: 5 }]),
    ]);
    expect(s.polys).toHaveLength(1);
    const p = s.polys[0];
    if (!p) throw new Error('no poly');
    expect(p.pts).toHaveLength(8);
    // turned a quarter: 2 m along x becomes 2 m along z
    expect(p.x0).toBeCloseTo(9); expect(p.x1).toBeCloseTo(11);
    expect(p.z0).toBeCloseTo(-7); expect(p.z1).toBeCloseTo(-3);
    expect(s.dots).toEqual([{ x: 3, z: 4, r: 1.6 }]);
  });
  test('a hull becomes its convex outline', () => {
    const pts = new Float32Array([0, 0, 0, 4, 0, 0, 4, 0, 4, 0, 0, 4, 2, 1, 2]);
    const s = mapShapes(def, [piece('jetty-0', [{ kind: 'hull', x: 1, y: 0, z: 1, points: pts }])]);
    expect(s.polys[0]?.pts).toHaveLength(8); // the inner point drops out
    expect(s.polys[0]?.x1).toBeCloseTo(5);
  });
});
