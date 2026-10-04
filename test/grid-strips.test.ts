import { describe, expect, it } from 'vitest';
import { generateStrip, generateCrossroads, generatePlatform, STRIP_OFFSETS, type StripProfile } from '../src/engine/sim/strips';

const profile = (height: number, colour: readonly [number, number, number]): StripProfile => ({ heights: Array.from({ length: 129 }, (_, i) => height + Math.sin(i / 8)), colours: Array.from({ length: 129 }, () => colour), roadHeight: 0 });
const profiles = [profile(2, [0.1, 0.4, 0.2]), profile(4, [0.5, 0.2, 0.1])] as const;
const adjacent = [{ instance: 'a', origin: { x: 0, z: 0 } }, { instance: 'b', origin: { x: 555, z: 0 } }];
describe('deterministic shared platform seams', () => {
  it('generates byte-identical positions, indices and colours, in both axes', () => {
    for (const axis of ['x', 'z'] as const) {
      const input = { id: 'a/b', axis, origin: { x: 277.5, z: 0 }, profiles, adjacent };
      const a = generateStrip(input), b = generateStrip(input);
      expect(a).toEqual(b); expect([...STRIP_OFFSETS]).toContain(-21.5); expect([...STRIP_OFFSETS]).toContain(-17.5);
      for (let i = 0; i < 129; i++) {
        expect(a.mesh.positions[(i * 8) * 3 + 1]).toBeCloseTo(profiles[0].heights[i] ?? 0, 5);
        expect(a.mesh.positions[(i * 8 + 7) * 3 + 1]).toBeCloseTo(profiles[1].heights[i] ?? 0, 5);
        expect(Array.from(a.mesh.colours.slice(i * 24, i * 24 + 3))).toEqual(profiles[0].colours[i]?.map(Math.fround));
        expect(a.mesh.positions[(i * 8 + 3) * 3 + 1]).toBe(0); expect(a.mesh.positions[(i * 8 + 4) * 3 + 1]).toBe(0);
      }
    }
  });
  it('duplicates exact mesh bytes with only the regional origin translated', () => {
    const result = generateStrip({ id: 'a/b', axis: 'x', origin: { x: 277.5, z: 0 }, profiles, adjacent });
    expect(result.duplicates.map((d) => d.mesh.origin.x)).toEqual([277.5, -277.5]);
    for (const d of result.duplicates) { expect(d.mesh.positions).toBe(result.mesh.positions); expect(d.mesh.indices).toBe(result.mesh.indices); }
  });
  it('joins four corner fields to corridor endpoints without a height or colour step', () => {
    const corners = [{ height: 2, colour: [0.1, 0.4, 0.2] }, { height: 4, colour: [0.5, 0.2, 0.1] }, { height: 3, colour: [0.2, 0.4, 0.3] }, { height: 5, colour: [0.5, 0.3, 0.1] }] as const;
    const cross = generateCrossroads({ id: 'cross', origin: { x: 277.5, z: 277.5 }, corners, adjacent });
    const constant = (c: typeof corners[number]): StripProfile => ({ heights: Array.from({ length: 129 }, () => c.height), colours: Array.from({ length: 129 }, () => c.colour), roadHeight: 0 });
    const strip = generateStrip({ id: 'edge', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [constant(corners[0]), constant(corners[1])], adjacent });
    for (let x = 0; x < 8; x++) {
      expect(cross.mesh.positions[x * 3 + 1]).toBe(strip.mesh.positions[(128 * 8 + x) * 3 + 1]);
      expect(cross.mesh.colours.slice(x * 3, x * 3 + 3)).toEqual(strip.mesh.colours.slice((128 * 8 + x) * 3, (128 * 8 + x) * 3 + 3));
    }
    expect(cross).toEqual(generateCrossroads({ id: 'cross', origin: { x: 277.5, z: 277.5 }, corners, adjacent }));
  });
  it('rejects nonfinite, wrongly sized or nonzero-road profiles before allocation', () => {
    expect(() => generateStrip({ id: 'bad', axis: 'x', origin: { x: 0, z: 0 }, profiles: [{ ...profiles[0], roadHeight: 1 }, profiles[1]], adjacent })).toThrow('profile');
    expect(() => generateStrip({ id: 'bad', axis: 'x', origin: { x: 0, z: 0 }, profiles: [{ ...profiles[0], heights: [Number.NaN] }, profiles[1]], adjacent })).toThrow('profile');
  });
  it('assembles the whole grid and its empty perimeter with deterministic shared corner seams', () => {
    const empty = { heights: Array.from({ length: 129 }, () => 0), colours: Array.from({ length: 129 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
    const cells = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((z) => ({ instance: `${x}/${z}`, origin: { x: x * 555, z: z * 555 }, cell: [x, z] as const, edges: { north: empty, south: empty, east: empty, west: empty } })));
    const platform = generatePlatform(cells, empty); expect(platform).toHaveLength(40); expect(platform).toEqual(generatePlatform(cells, empty));
    expect(platform.filter((s) => s.id.startsWith('cross.'))).toHaveLength(16);
    for (const cell of cells) expect(platform.flatMap((s) => s.duplicates).filter((d) => d.instance === cell.instance)).toHaveLength(8);
  });
});
