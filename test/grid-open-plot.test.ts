// oxlint-disable-next-line import/no-nodejs-modules -- The billboard pictures ship as files under public/.
import { statSync } from 'node:fs';
import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { parseGridCatalogue } from '../src/game/grid/catalogue';
import catalogue from '../src/game/grid/singleplayer.json';
import { PLOT_IDEAS, PLOT_SIDES, openPlotGeometry, plotIdeas } from '../src/game/grid/openPlotLayout';
import { openPlotColliders } from '../src/game/grid/openPlot';
import { roadLayout } from '../src/game/grid/roadLayout';
import { GAME_STRINGS } from '../src/game/strings';
import { generatePlatform, type PlatformCell } from '../src/engine/sim/strips';
import { CHUNK_HALF, ENTRY_WIDTH } from '../src/engine/core/config';

it('keeps the three open plots while G258 / G270 open the five real public shards', () => {
  const grid = new GridAssembly({ developer: false, devserver: false });
  const ring = [[-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0]] as const;
  const kinds = ring.map(([x, z]) => {
    const cell = grid.cells.find((row) => row.cell[0] === x && row.cell[1] === z);
    if (cell !== undefined) return cell.slug === '_template' ? 'template' : 'shard';
    return grid.plots.some((row) => row.cell[0] === x && row.cell[1] === z) ? 'plot' : 'missing';
  });
  // G270: Signal Dunes holds the west cell; the SW plot is Template 2's slot until Blender Template leaves Developer
  expect(kinds).toEqual(['plot', 'shard', 'template', 'shard', 'plot', 'shard', 'plot', 'shard']);
  // a plot is never a shard cell: no slug, no `at` hit, no instance lookup
  for (const plot of grid.plots) { expect(grid.at(plot.origin.x, plot.origin.z)).toBeUndefined(); expect(() => grid.cell(plot.instance)).toThrow(); }
  // Developer fills the SW plot with Blender Template, the NW plot with Pastel Plain and the SE plot with Ink & Cel Valley (SF59);
  // DEVSERVER's Nine Dragon takes the SE cell over Ink & Cel Valley.
  expect(new GridAssembly({ developer: true, devserver: false }).plots.map((row) => row.instance)).toEqual([]);
  expect(new GridAssembly({ developer: true, devserver: false }).at(555, -555)?.slug).toBe('ink-cel-valley');
  expect(new GridAssembly({ developer: true, devserver: true }).at(555, -555)?.slug).toBe('nine-dragon-stack');
  expect(new GridAssembly({ developer: true, devserver: true }).plots.map((row) => row.instance)).toEqual([]);
});

it('refuses a base layout that leaves a place empty, fills one twice or overrides nothing', () => {
  const data = catalogue.grid, plot = data.plots[0];
  if (plot === undefined) throw new Error('Missing plot');
  expect(() => parseGridCatalogue({ ...data, plots: data.plots.slice(1) })).toThrow();
  expect(() => parseGridCatalogue({ ...data, plots: [...data.plots.slice(1), { ...plot, cell: [0, 0] }] })).toThrow();
  expect(() => parseGridCatalogue({ ...data, plots: [...data.plots, { instance: 'open-plot-x', cell: [0, 0] }] })).toThrow();
  expect(parseGridCatalogue(data).plots).toHaveLength(3);
});

it('shows a different idea at each entry of a plot, a billboard and a demo, and a centrepiece in the middle (G219)', () => {
  for (const ordinal of [0, 1, 2]) {
    const ideas = plotIdeas(ordinal);
    expect(new Set(PLOT_SIDES.map((side) => ideas[side].billboard)).size).toBe(4);
    expect(new Set(PLOT_SIDES.map((side) => ideas[side].demo)).size).toBe(4);
    for (const side of PLOT_SIDES) expect(ideas[side].demo).not.toBe(ideas[side].billboard);
    const g = openPlotGeometry(ordinal);
    expect(g.pictures.indices.length / 6).toBe(4 * 2); // one billboard per entry, a picture on both faces (playtest round 2)
    expect(g.text.indices.length / 6).toBe(4 + 4 + 4); // a survey sign and a demo label per entry, a plaque on each plinth face
    expect(g.holoCards.indices.length / 6).toBe(PLOT_IDEAS.length * 2); // the centrepiece's ring of cards, both faces
    expect(g.solid.positions.every(Number.isFinite)).toBe(true);
    // everything stands inside the plot
    for (let k = 0; k < g.solid.positions.length; k += 3) { expect(Math.abs(g.solid.positions[k] ?? 0)).toBeLessThanOrEqual(CHUNK_HALF); expect(Math.abs(g.solid.positions[k + 2] ?? 0)).toBeLessThanOrEqual(CHUNK_HALF); }
  }
  // all eight pictures ship small
  for (const idea of PLOT_IDEAS) expect(statSync(`public/assets/grid/open-plot/${idea}.webp`).size).toBeLessThanOrEqual(500_000);
});

it('never says upload, and every string comes from the strings table (G219)', () => {
  expect(JSON.stringify(GAME_STRINGS.grid.plot).toLowerCase()).not.toContain('upload');
  expect(GAME_STRINGS.grid.plot.sign).toBe('THIS PLOT IS YOURS TO BUILD');
  expect(GAME_STRINGS.grid.plot.signSub).toBe('BUILT WITH CLAUDE CODE + THE WILDSHARD SDK');
  for (const idea of PLOT_IDEAS) expect(GAME_STRINGS.grid.plot.ideas[idea].length).toBeGreaterThan(0);
});

it('is road-level platform ground: a floor collider over the whole plot and an open turn-in on all four sides', () => {
  const grid = new GridAssembly({ developer: false, devserver: false }), colliders = openPlotColliders(grid.plots);
  expect(colliders).toHaveLength(3);
  for (const [k, mesh] of colliders.entries()) {
    const plot = grid.plots[k]; if (plot === undefined) throw new Error('Missing plot');
    expect(mesh.origin).toEqual({ x: plot.origin.x, z: plot.origin.z });
    expect(Array.from(mesh.positions.subarray(0, 12))).toEqual([-CHUNK_HALF, 0, -CHUNK_HALF, CHUNK_HALF, 0, -CHUNK_HALF, CHUNK_HALF, 0, CHUNK_HALF, -CHUNK_HALF, 0, CHUNK_HALF]);
    expect(Math.max(...mesh.indices)).toBeLessThan(mesh.positions.length / 3);
  }
  const empty = grid.emptyNeighbour.edge, entry = { entryWidth: ENTRY_WIDTH, geometry: 'ground' } as const, sides = { north: empty, east: empty, south: empty, west: empty };
  const cells: PlatformCell[] = [...grid.cells.map((cell) => ({ instance: cell.instance, cell: cell.cell, origin: cell.origin, edges: sides })),
    ...grid.plots.map((plot) => ({ instance: plot.instance, cell: plot.cell, origin: plot.origin, edges: sides, observations: { north: entry, east: entry, south: entry, west: entry } }))];
  const strips = generatePlatform(cells, empty), nw = grid.plots[0];
  if (nw === undefined) throw new Error('Missing plot');
  const around = strips.filter((strip) => strip.duplicates.some((row) => row.instance === nw.instance) && strip.turnIn !== undefined && !strip.id.startsWith('cross'));
  expect(around).toHaveLength(4);
  for (const strip of around) expect(strip.turnIn?.widths.some((width) => width === ENTRY_WIDTH)).toBe(true);
  // and the boulevard signs each plot's four turn-ins
  const layout = roadLayout(grid, (slug) => slug), name = GAME_STRINGS.grid.plot.turnIn;
  expect(layout.signs.filter((sign) => sign.lines.length === 1 && sign.lines[0]?.metres === null && sign.lines[0].names[0] === name)).toHaveLength(12);
});
