import { expect, test } from 'vitest';
import { runtimeMirrorIssues } from '../src/sdk/runtimeMirrors';
import { RUNTIME_MIRRORS } from '../src/shards/pine-hollow/generators/runtimeMirrors';
import * as runtimeConst from '../src/shards/pine-hollow/runtime/const';

// P2a spec §2.3 / review item 8: Pine's runtime/const.ts copies must equal the data/ values they mirror.
test('Pine runtime/const.ts mirrors data/ exactly', () => {
  expect(runtimeMirrorIssues(RUNTIME_MIRRORS, runtimeConst)).toEqual([]);
});
