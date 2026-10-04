import { expect, it } from 'vitest';
import { generatePlatform, generateStrip, type PlatformCell, type StripProfile } from '../src/engine/sim/strips';

const profile = (): StripProfile => ({ heights: Array.from({ length: 257 }, () => 0), colours: Array.from({ length: 257 }, () => [0.25, 0.25, 0.25]), roadHeight: 0 });
it('shares byte-identical local meshes across separate segments and copied profiles, with exact independent placements', () => {
  const empty = profile();
  const cells: PlatformCell[] = [-1, 0, 1].flatMap(x => [-1, 0, 1].map(z => {
    const row = profile();
    return { instance: `${x}/${z}`, cell: [x, z], origin: { x: x * 555, z: z * 555 }, edges: { north: row, east: row, south: row, west: row } };
  }));
  const platform = generatePlatform(cells, empty), xStrips = platform.filter(strip => strip.id.startsWith('gap.x.'));
  const first = xStrips[0]; if (first === undefined) throw new Error('Missing platform');
  for (const segment of xStrips) {
    expect(segment.mesh.positions).toBe(first.mesh.positions); expect(segment.mesh.indices).toBe(first.mesh.indices);
    for (const duplicate of segment.duplicates) {
      const cell = cells.find(value => value.instance === duplicate.instance); if (cell === undefined) throw new Error('Missing cell');
      expect(duplicate.mesh.origin).toEqual({ x: segment.mesh.origin.x - cell.origin.x, z: segment.mesh.origin.z - cell.origin.z });
    }
  }
  const otherAxis = platform.find(strip => strip.id.startsWith('gap.z.'));
  expect(otherAxis?.mesh.indices).not.toBe(first.mesh.indices);
  // Independently rebuild a segment without platform caching: exact mesh and
  // translated duplicate bytes must match, not merely two cached runs.
  const selected = platform.find(strip => strip.id === 'gap.x.0.0'); if (selected === undefined) throw new Error('Missing chosen segment');
  expect(selected).toEqual(generateStrip({ id: selected.id, axis: 'x', origin: { ...selected.mesh.origin }, profiles: [empty, empty],
    adjacent: cells.filter(cell => cell.cell[1] === 0 && (cell.cell[0] === 0 || cell.cell[0] === 1)), observations: [{ entryWidth: 0 }, { entryWidth: 0 }] }));
  const again = generatePlatform(cells, empty);
  expect(again[0]?.mesh.positions).not.toBe(first.mesh.positions); // No retained cache between calls / revisions.
});

it('includes physical observations in the content key, preserving distinct openings and material source ranges', () => {
  const empty = profile();
  const cell: PlatformCell = { instance: 'only', cell: [0, 0], origin: { x: 0, z: 0 }, edges: { north: empty, east: empty, south: empty, west: empty },
    observations: { north: { entryWidth: 8, geometry: 'void', sourceSurface: 'north' }, east: { entryWidth: 8, geometry: 'void', sourceSurface: 'east' },
      south: { entryWidth: 0, geometry: 'void', sourceSurface: 'south' }, west: { entryWidth: 0, geometry: 'void', sourceSurface: 'west' } } };
  const platform = generatePlatform([cell], empty);
  for (const [id, side, present] of [['gap.x.0.0', 'east', 0], ['gap.x.-1.0', 'west', 1]] as const) {
    const actual = platform.find(segment => segment.id === id); if (actual === undefined) throw new Error('Missing physical segment');
    const observation = cell.observations?.[side]; if (observation === undefined) throw new Error('Missing physical observations');
    expect(actual).toEqual(generateStrip({ id, axis: 'x', origin: { ...actual.mesh.origin }, profiles: [empty, empty], adjacent: [cell],
      observations: present === 0 ? [observation, { entryWidth: 0 }] : [{ entryWidth: 0 }, observation] }));
  }
});
