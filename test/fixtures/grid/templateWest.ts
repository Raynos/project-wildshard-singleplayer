import catalogue from '../../../src/game/grid/singleplayer.json' with { type: 'json' };

/**
 * The live-grid mechanism fixtures' grid: the shipped catalogue with a plain Template 1 copy, `template-3`, in the cell
 * west of Driftwood (−1, 0), the cheap regional neighbour these tests cross into, admit, warm and retire. G270 gave that
 * public cell to Signal Dunes; the crossing, durability and residency mechanisms under test do not depend on which shard
 * the shipped layout puts there. Pass it as `new GridAssembly(mode, TEMPLATE_WEST_GRID)`.
 */
export const TEMPLATE_WEST_GRID = {
  ...catalogue.grid,
  cells: catalogue.grid.cells.map((row) => (row.cell[0] === -1 && row.cell[1] === 0 ? { instance: 'template-3', slug: '_template', cell: [-1, 0] } : row)),
};
