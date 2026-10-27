// oxlint-disable-next-line import/no-nodejs-modules -- Independent original tracked navigation bytes.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { skyNavigationProgram, skyNavigationRows, SKY_NAVIGATION_INPUT, SKY_NAVIGATION_HASH } from '../src/shards/far-reach/generators/navigation';
import type { ProjectGenerationContext } from '../src/sdk/projectGeneration';
import { hashImmutableBytes } from '../src/sdk/immutable';

const original = (): Uint8Array => new Uint8Array(readFileSync(`src/shards/far-reach/${SKY_NAVIGATION_INPUT}`));

test('navigation source retains every original wire byte, cost and critical identity', async () => {
  const bytes = original(), rows = skyNavigationRows(bytes), wire = new TextEncoder().encode(JSON.stringify(rows));
  expect(bytes.byteLength).toBe(8486); expect(hashImmutableBytes(bytes)).toBe(SKY_NAVIGATION_HASH);
  expect(wire.byteLength).toBe(1139);
  expect(hashImmutableBytes(wire)).toBe('5443cd040c33defa75a97cca08a0155c86491170105defcadadc1bb0c9a66e68');
  expect(rows.files).toEqual([{ hash: SKY_NAVIGATION_HASH, kind: 'binary', compressed: 8486, decoded: 310774, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true }]);
  const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: (step, build) => {
    expect(step.inputs).toEqual([SKY_NAVIGATION_INPUT]);
    return Promise.resolve(build(new Map([[SKY_NAVIGATION_INPUT, bytes]])));
  } };
  const published = await skyNavigationProgram(ctx);
  expect(published.rows).toEqual(rows); expect(published.assets.get(SKY_NAVIGATION_HASH)).toEqual(bytes);
  published.assets.get(SKY_NAVIGATION_HASH)?.fill(0); expect(hashImmutableBytes(bytes)).toBe(SKY_NAVIGATION_HASH);
});

test('navigation refuses changed native bytes and malformed cache inventories', async () => {
  const changed = original(); changed[0] = 0;
  expect(() => skyNavigationRows(changed)).toThrow('original hash differs');
  for (const files of [new Map<string, Uint8Array>(), new Map([['navigation.bin', changed]]), new Map([['navigation.bin', original()], ['extra.bin', original()]])]) {
    const ctx: Pick<ProjectGenerationContext, 'cached'> = { cached: () => Promise.resolve(files) };
    await expect(skyNavigationProgram(ctx)).rejects.toThrow();
  }
});
