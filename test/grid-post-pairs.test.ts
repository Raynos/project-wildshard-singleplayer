// SF59 step 4 at grid placement: a cell is admitted only when its post stack summed with each adjacent admitted cell's
// fits budget v1's per-pixel instructions where their frames blend; the heaviest pair is named, unknown neighbours and
// open sides add nothing, a shared normal pre-pass is paid once.
import { expect, it } from 'vitest';
import { GridAssembly } from '../src/game/grid/assembly';
import { GridPostCosts, gridPostPairRefusal } from '../src/game/grid/postPairs';
import { NO_POST, POST_NORMAL_PREPASS_COST, type PostStackCost } from '../src/game/shardfile/postStack';
import { classifyRefusal } from '../src/game/grid/refusal';

const stack = (instructions: number, normal = false): PostStackCost => ({ passes: 1, instructions, inputs: { colour: true, depth: normal, normal } });

it('refuses a cell whose stack with an admitted neighbour exceeds the blend budget, naming the heaviest pair', () => {
  const grid = new GridAssembly({ developer: false, devserver: false });
  const home = grid.cell('driftwood-isle'), costs = new GridPostCosts();
  // driftwood (0,0) has pine-hollow north (0,1) and nalati east (1,0); nothing admitted yet: placement fits
  expect(gridPostPairRefusal(grid, home, stack(700), (slug) => costs.get(slug))).toBeNull();
  costs.record('pine-hollow', stack(250));
  expect(gridPostPairRefusal(grid, home, stack(700), (slug) => costs.get(slug))).toBeNull();
  costs.record('nalati-grasslands', stack(400));
  const refusal = gridPostPairRefusal(grid, home, stack(700), (slug) => costs.get(slug));
  expect(refusal).toBe('driftwood-isle beside nalati-grasslands: post: ≈ 1100 instructions per pixel at 2× where the two frames blend (at most 1000)');
  // the grid shows it as a budget refusal (the cell screen's "too big")
  expect(classifyRefusal(new Error(refusal ?? ''))).toBe('too-big');
  costs.record('pine-hollow', stack(500));
  expect(gridPostPairRefusal(grid, home, stack(700), (slug) => costs.get(slug))).toContain('beside pine-hollow');
});

it('pays a shared normal pre-pass once and lets an empty stack sit beside anything', () => {
  const grid = new GridAssembly({ developer: false, devserver: false });
  const home = grid.cell('driftwood-isle'), costs = new GridPostCosts();
  costs.record('nalati-grasslands', stack(500 + POST_NORMAL_PREPASS_COST, true));
  expect(gridPostPairRefusal(grid, home, stack(500, true), (slug) => costs.get(slug))).toBeNull();
  expect(gridPostPairRefusal(grid, home, stack(500), (slug) => costs.get(slug))).not.toBeNull();
  expect(gridPostPairRefusal(grid, home, NO_POST, (slug) => costs.get(slug))).toBeNull();
});
