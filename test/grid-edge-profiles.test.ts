// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed baked terrain fixtures.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import * as v from 'valibot';
import { bakedEdgeProfiles, nativeEdgeProfiles, edgeSample, edgeSampleLocations } from '../src/engine/sim/edgeProfiles';
import { EdgeProfilesSchema } from '../src/game/shardfile/edgeProfiles';

const colour = [0.25, 0.5, 0.75] as const;
const grid = (resolution: number) => nativeEdgeProfiles({ resolution, heights: Float32Array.from({ length: resolution ** 2 }, (_, i) => Math.sin(i / 37)), colourAt: () => colour });
it('preserves every native boundary sample and positive-axis ordering, without 129 decimation', () => {
  for (const resolution of [256, 257]) {
    const profiles = grid(resolution);
    expect(v.parse(EdgeProfilesSchema, profiles)).toEqual(profiles);
    expect(profiles.north.heights).toHaveLength(resolution);
    for (let i = 0; i < resolution; i++) {
      expect(profiles.north.heights[i]).toBe(Math.fround(Math.sin(((resolution - 1) * resolution + i) / 37)));
      expect(profiles.east.heights[i]).toBe(Math.fround(Math.sin((i * resolution + resolution - 1) / 37)));
      expect(profiles.south.heights[i]).toBe(Math.fround(Math.sin(i / 37)));
      expect(profiles.west.heights[i]).toBe(Math.fround(Math.sin(i * resolution / 37)));
    }
  }
  expect(() => grid(129)).toThrow('256 or 257');
  const old = { heights: Array.from({ length: 129 }, () => 0), colours: Array.from({ length: 129 }, () => colour), roadHeight: 0 };
  expect(() => v.parse(EdgeProfilesSchema, { north: old, east: old, south: old, west: old })).toThrow();
});
it('unions mixed native rows without losing vertices or changing the piecewise-linear boundary', () => {
  const a = grid(256).north, b = grid(257).north, locations = edgeSampleLocations([a, b]);
  expect(locations).toHaveLength(511); expect(locations[0]).toBe(-250); expect(locations.at(-1)).toBe(250);
  for (const p of [a, b]) for (let i = 0; i < p.heights.length; i++) {
    const at = -250 + i * 500 / (p.heights.length - 1);
    expect(locations).toContain(at); expect(edgeSample(p, at).height).toBeCloseTo(p.heights[i] ?? Infinity, 10);
  }
  expect(locations).toEqual(edgeSampleLocations([b, a]));
});
it('reads a real WSTR bake through an unaligned view, preserving the complete 256-row boundary', () => {
  const bytes = readFileSync('public/assets/baked/driftwood-isle/terrain.bin');
  const wrapped = new Uint8Array(bytes.length + 1); wrapped.set(bytes, 1);
  const profiles = bakedEdgeProfiles(wrapped.subarray(1), [colour, colour, colour, colour]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(profiles.north.heights).toHaveLength(256);
  expect(profiles.north.heights[255]).toBe(view.getFloat32(24 + (256 ** 2 - 1) * 4, true));
  expect(profiles.south.heights[0]).toBe(view.getFloat32(24, true));
  expect(profiles).toEqual(bakedEdgeProfiles(bytes, [colour, colour, colour, colour]));
  expect(() => bakedEdgeProfiles(bytes.subarray(0, 25), [colour, colour, colour, colour])).toThrow('Truncated');
  expect(() => v.parse(EdgeProfilesSchema, { ...profiles, north: { ...profiles.north, invented: 1 } })).toThrow();
});
