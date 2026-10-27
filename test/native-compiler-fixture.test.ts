// @vitest-environment happy-dom
import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- A fresh owned cache proves cold compiler injection rather than a shared cache hit.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture's cache stays inside the repository scratch root.
import { resolve } from 'node:path';
import { createProjectGeneration } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { driftwoodGuestFiles } from '../src/shards/driftwood-isle/generators/guestPrograms';
import { nativeCompilers } from './fixtures/nativeCompilers';

test('cold DOM fixture compiles all original guest bytes in native Node', async () => {
  mkdirSync('tmp', { recursive: true });
  const cache = mkdtempSync(resolve('tmp/native-compiler-fixture-'));
  try {
    const context = createProjectGeneration('src/shards/driftwood-isle',
      hashImmutableBytes(new TextEncoder().encode('native-compiler-fixture-v1')), new Map(), cache);
    const files = await driftwoodGuestFiles({ ...context, ...nativeCompilers });
    // Independent original byte pins, before moving execution out of happy-dom.
    expect([...files].map(([name, bytes]) => [name, bytes.byteLength, hashImmutableBytes(bytes)])).toEqual([
      ['behaviour/returns.generated.wasm', 6740, 'ba3f8eb53873b6ef51fd116a03e9b2ebc96e68f211f2efe2f6421ee680ca99b1'],
      ['behaviour/returns.generated.json', 2178, '0ad56259e048bc5b8cd62e27df5bfaf568db348677c047ab4a240fdc8484d987'],
      ['behaviour/bridgeSway.generated.wasm', 3027, '693178e1cd72189bcd832d219511e7b357cf57281f8c17e342f3ae27ec9edb6d'],
      ['behaviour/bridgeSway.generated.json', 241, '80e3b175712951210c91b497d251aea503f918c567dadeb745ee2985925621b0'],
      ['assets/25121a8616589da2265bc6d0537c86eabec4d64d26d0bd757268d80dac2cba1b', 1428, '25121a8616589da2265bc6d0537c86eabec4d64d26d0bd757268d80dac2cba1b'],
      ['behaviour/director.json', 265, '8291cc286835c1eec33e0cd8481a78a9ce7a80138d5b3cee6552e019f711840a'],
    ]);
  } finally { rmSync(cache, { recursive: true }); }
}, 60_000);
