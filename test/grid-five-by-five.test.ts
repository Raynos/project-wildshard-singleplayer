import { expect, test } from 'vitest';
import catalogue from '../src/game/grid/singleplayer.json' with { type: 'json' };
import { GridAssembly } from '../src/game/grid/assembly';
import { parseGridCatalogue } from '../src/game/grid/catalogue';
import { GridContinuationCache } from '../src/game/grid/continuations';
import { roadLayout, segmentPoint, RAIL_OFFSET } from '../src/game/grid/roadLayout';
import { PLOT_IDEAS } from '../src/game/grid/plotCellLayout';
import { generatePlatform, type PlatformCell } from '../src/engine/sim/strips';

const modes = [{ developer: false, devserver: false }, { developer: true, devserver: false },
  { developer: false, devserver: true }, { developer: true, devserver: true }] as const;
for (const mode of modes) test(`complete 25-cell layout ${JSON.stringify(mode)}`, () => {
  const assembly = new GridAssembly(mode), placements = [...assembly.cells, ...assembly.plots];
  expect(placements).toHaveLength(25);
  expect(new Set(placements.map(row => row.cell.join(','))).size).toBe(25);
  expect(assembly.cell('driftwood-isle').cell).toEqual([0, 0]);
  expect(assembly.cells.some(row => row.slug === 'nine-dragon-stack')).toBe(mode.developer || mode.devserver);
  for (const slug of ['blender-template', 'pastel-plain', 'ink-cel-valley']) {
    expect(assembly.cells.some(row => row.slug === slug)).toBe(mode.developer);
  }
  if (mode.developer) {
    expect(assembly.cells.filter(row => Math.abs(row.cell[0]) <= 1 && Math.abs(row.cell[1]) <= 1)).toHaveLength(8);
    const ring = (cell: readonly [number, number]): boolean => Math.abs(cell[0]) === 2 || Math.abs(cell[1]) === 2;
    // SF88g: behind Developer an idea's plot may be its open-plots shardfile (instance open-plot-<idea>) in place of the billboard
    const outer = assembly.plots.filter(row => ring(row.cell)), shardfiles = assembly.cells.filter(row => ring(row.cell) && row.instance.startsWith('open-plot-'));
    expect(outer.length + shardfiles.length).toBe(14);
    // G529: the 14 outer plots show each of the 14 ideas once
    expect([...outer.map(row => row.billboard), ...shardfiles.map(row => row.instance.slice('open-plot-'.length))].sort()).toEqual([...PLOT_IDEAS].sort());
  }
  const road = roadLayout(assembly, slug => slug);
  expect(road.segments).toHaveLength(60);
  expect(road.junctions).toHaveLength(36);
  expect(road.junctions.filter(row => row.roundabout)).toHaveLength(16);
  expect(road.segments.filter(row => row.low === undefined || row.high === undefined)).toHaveLength(20);
  expect(road.signs.flatMap(row => row.lines).filter(row => row.metres === null)).toHaveLength(100);
  expect(road.rail).toEqual({ minX: -1387.5 - RAIL_OFFSET, maxX: 1387.5 + RAIL_OFFSET,
    minZ: -1387.5 - RAIL_OFFSET, maxZ: 1387.5 + RAIL_OFFSET });
});

test('refuses holes, duplicate placements and cells beyond the declared square', () => {
  const grid = catalogue.grid;
  expect(() => parseGridCatalogue({ ...grid, plots: grid.plots.slice(1) })).toThrow();
  expect(() => parseGridCatalogue({ ...grid, plots: [...grid.plots.slice(1), { instance: 'duplicate', cell: [0, 0] }] })).toThrow();
  expect(() => parseGridCatalogue({ ...grid, cells: grid.cells.map((row, i) => i === 0 ? { instance: row.instance, slug: row.slug, cell: [3, 0] } : row) })).toThrow();
  const assembly = new GridAssembly({ developer: true, devserver: true, nineDragon: false });
  expect(assembly.cell('nine-dragon-stack').cell).toEqual([1, -1]); // Developer is independent of DEVSERVER.
  expect(new GridAssembly({ developer: false, devserver: true, nineDragon: false }).cells.some(row => row.slug === 'nine-dragon-stack')).toBe(false);
});

test('retains every cell continuation within the unchanged byte pool', () => {
  const cache = new GridContinuationCache(200);
  for (let i = 0; i < 25; i++) cache.store(`c${i}`, '{}');
  expect(cache.state()).toMatchObject({ entries: 25, capacityChars: 200 });
  expect(() => cache.store('overflow', '{}')).toThrow('capacity');
  expect(() => cache.store('c0', 'x'.repeat(200))).toThrow('capacity');
  cache.store('c0', '{}');
});

test('builds every road collider and four turn-ins per cell out to the outer plots', () => {
  const assembly = new GridAssembly(modes[0]), empty = assembly.emptyNeighbour.edge;
  const cells: PlatformCell[] = [...assembly.cells, ...assembly.plots].map(row => ({ instance: row.instance, cell: row.cell, origin: row.origin,
    edges: { north: empty, east: empty, south: empty, west: empty },
    observations: { north: { entryWidth: 8 }, east: { entryWidth: 8 }, south: { entryWidth: 8 }, west: { entryWidth: 8 } } }));
  const strips = generatePlatform(cells, empty), road = roadLayout(assembly, slug => slug);
  expect(strips).toHaveLength(96);
  expect(new Set(strips.map(row => row.id))).toEqual(new Set([...road.segments, ...road.junctions].map(row => row.id)));
  for (const segment of road.segments) {
    const strip = strips.find(row => row.id === segment.id);
    expect(strip?.mesh.origin).toEqual(segment.centre);
    expect(strip?.duplicates.map(row => row.instance).sort()).toEqual([segment.low, segment.high].flatMap(row => row === undefined ? [] : [row.instance]).sort());
    expect(strip?.turnIn).toBeDefined();
    expect(segmentPoint(segment, 0, 0)).toEqual(segment.centre);
  }
});
