// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed rig bytes the program reads.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { bakeKingKit } from '../src/shards/pine-hollow/generators/kingKit';
import { PINE_KING_KIT } from './fixtures/pine-program';

// The Antler King's lantern, ribcage and core and his lantern spots are baked (src/shards/pine-hollow/generators/kingKit.ts)
// by Pine's program (GR8: publicInputs.ts pineKingKit); the page borrows the named pool and refuses when it is missing.
test('the King kit the program names is the bake of the current rows and hull', async () => {
  const rig = (tier: 'phone' | 'desktop'): Uint8Array => new Uint8Array(readFileSync(`public/assets/pine-hollow/creatures/antler-king-rig${tier === 'phone' ? '.phone' : ''}.rigged.glb`));
  const made = await bakeKingKit(rig), rows = PINE_KING_KIT.rows;
  expect(rows.pool.url).toBe('models/king/kit.glb');
  expect(PINE_KING_KIT.blob.file.name).toBe('models/king/kit.glb');
  expect(rows.pool.parts).toEqual(made.rows.pool.parts);
  expect(rows.lanterns).toEqual(made.rows.lanterns);
  expect(rows.lanterns).toHaveLength(3);
});
