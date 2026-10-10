// op-hitch29: the light bakes a grid cell runs on the road, in play, are sliced at the engine's work slice without changing
// a byte: the light volume's sliced bake writes `bakeLightVolume`'s texels and min / inv, and the vertex spill (its wide
// emitters' grid now ended between slabs) bakes the same `aSpill` with any yield cadence.
import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, Color, Vector3 } from 'three';
import { bakeLightVolume, bakeLightVolumeSliced, type PoolLight } from '../../src/shards/nine-dragon-stack/runtime/looks/lightVolume';
import { bakeSpill, type Emitter } from '../../src/shards/nine-dragon-stack/runtime/looks/vertexSpill';

const lights: PoolLight[] = Array.from({ length: 40 }, (_, i) => ({
  at: new Vector3((i % 7) * 3 - 9, (i % 3) * 2, Math.floor(i / 7) * 4 - 10), color: new Color(0.2 + (i % 5) * 0.15, 0.6, 1 - (i % 4) * 0.2),
  k: 1 + (i % 3), r: 1.5 + (i % 4), cut: 3,
}));
const box = { min: new Vector3(-12, -1, -12), max: new Vector3(12, 8, 14), cell: 0.5 };

describe('sliced light bakes (op-hitch29)', () => {
  it('bakeLightVolumeSliced writes bakeLightVolume\'s texels, bounds and stats', async () => {
    const minA = new Vector3(), invA = new Vector3(), minB = new Vector3(), invB = new Vector3();
    const a = bakeLightVolume(lights, box, 4, minA, invA);
    const b = await bakeLightVolumeSliced(lights, box, 4, minB, invB);
    expect(b.tex.image.width).toBe(a.tex.image.width);
    expect(b.tex.image.depth).toBe(a.tex.image.depth);
    expect(Array.from(b.tex.image.data ?? [])).toEqual(Array.from(a.tex.image.data ?? []));
    expect(minB.toArray()).toEqual(minA.toArray());
    expect(invB.toArray()).toEqual(invA.toArray());
    expect({ ...b.stats, ms: 0 }).toEqual({ ...a.stats, ms: 0 });
  });

  it('bakeSpill bakes the same aSpill with a wide emitter in the grid', async () => {
    const emitters: Emitter[] = [
      { at: new Vector3(0, 2, 0), color: new Color(1, 0.4, 0.2), w: 20, h: 12, power: 0.1, spill: 1 },
      { at: new Vector3(3, 1, -2), color: new Color(0.2, 0.5, 1), w: 0.6, h: 0.4, power: 0.1, spill: 0.6 },
    ];
    const spill = async (): Promise<number[]> => {
      const g = new BoxGeometry(30, 6, 30, 24, 4, 24);
      await bakeSpill([g], emitters);
      const a = g.getAttribute('aSpill');
      if (!(a instanceof BufferAttribute)) throw new Error('no aSpill');
      return Array.from(a.array);
    };
    const first = await spill();
    expect(first.some((x) => x > 0)).toBe(true);
    expect(await spill()).toEqual(first);
  });
});
