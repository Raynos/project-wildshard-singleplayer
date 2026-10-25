import { expect, test } from 'vitest';
import configSource from '../src/shards/open-plots/shard.config.ts?raw';
import { declarationOnlyConfig } from '../scripts/shard-platform.mjs';
import declared from '../src/shards/open-plots/outputs.json' with { type: 'json' };
import project, { outputs } from '../src/shards/open-plots/shard.config';
import layout from '../src/shards/open-plots/data/layouts/night-market.json' with { type: 'json' };
import { GridAssembly } from '../src/game/grid/assembly';

// G604: the open-plots entry is a thin declaration (its products assemble in generators/product.ts at build time), one
// product per idea row
test('the open-plots entry is declaration-only and declares one product per idea', () => {
  expect(declarationOnlyConfig(configSource)).toBe(true);
  expect(Object.keys(outputs)).toEqual(declared.outputs.map(row => row.slug));
  for (const row of declared.outputs) expect(outputs[row.slug]).toMatchObject({ identity: { slug: row.slug }, accent: row.accent, world: { glb: `assets/${row.idea}/world.glb` } });
  expect(project).toEqual(outputs[declared.outputs[0]?.slug ?? '']);
});

test('Night Market road B lowers only its layout curtain and keeps road A posters', () => {
  const grid = new GridAssembly({ developer: false, devserver: false });
  const low = grid.cells.filter(cell => cell.edgeLook !== undefined);
  expect(low.map(cell => cell.slug)).toEqual(['open-plot-night-market', 'open-plot-night-market']);
  for (const cell of low) expect(cell.edgeLook).toEqual({ height: 1.2 });
  expect(layout.posters.entry).toMatchObject({ width: 10, bottom: 0.6, inset: 247, posts: 4, offset: 12.5 });
});
