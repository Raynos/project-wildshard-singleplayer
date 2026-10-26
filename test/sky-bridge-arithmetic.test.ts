// oxlint-disable-next-line import/no-nodejs-modules -- Compare every original metadata byte and native geometry input.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare complete binary transport without assertion expansion.
import { Buffer } from 'node:buffer';
import { expect, test } from 'vitest';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { bakeSkyBridges } from '../src/shards/far-reach/generators/bridges';
import { bridgeSine } from '../src/shards/far-reach/generators/bridgeSine';

test('original ARM64 fused sine words survive x64 scalar arithmetic without a host-math fallback', () => {
  expect(bridgeSine(0.3392886991688865)).toBe(0.3328164256565291);
  expect(bridgeSine(0.8568271672563658)).toBe(0.7557686768591273);
  expect(bridgeSine(2.730444621744149)).toBe(0.3996619489850825);
  expect(bridgeSine(0)).toBe(0); expect(bridgeSine(Math.PI / 2)).toBe(1);
  expect(bridgeSine(Math.PI)).toBe(1.2246467991473532e-16);
  for (const phase of [-1, Math.PI + 0.1, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => bridgeSine(phase)).toThrow('Bridge sine phase');
});

test('all original rope rows and binary geometry remain exact after deterministic authoring', async () => {
  const { bin, rows } = await bakeSkyBridges(name => new Uint8Array(readFileSync(`public${name}`)));
  const metadata = Buffer.from(`${JSON.stringify({ pack: hashImmutableBytes(bin), ...rows })}\n`);
  expect(hashImmutableBytes(metadata)).toBe('2f81cd66a88239e22b7266fc04df26475877ddb93085fb65cc265843f97f8eed');
  expect(Buffer.compare(metadata, readFileSync('src/shards/far-reach/data/bridges.json'))).toBe(0);
});
