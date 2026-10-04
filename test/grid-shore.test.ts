import { expect, it } from 'vitest';
import { generatePlatform, type GeneratedStrip, type PlatformCell, type StripProfile } from '../src/engine/sim/strips';

// G149 (the §3.2 shore rule): a Driftwood-like edge, seabed −2.6 m off a road-height 8 m midpoint entry, under a sea at 0.
const seabed = (count = 256): StripProfile => ({
  heights: Array.from({ length: count }, (_, i) => { const at = -250 + i * 500 / (count - 1), t = Math.max(0, Math.min(1, (Math.abs(at) - 10) / 12)); return -2.6 * t * t * (3 - 2 * t); }),
  colours: Array.from({ length: count }, () => [0.5, 0.5, 0.5]), roadHeight: 0,
});
const flat = (count = 256): StripProfile => ({ heights: Array.from({ length: count }, () => 0), colours: Array.from({ length: count }, () => [0.5, 0.5, 0.5]), roadHeight: 0 });
const sides = <T>(value: T): Record<'north' | 'east' | 'south' | 'west', T> => ({ north: value, east: value, south: value, west: value });
const shoreCell = (waterSurface: number | undefined, edges = seabed()): PlatformCell => ({ instance: 'shore', cell: [0, 0], origin: { x: 0, z: 0 }, edges: sides(edges),
  observations: sides({ entryWidth: 8, geometry: 'ground' as const, ...(waterSurface === undefined ? {} : { waterSurface }) }) });

const crossroads = (cell: PlatformCell): GeneratedStrip[] => generatePlatform([cell], flat()).filter((strip) => strip.id.startsWith('cross.'));
const lowest = (strips: readonly GeneratedStrip[]): number => Math.min(...strips.flatMap((strip) => Array.from(strip.mesh.positions.filter((_, k) => k % 3 === 1))));
const kinds = (strips: readonly GeneratedStrip[]): Set<string> => new Set(strips.flatMap((strip) => strip.features.map((feature) => feature.kind)));

it('keeps a shore corner (seabed under a sea at exactly 0, StripCorner.shore) at road level with no drop face or road wall', () => {
  const shore = crossroads(shoreCell(0));
  expect(lowest(shore)).toBe(0);
  for (const kind of ['parapet', 'road-wall', 'guard-rail']) expect(kinds(shore).has(kind)).toBe(false);
  // the same seabed with no sea, or the old +0.8 sea (the dike), keeps G90's descent, drop face and road wall
  for (const water of [undefined, 0.8]) {
    const other = crossroads(shoreCell(water));
    expect(lowest(other)).toBeLessThan(-2.5);
    for (const kind of ['parapet', 'road-wall', 'guard-rail']) expect(kinds(other).has(kind)).toBe(true);
  }
  // deterministic (two runs, identical bytes)
  expect(crossroads(shoreCell(0))).toEqual(shore);
});
