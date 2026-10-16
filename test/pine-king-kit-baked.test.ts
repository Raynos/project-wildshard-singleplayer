// oxlint-disable-next-line import/no-nodejs-modules -- The committed pool is named by its own SHA-256.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed rig and pool bytes the bake reads.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { bakeKingKit } from '../src/shards/pine-hollow/generators/kingKit';
import rows from '../src/shards/pine-hollow/data/kingKit.generated.json' with { type: 'json' };

// The Antler King's lantern, ribcage and core and his lantern spots are baked (src/shards/pine-hollow/generators/kingKit.ts):
// the page borrows the committed pool and refuses when it is missing. Editing generators/kingKit.ts's kit rows, its rack row or his
// hull means re-running bake-king-kit.mjs.
test('the committed King kit is the bake of the current rows and hull', async () => {
  const rig = (tier: 'phone' | 'desktop'): Uint8Array => new Uint8Array(readFileSync(`public/assets/pine-hollow/creatures/antler-king-rig${tier === 'phone' ? '.phone' : ''}.rigged.glb`));
  const made = await bakeKingKit(rig);
  const hash = createHash('sha256').update(made.glb).digest('hex');
  expect(rows.pool.url).toBe(`/assets/pine-hollow/baked/${hash}.glb`);
  expect(new Uint8Array(readFileSync(`public${rows.pool.url}`))).toEqual(made.glb);
  expect(rows.pool.parts).toEqual(made.rows.pool.parts);
  expect(rows.lanterns).toEqual(made.rows.lanterns);
  expect(rows.lanterns).toHaveLength(3);
});
