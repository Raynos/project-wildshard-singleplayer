// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the real native CLI without publishing fixture outputs.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Verify all four shipped native wire files independently.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import * as v from 'valibot';
import before from './fixtures/nalati-place-wires.json' with { type: 'json' };

const native = ['--experimental-transform-types', '--import', './scripts/bake-loader.mjs', '--import', './scripts/generation-level.mjs'];
const shard = '--generation-shard=nalati-grasslands';

test('fresh native places and specimens preserve all four original wire files', () => {
  execFileSync(process.execPath, [...native, 'src/shards/nalati-grasslands/generators/bake-nalati-painted.mjs', shard, '--check']);
  for (const expected of before.slice(0, 4)) {
    const bytes = readFileSync(expected.path);
    expect({ path: expected.path, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) }).toEqual(expected);
  }
});

test('the independent runtime scatter plan keeps every existing output byte', () => {
  execFileSync(process.execPath, [...native, 'scripts/bake/nalatiDressing.mjs', 'src/shards/nalati-grasslands/generators/dressingPlan.ts', shard, '--check']);
});

test('continuous forest decisions retain the original static stump lost by the bilinear mask', () => {
  const source = `
    import { prepareNalatiDressing } from './scripts/bake/nalatiDressing.mjs';
    import { dressingRecipe } from './src/shards/nalati-grasslands/generators/dressingPlan.ts';
    import { inSpruceClearing, loneSpruceMask, edgeBermAt } from './src/shards/nalati-grasslands/generators/terrainRecipe.ts';
    import { edgeSpruceMask } from './src/shards/nalati-grasslands/generators/edgeRecipe.ts';
    const runtime = await prepareNalatiDressing(dressingRecipe);
    const original = await prepareNalatiDressing(dressingRecipe, (x,z) => inSpruceClearing(x,z) ? 0 : Math.max(loneSpruceMask(x,z),edgeSpruceMask(x,z,edgeBermAt(x,z))));
    console.log(JSON.stringify({ runtime: runtime.plan.stumps.length, original: original.plan.stumps.length }));
  `;
  const output = execFileSync(process.execPath, [...native, '--input-type=module', '--eval', source, '--', shard], { encoding: 'utf8' });
  const counts = v.parse(v.strictObject({ runtime: v.number(), original: v.number() }), JSON.parse(output));
  expect(counts).toEqual({ runtime: 10, original: 11 });
});
