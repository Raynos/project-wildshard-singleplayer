import { expect, test } from 'vitest';
import { runtimeMirrorIssues } from '../src/sdk/runtimeMirrors';
import { RUNTIME_MIRRORS } from '../src/shards/pine-hollow/data/runtimeMirrors';
import { LONGBOW_ARROW } from '../src/shards/pine-hollow/data/longbowLook';
import * as runtimeConst from '../src/shards/pine-hollow/runtime/const';

// P2a spec §2.3 / review item 8: Pine's runtime/const.ts copies must equal the data/ values they mirror.
test('Pine runtime/const.ts mirrors data/ exactly', () => {
  expect(runtimeMirrorIssues(RUNTIME_MIRRORS, runtimeConst)).toEqual([]);
});

// The hands pool reader compares these serialized bake keys, including property order.
test("Pine longbow keeps the hands pool input keys", () => {
  expect(JSON.stringify(runtimeConst.LONGBOW_ARROW)).toBe(JSON.stringify(LONGBOW_ARROW));
});
