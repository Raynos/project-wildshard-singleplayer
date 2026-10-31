import { expect, it } from 'vitest';
import { sliceNativeLattice, type NativeLatticeSource } from './nativeLattice';

function source(): NativeLatticeSource {
  const positions = new Float32Array(256 ** 2 * 3);
  positions.set([1, 0, 0], 3); positions.set([0, 0, 1], 257 * 3);
  return { resolution: 256, positions, indices: Uint32Array.from([0, 1, 257]), attributes: { gain: { itemSize: 1, values: new Float32Array(256 ** 2) } } };
}

it('retains per-corner subarray and iterator order while copying every yielded channel', () => {
  for (const Type of [Float32Array, Float64Array]) {
    const input = source(), events: string[] = [];
    input.positions = Type.from(input.positions);
    const gain = input.attributes['gain'];
    if (gain === undefined) throw new Error('Missing test channel');
    gain.values = new Type(256 ** 2);
    const subarray = gain.values.subarray.bind(gain.values);
    Object.defineProperty(gain.values, 'subarray', { value: (begin: number, end: number): Float32Array | Float64Array => {
      events.push(`subarray:${begin}:${end}`);
      const view = subarray(begin, end), iterate = view[Symbol.iterator].bind(view);
      Object.defineProperty(view, Symbol.iterator, { *value(): Generator<number> {
        for (const value of iterate()) { events.push(`value:${value}`); yield value + 1; }
      } });
      return view;
    } });
    const tiles = sliceNativeLattice(input, 0), filled = tiles.filter(tile => tile.indices.length > 0);
    expect(events).toEqual(['subarray:0:1', 'value:0', 'subarray:1:2', 'value:0', 'subarray:257:258', 'value:0']);
    expect(tiles).toHaveLength(64); expect(filled).toHaveLength(1);
    expect(filled[0]?.positions).toEqual(Float64Array.from([0, 0, 0, 1, 0, 0, 0, 0, 1]));
    expect(filled[0]?.attributes['gain']?.values).toEqual(Float64Array.from([1, 1, 1]));
    expect(filled[0]?.indices).toEqual(Uint32Array.from([0, 1, 2]));
  }
});

it('retains complete native shape and finite channel admission before copying', () => {
  const input = source(); input.positions[0] = Number.NaN;
  expect(() => sliceNativeLattice(input, 0)).toThrow('outside finite cell bounds');
  input.positions[0] = 0;
  const gain = input.attributes['gain']; if (gain === undefined) throw new Error('Missing test channel');
  gain.values[0] = Infinity;
  expect(() => sliceNativeLattice(input, 1)).toThrow('Invalid native lattice attribute gain');
  gain.values[0] = 0;
  expect(() => sliceNativeLattice({ ...input, indices: Uint32Array.from([0, 1, 256 ** 2]) }, 0)).toThrow('bounded original');
});
