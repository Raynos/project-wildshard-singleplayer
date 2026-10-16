import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { SECTIONS } from '../src/shards/pine-hollow/runtime/sections';
import { HUNTER_HANDS } from '../src/shards/pine-hollow/data/handsLook';
import { LONGBOW_LOOK, StaveBowLookSchema } from '../src/shards/pine-hollow/generators/longbowLook';
import { LEVER_HAND_HOLDS } from '../src/shards/pine-hollow/runtime/items/leverPresentation';
import { CROSSBOW_HAND_HOLDS } from '../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';

// The hands are baked (src/shards/pine-hollow/generators/handsPool.ts) and reach the client as custom/handsPool: a weapon
// hold the bake does not carry refuses at kit build. Editing a hold means re-running bake-hands-pool.mjs with the
// generator's HAND_SPECS row edited to match.
test('every Pine weapon hold and the Longbow look are in the emitted hands pool', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow'), custom = loaded.output.custom;
  const row = custom?.sections.find(entry => entry.name === 'custom/handsPool'), bytes = row === undefined ? undefined : custom?.files.get(row.path);
  if (bytes === undefined) throw new Error('Pine output has no custom/handsPool');
  const pool = v.parse(SECTIONS['custom/handsPool'], JSON.parse(new TextDecoder().decode(bytes)));
  const hands: Readonly<Record<string, unknown>> = pool.hands;
  for (const hold of [CROSSBOW_HAND_HOLDS, LEVER_HAND_HOLDS]) {
    for (const [side, mirror] of [['left', true], ['right', false]] as const) {
      const spec = { ...hold[side].spec, mirror };
      expect(hands[JSON.stringify([HUNTER_HANDS, spec, spec.elbow !== undefined])], side).toBeDefined();
    }
  }
  // the held bow draw (heldLauncher heldBowProfile) reads the bake's serialised look and arrow
  expect(pool.bow.look).toBe(JSON.stringify(LONGBOW_LOOK));
  expect(v.parse(StaveBowLookSchema, JSON.parse(pool.bow.look))).toEqual(LONGBOW_LOOK);
  expect(() => v.parse(StaveBowLookSchema, { ...LONGBOW_LOOK, gripH: Infinity })).toThrow();
  expect(() => v.parse(StaveBowLookSchema, { ...LONGBOW_LOOK, extra: true })).toThrow();
  expect(pool.bow.arrow).toBe(JSON.stringify(LONGBOW_LOOK.arrow));
  expect(loaded.output.namedFiles?.some(file => file.name === pool.pool.url)).toBe(true);
}, 30000);
