import { expect, test } from 'vitest';
import * as v from 'valibot';
import { readProjectAssets } from '../src/sdk/project';
import { HeldEquipmentSchema } from '../src/format/heldEquipment';
import { outputPlatformPayloads } from '../src/sdk/outputProduct';
import { HUNTER_HANDS, HANDS_MATERIAL, COAT_MATERIAL } from '../src/shards/pine-hollow/generators/handsLook';
import { LONGBOW_LOOK, StaveBowLookSchema } from '../src/shards/pine-hollow/generators/longbowLook';
import LEVER_DETAILS from '../src/shards/pine-hollow/data/leverDetails.json' with { type: 'json' };
import { ARROW_MATERIAL, LONGBOW_MATERIAL, LONGBOW_POSES } from '../src/shards/pine-hollow/generators/longbowPresentation';
import { CROSSBOW_HAND_HOLDS } from '../src/shards/pine-hollow/generators/crossbowRows';

// The hands are baked (src/shards/pine-hollow/generators/handsPool.ts) and reach the client as custom/handsPool: a weapon
// hold the bake does not carry refuses at kit build. Editing a hold means re-running bake-hands-pool.mjs with the
// generator's HAND_SPECS row edited to match.
test('every Pine weapon hold and the Longbow look are in the emitted hands pool', async () => {
  const loaded = await readProjectAssets('src/shards/pine-hollow');
  const held = v.parse(HeldEquipmentSchema, outputPlatformPayloads(loaded.output.platform,['held/equipment']).get('held/equipment'));
  const pool = held.hands;
  const hands: Readonly<Record<string, unknown>> = pool.hands;
  for (const [side, mirror] of [['left', true], ['right', false]] as const) {
    const spec = { ...CROSSBOW_HAND_HOLDS[side].spec, mirror };
    expect(hands[JSON.stringify([HUNTER_HANDS, spec, spec.elbow !== undefined])], side).toBeDefined();
    // The rifle reads the same baked part without recreating its palette/spec key at runtime.
    expect(Object.values(pool.hands).find(hand => hand.geometry === `hand-lever-${side}`), side).toBeDefined();
    expect(LEVER_DETAILS.rows.hands[side].at).toHaveLength(3);
  }
  expect(pool.presentation).toEqual({hands:HANDS_MATERIAL,coat:COAT_MATERIAL});
  expect(pool.heldBow.bow.materials).toEqual({bow:{name:'longbow',look:LONGBOW_MATERIAL},arrow:{name:'longbow-arrow',look:ARROW_MATERIAL}});
  expect(pool.heldBow.bow.poses).toEqual(LONGBOW_POSES);
  expect(() => v.parse(HeldEquipmentSchema.entries.hands, { ...pool, presentation: undefined })).toThrow();
  expect(() => v.parse(HeldEquipmentSchema.entries.hands, { ...pool, presentation: { ...pool.presentation, extra: true } })).toThrow();
  // the crossbow's section hand rows name baked hands (runtime Crossbow.ts borrows them by part)
  const rows = held.launcher.rows, parts = Object.values(pool.hands).map(hand => hand.geometry);
  expect(parts).toEqual(expect.arrayContaining([`hand-${rows.hands.left.part}`, `hand-${rows.hands.right.part}`]));
  expect(rows.hands.left.elbow).toEqual(CROSSBOW_HAND_HOLDS.left.spec.elbow);
  // the held bow draw (heldLauncher heldBowProfile) reads the bake's serialised look and arrow
  expect(pool.heldBow.bow.bake.look).toBe(JSON.stringify(LONGBOW_LOOK));
  expect(v.parse(StaveBowLookSchema, JSON.parse(pool.heldBow.bow.bake.look))).toEqual(LONGBOW_LOOK);
  expect(() => v.parse(StaveBowLookSchema, { ...LONGBOW_LOOK, gripH: Infinity })).toThrow();
  expect(() => v.parse(StaveBowLookSchema, { ...LONGBOW_LOOK, extra: true })).toThrow();
  expect(pool.heldBow.bow.bake.arrow).toBe(JSON.stringify(LONGBOW_LOOK.arrow));
  expect(loaded.output.namedFiles?.some(file => file.name === pool.pool.url)).toBe(true);
}, 30000);
