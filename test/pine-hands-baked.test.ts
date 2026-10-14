import { expect, test } from 'vitest';
import { BAKED_BOW, BAKED_HANDS } from '../src/shards/pine-hollow/boot/handsGeometry';
import { HUNTER_HANDS } from '../src/shards/pine-hollow/runtime/viewmodel/handsLook';
import { LONGBOW_LOOK } from '../src/shards/pine-hollow/runtime/viewmodel/longbowLook';
import { LEVER_HAND_HOLDS } from '../src/shards/pine-hollow/runtime/weapons/LeverRifle';
import { CROSSBOW_HAND_HOLDS } from '../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';

// The hands are baked (src/shards/pine-hollow/generators/handsPool.ts): a weapon hold the bake does not carry refuses at
// kit build. Editing a hold means re-running bake-hands-pool.mjs with the generator's HAND_SPECS row edited to match.
test('every Pine weapon hold and the Longbow look are in the baked hands pool', () => {
  for (const hold of [CROSSBOW_HAND_HOLDS, LEVER_HAND_HOLDS]) {
    for (const [side, mirror] of [['left', true], ['right', false]] as const) {
      const spec = { ...hold[side].spec, mirror };
      expect(BAKED_HANDS[JSON.stringify([HUNTER_HANDS, spec, spec.elbow !== undefined])], side).toBeDefined();
    }
  }
  expect(BAKED_BOW.look).toBe(JSON.stringify(LONGBOW_LOOK));
  expect(BAKED_BOW.arrow).toBe(JSON.stringify(LONGBOW_LOOK.arrow));
});
