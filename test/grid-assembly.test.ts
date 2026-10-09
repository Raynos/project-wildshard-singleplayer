import { expect, it, vi } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { parseGridCatalogue } from '../src/game/grid/catalogue';
import catalogue from '../src/game/grid/singleplayer.json';
import { App } from '../src/engine/app/app';
import { Scope } from '../src/engine/app/scope';
import { installBounds } from '../src/engine/world/bounds';

it('assembles shipped, Developer and DEVSERVER grids exclusively from the platform catalogue', () => {
  for (const developer of [false, true]) for (const devserver of [false, true]) for (const nineDragon of [false, true]) {
    const grid = new GridAssembly({ developer, devserver, nineDragon });
    const nine = devserver && nineDragon ? 1 : 0; // G270: five real shards, Template 1, two plots and Template 2's slot (Developer: Blender Template)
    expect(grid.cells).toHaveLength(6 + nine + (developer ? 1 : 0)); expect(grid.plots).toHaveLength(3 - nine - (developer ? 1 : 0)); expect(new Set([...grid.cells, ...grid.plots].map((cell) => cell.instance)).size).toBe(9);
    expect(grid.cell('driftwood-isle').cell).toEqual([0, 0]);
    expect(grid.cell('pine-hollow').cell).toEqual([0, 1]);
    expect(grid.cell('nalati-grasslands').cell).toEqual([1, 0]);
    expect(grid.at(-555, 0)?.slug).toBe('sunscar-dunes');
    expect(grid.at(0, -555)?.slug).toBe('far-reach');
    expect(grid.at(555, -555)?.slug).toBe(devserver && nineDragon ? 'nine-dragon-stack' : undefined);
    expect(grid.plots.map((plot) => plot.instance)).toEqual(['open-plot-nw', ...(developer ? [] : ['open-plot-sw']), ...(nine === 1 ? [] : ['open-plot-se'])]);
    expect(grid.cells.filter((cell) => cell.slug === '_template')).toHaveLength(1);
    expect(grid.at(-555, -555)?.slug).toBe(developer ? 'blender-template' : undefined);
  }
  expect(new GridAssembly({ developer: false, devserver: true }).at(555, -555)?.slug).toBe('nine-dragon-stack');
  expect(catalogue.placements).toHaveLength(8);
});

it('admits G258 Pine, Nalati, Sky Reach and G270 Signal Dunes in the same public and Developer cells', () => {
  const publicGrid = new GridAssembly({ developer: false, devserver: false });
  const developerGrid = new GridAssembly({ developer: true, devserver: false });
  for (const slug of ['pine-hollow', 'nalati-grasslands', 'far-reach', 'sunscar-dunes']) {
    expect(catalogue.grid.cells.some(cell => cell.slug === slug)).toBe(true);
    expect(catalogue.grid.developer.some(cell => cell.slug === slug)).toBe(false);
    expect(publicGrid.cell(slug)).toEqual(developerGrid.cell(slug));
  }
  expect(publicGrid.cells.map(cell => cell.slug)).toEqual(['pine-hollow', '_template', 'sunscar-dunes', 'driftwood-isle', 'nalati-grasslands', 'far-reach']);
  // Template 2 stays Developer-only until Jake's board (G260): publicly its slot is the SW open plot
  expect(publicGrid.cells.some(cell => cell.slug === 'blender-template')).toBe(false);
  expect(developerGrid.cell('blender-template-1').cell).toEqual([-1, -1]);
});

it('keeps stable instance ids independent of signed coordinates and derives reversible per-cell render origins', () => {
  const moved = structuredClone(catalogue.grid), first = moved.cells[1], second = moved.cells[2];
  if (first === undefined || second === undefined) throw new Error('Missing template and Signal Dunes cells');
  [first.cell, second.cell] = [second.cell, first.cell];
  const grid = new GridAssembly({ developer: false, devserver: false }, moved), cell = grid.cell('template-2');
  expect(cell.cell).toEqual([-1, 0]); expect(grid.renderOrigin(cell)).toEqual({ x: -555, y: 0, z: 0 });
  const point = { x: -249.75, y: -2.5, z: 240.125 };
  expect(grid.local(grid.world(point, cell), cell)).toEqual(point); expect(point).toEqual({ x: -249.75, y: -2.5, z: 240.125 });
  expect(grid.at(277.5, 0)).toBeUndefined();
  expect(() => grid.at(Number.NaN, 0)).toThrow('finite');
  expect(Object.isFrozen(cell.origin)).toBe(true);
});

it('supplies an explicit open-sea fog profile for every missing outer neighbour', () => {
  const grid = new GridAssembly({ developer: false, devserver: false }), corner = grid.cell('template-2');
  expect(grid.neighbour(corner, 'west')).toBe(grid.cell('pine-hollow'));
  expect(grid.neighbour(corner, 'north')).toBe(grid.emptyNeighbour); expect(grid.neighbour(corner, 'east')).toBe(grid.emptyNeighbour);
  expect(grid.emptyNeighbour.level).toBe(0); expect(grid.emptyNeighbour.edge.heights).toHaveLength(257);
  expect(grid.emptyNeighbour.edge.heights.every((value) => value === 0)).toBe(true); expect(grid.emptyNeighbour.fog.far).toBeGreaterThan(grid.emptyNeighbour.fog.near);
});

it('lets the template pass all four cell entrances without legacy horizontal recovery while preserving standalone bounds and falls', () => {
  const app = new App(), scope = new Scope('grid.bounds'), assembly = new GridAssembly({ developer: false, devserver: false });
  const spawn = vi.fn<(x: number, z: number, yaw: number, y: number) => void>(), toSpawn = vi.fn<() => void>();
  const player = { position: { x: 0, y: 0, z: 0 }, yaw: 0.2, onGround: true, hover: false, spawn }; let grid = true;
  const bounds = { x0: -100, x1: 100, z0: -100, z1: 100, floor: -20 };
  installBounds(app, scope, bounds, { player, toSpawn, grid: () => grid && assembly.boundsMode(), suspended: () => false, floorAt: () => 0 });
  const system = app.systemsByPhase().update[0]; if (system === undefined) throw new Error('Missing bounds system');
  for (const axis of ['x', 'z'] as const) for (const direction of [-1, 1]) {
    for (const travel of [1, -1]) for (let step = 0; step <= 580; step++) {
      player.position.x = 0; player.position.z = 0;
      const requested = direction * travel * (step - 290); player.position[axis] = requested;
      system.run(1 / 60, 0); expect(player.position[axis]).toBe(requested);
    }
  }
  expect(spawn).not.toHaveBeenCalled(); expect(toSpawn).not.toHaveBeenCalled();
  player.position.y = -21; system.run(1 / 60, 0); expect(toSpawn).toHaveBeenCalledOnce(); expect(spawn).not.toHaveBeenCalled();
  // G129 delegates grid falls to its owner; standalone still establishes and uses its own 0.2 s soft checkpoint.
  player.position.y = 0; grid = false; player.position.x = 0; player.position.z = 0;
  for (let tick = 0; tick < 13; tick++) system.run(1 / 60, 0);
  player.position.x = 101; system.run(1 / 60, 0); expect(spawn).toHaveBeenCalledOnce();
  player.position.x = 0; player.position.y = -21; system.run(1 / 60, 0); expect(spawn).toHaveBeenCalledTimes(2);
  expect(toSpawn).toHaveBeenCalledOnce();
  scope.dispose(); expect(app.systemsByPhase().update).toEqual([]);
});

it('rejects duplicate instances/cells and malformed signed coordinates before assembly', () => {
  const data = catalogue.grid, first = data.cells[0]; if (first === undefined) throw new Error('Missing catalogue cell');
  expect(() => parseGridCatalogue({ ...data, cells: data.cells.map((row, index) => index === 1 ? first : row) })).toThrow();
  expect(() => parseGridCatalogue({ ...data, cells: data.cells.map((row, index) => index === 0 ? { ...row, cell: [2, 0] } : row) })).toThrow();
  expect(() => parseGridCatalogue({ ...data, developer: [{ ...first, cell: [0.5, 0] }] })).toThrow();
});
