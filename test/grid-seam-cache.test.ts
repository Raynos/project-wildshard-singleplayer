// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete typed-array bytes with the shipping mesh receipt.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fixture from './fixtures/grid-seam-cache.json' with { type: 'json' };
import { GridAssembly } from '../src/game/grid/assembly';
import { generatePlatform, type PlatformCell } from '../src/engine/sim/strips';
import { seamTriangleError, seamTriangleErrorEvaluator } from '../src/engine/sim/seamError';

// Captured before the optimization from every authored product (all seven seeds) on 6693cc456,
// including every template copy and open plot, in every Developer/DEVSERVER catalogue variant.
it.each(fixture.expected)('preserves full grid bytes (Developer $developer, DEVSERVER $devserver)', expected => {
  const assembly = new GridAssembly(expected, fixture.catalogue), empty = assembly.emptyNeighbour.edge;
  const cells: PlatformCell[] = assembly.cells.map(cell => {
    const source = fixture.products.find(product => product.slug === cell.slug);
    if (source === undefined) throw new Error('Missing authored product');
    const side = (edge: 'north' | 'east' | 'south' | 'west') => ({ entryWidth: source.entryways.find(entry => entry.edge === edge)?.width ?? 0,
      geometry: 'ground' as const, ...(source.sea ? { waterSurface: 0 } : {}) });
    return { ...cell, edges: source.edge, observations: { north: side('north'), east: side('east'), south: side('south'), west: side('west') } };
  });
  for (const plot of assembly.plots) {
    const entry = { entryWidth: 8, geometry: 'ground' } as const;
    cells.push({ ...plot, edges: { north: empty, east: empty, south: empty, west: empty }, observations: { north: entry, east: entry, south: entry, west: entry } });
  }
  const platform = generatePlatform(cells, empty), hash = createHash('sha256');
  for (const strip of platform) {
    hash.update(JSON.stringify([strip.id, strip.mesh.origin, strip.features, strip.turnIn, strip.duplicates.map(duplicate => [duplicate.instance, duplicate.mesh.origin])]));
    for (const bytes of [strip.mesh.positions, strip.mesh.colours, strip.mesh.indices]) hash.update(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  }
  expect(platform).toHaveLength(expected.pieces);
  expect(platform.reduce((total, strip) => total + strip.mesh.indices.length / 3, 0)).toBe(expected.triangles);
  expect(hash.digest('hex')).toBe(expected.hash);
});

it('keeps caching local to immutable certification and creates fresh values for a later generation', () => {
  const field = { columns: 2, along: [0, 1, 2], positions: [0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 2, 1, 0, 2], colours: Array.from({ length: 18 }, () => 0.25) };
  const read = seamTriangleErrorEvaluator(field);
  for (const triangle of [[0, 4, 5], [0, 2, 3], [2, 4, 3]] as const) expect(read(triangle)).toEqual(seamTriangleError(field, triangle));
  field.positions[7] = 2;
  expect(seamTriangleErrorEvaluator(field)([0, 4, 5])).toEqual(seamTriangleError(field, [0, 4, 5]));
  expect(seamTriangleErrorEvaluator(field)([0, 4, 5]).height).toBe(2);
});
