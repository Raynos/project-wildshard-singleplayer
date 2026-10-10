import { describe, expect, it } from 'vitest';
import { generateStrip, generateCrossroads, generatePlatform, generatePlatformSliced, STRIP_OFFSETS, type StripProfile } from '../src/engine/sim/strips';

const profile = (height: number, colour: readonly [number, number, number]): StripProfile => ({ heights: Array.from({ length: 257 }, (_, i) => height + Math.sin(i / 8)), colours: Array.from({ length: 257 }, () => colour), roadHeight: 0 });
const profiles = [profile(2, [0.1, 0.4, 0.2]), profile(4, [0.5, 0.2, 0.1])] as const;
const adjacent = [{ instance: 'a', origin: { x: 0, z: 0 } }, { instance: 'b', origin: { x: 555, z: 0 } }];
describe('deterministic shared platform seams', () => {
  it('generates byte-identical positions, indices and colours, in both axes', () => {
    for (const axis of ['x', 'z'] as const) {
      const input = { id: 'a/b', axis, origin: { x: 277.5, z: 0 }, profiles, adjacent };
      const a = generateStrip(input), b = generateStrip(input);
      expect(a).toEqual(b); expect([...STRIP_OFFSETS]).toContain(-21.5); expect([...STRIP_OFFSETS]).toContain(-17.5);
      for (let i = 0; i < 257; i++) {
        expect(a.mesh.positions[(i * STRIP_OFFSETS.length) * 3 + 1]).toBeCloseTo(profiles[0].heights[i] ?? 0, 5);
        expect(a.mesh.positions[(i * STRIP_OFFSETS.length + STRIP_OFFSETS.length - 1) * 3 + 1]).toBeCloseTo(profiles[1].heights[i] ?? 0, 5);
        expect(Array.from(a.mesh.colours.slice(i * STRIP_OFFSETS.length * 3, i * STRIP_OFFSETS.length * 3 + 3))).toEqual(profiles[0].colours[i]?.map(Math.fround));
        expect(a.mesh.positions[(i * STRIP_OFFSETS.length + 10) * 3 + 1]).toBe(0); expect(a.mesh.positions[(i * STRIP_OFFSETS.length + 11) * 3 + 1]).toBe(0);
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
    const constant = (c: typeof corners[number]): StripProfile => ({ heights: Array.from({ length: 257 }, () => c.height), colours: Array.from({ length: 257 }, () => c.colour), roadHeight: 0 });
    const strip = generateStrip({ id: 'edge', axis: 'x', origin: { x: 277.5, z: 0 }, profiles: [constant(corners[0]), constant(corners[1])], adjacent });
    for (let x = 0; x < STRIP_OFFSETS.length; x++) {
      expect(cross.mesh.positions[x * 3 + 1]).toBe(strip.mesh.positions[(256 * STRIP_OFFSETS.length + x) * 3 + 1]);
      expect(cross.mesh.colours.slice(x * 3, x * 3 + 3)).toEqual(strip.mesh.colours.slice((256 * STRIP_OFFSETS.length + x) * 3, (256 * STRIP_OFFSETS.length + x) * 3 + 3));
    }
    expect(cross).toEqual(generateCrossroads({ id: 'cross', origin: { x: 277.5, z: 277.5 }, corners, adjacent }));
  });
  it('rejects nonfinite, wrongly sized or nonzero-road profiles before allocation', () => {
    expect(() => generateStrip({ id: 'bad', axis: 'x', origin: { x: 0, z: 0 }, profiles: [{ ...profiles[0], roadHeight: 1 }, profiles[1]], adjacent })).toThrow('profile');
    expect(() => generateStrip({ id: 'bad', axis: 'x', origin: { x: 0, z: 0 }, profiles: [{ ...profiles[0], heights: [Number.NaN] }, profiles[1]], adjacent })).toThrow('profile');
  });
  it('assembles the whole grid and its empty perimeter with deterministic shared corner seams', () => {
    const empty = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
    const cells = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((z) => ({ instance: `${x}/${z}`, origin: { x: x * 555, z: z * 555 }, cell: [x, z] as const, edges: { north: empty, south: empty, east: empty, west: empty } })));
    const platform = generatePlatform(cells, empty); expect(platform).toHaveLength(40); expect(platform).toEqual(generatePlatform(cells, empty));
    expect(platform.filter((s) => s.id.startsWith('cross.'))).toHaveLength(16);
    for (const cell of cells) expect(platform.flatMap((s) => s.duplicates).filter((d) => d.instance === cell.instance)).toHaveLength(8);
  }, 60_000); // Two full 40-piece native-profile meshes and exact shared-byte checks exceed 20 s in CI coverage.
  it('keeps complete flat and constant-cliff grids below85k triangles, including native aprons and guards', () => {
    for (const height of [0, 100]) {
      const constant = { heights: Array.from({ length: 257 }, () => height), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
      const cells = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(z => ({ instance: `${x}/${z}`, origin: { x: x * 555, z: z * 555 }, cell: [x, z] as const,
        edges: { north: constant, south: constant, east: constant, west: constant } })));
      const platform = generatePlatform(cells, constant);
      expect(platform).toHaveLength(40);
      expect(platform.reduce((triangles, strip) => triangles + strip.mesh.indices.length / 3, 0)).toBeLessThan(85_000);
      for (const strip of platform) for (const duplicate of strip.duplicates) {
        expect(duplicate.mesh.positions).toBe(strip.mesh.positions); expect(duplicate.mesh.indices).toBe(strip.mesh.indices);
      }
    }
  });
});

// rt3-crossing: the cold grid start built these 40 strips in one main-thread task (11.8 s at 4x CPU under "Weapons · HUD").
// The sliced generator is the same platform, strip for strip, with a paint opportunity whenever a slice runs out.
it('generates the same platform in slices, pausing within certified strips once a slice has used its budget', async () => {
  const empty = { heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 };
  const cells = [-1, 0, 1].flatMap((x) => [-1, 0, 1].map((z) => ({ instance: `${x}/${z}`, origin: { x: x * 555, z: z * 555 }, cell: [x, z] as const, edges: { north: empty, south: empty, east: empty, west: empty } })));
  let pauses = 0;
  const sliced = await generatePlatformSliced(cells, empty, () => { pauses++; return Promise.resolve(); }, 0);
  expect(sliced).toEqual(generatePlatform(cells, empty));
  expect(pauses).toBeGreaterThan(40); // Certification yields inside the strips and crossroads as well.
  let none = 0;
  expect(await generatePlatformSliced(cells, empty, () => { none++; return Promise.resolve(); }, Number.POSITIVE_INFINITY)).toHaveLength(40);
  expect(none).toBe(0);
}, 60_000);


it('preserves the pre-slicing native 256/257 shore and cliff mesh bytes, placements and features', async () => {
  const native = (count: number, height: number): StripProfile => ({
    heights: Array.from({ length: count }, (_, i) => height + (i === 0 || i === count - 1 ? 0 : Math.sin(i / 8))),
    colours: Array.from({ length: count }, (_, i) => [0.2 + (i === 0 || i === count - 1 ? 0 : 0.1 * Math.sin(i / 6)), 0.3, 0.4]), roadHeight: 0,
  });
  const cells = [native(256, -12), native(257, 100)].map((edge, i) => ({ instance: `region${i}`, origin: { x: i * 555, z: 0 }, cell: [i, 0] as const,
    edges: { north: edge, south: edge, east: edge, west: edge },
    observations: { north: { entryWidth: 0, waterSurface: 0 }, south: { entryWidth: 0, waterSurface: 0 }, east: { entryWidth: 0, waterSurface: 0 }, west: { entryWidth: 0, waterSurface: 0 } },
  }));
  const strips = generatePlatform(cells, native(257, 0)), chunks: Uint8Array[] = [], encode = new TextEncoder();
  for (const strip of strips) {
    chunks.push(encode.encode(JSON.stringify([strip.id, strip.mesh.origin, strip.features, strip.turnIn, strip.duplicates.map(duplicate => [duplicate.instance, duplicate.mesh.origin])])));
    for (const data of [strip.mesh.positions, strip.mesh.colours, strip.mesh.indices]) chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  // Captured from the original synchronous algorithm before introducing intra-strip yield points.
  const bytes = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  expect(Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('')).toBe('fc30c110b70581434ba4691f96e02b2d0c0b4ad65f86968482312a6a87a31d89');
  expect(strips).toHaveLength(13);
});
