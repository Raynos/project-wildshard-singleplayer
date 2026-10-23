import { expect, test } from 'vitest';
import configSource from '../src/shards/open-plots/shard.config.ts?raw';
import { declarationOnlyConfig } from '../scripts/shard-platform.mjs';
import declared from '../src/shards/open-plots/outputs.json' with { type: 'json' };
import project, { outputs } from '../src/shards/open-plots/shard.config';

// G604: the open-plots entry is a thin declaration (its products assemble in generators/product.ts at build time), one
// product per idea row
test('the open-plots entry is declaration-only and declares one product per idea', () => {
  expect(declarationOnlyConfig(configSource)).toBe(true);
  expect(Object.keys(outputs)).toEqual(declared.outputs.map(row => row.slug));
  for (const row of declared.outputs) expect(outputs[row.slug]).toMatchObject({ identity: { slug: row.slug }, accent: row.accent, world: { glb: `assets/${row.idea}/world.glb` } });
  expect(project).toEqual(outputs[declared.outputs[0]?.slug ?? '']);
});
