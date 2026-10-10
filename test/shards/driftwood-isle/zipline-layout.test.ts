// oxlint-disable-next-line import/no-nodejs-modules -- Fence the immutable shipping layout oracle, never browser gameplay.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the exact test-only source whose digest the oracle records.
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { ZiplineLayout } from '../../../src/shards/driftwood-isle/runtime/ziplineLayout';
import { ZiplineLayout as ShippingLayout } from '../../fixtures/driftwood-zipline/shipping';
import source from '../../fixtures/driftwood-zipline/source.json';

it('preserves the source-fenced shipping deck, cable, sag and trolley layout across 10k spans', () => {
  expect(createHash('sha256').update(readFileSync(new URL('../../fixtures/driftwood-zipline/shipping.ts', import.meta.url))).digest('hex')).toBe(source.oracleSha256);
  expect(source.revision).toMatch(/^[a-f0-9]{40}$/u);
  expect(source.sourceSha256).toMatch(/^[a-f0-9]{64}$/u);
  const model = readFileSync(new URL('../../../src/shards/driftwood-isle/models/zipline.ts', import.meta.url), 'utf8');
  expect(createHash('sha256').update(model.slice(model.indexOf('/** the rig (deck'))).digest('hex')).toBe(source.geometrySha256);
  let seed = 0x21e;
  const draw = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x1_0000_0000; };
  const actual = new Vector3(), expected = new Vector3();
  for (let i = 0; i < 10_000; i++) {
    const spec = { top: new Vector3(draw() * 500 - 250, draw() * 80, draw() * 500 - 250),
      bottom: new Vector3(draw() * 500 - 250, draw() * 80, draw() * 500 - 250), ...(i % 2 === 0 ? {} : { sag: draw() * 4 }) };
    const page = new ShippingLayout(spec), native = new ZiplineLayout(spec);
    expect(native).toEqual(page);
    for (const s of [-1, 0, 0.4, native.len * draw(), native.len - 1.6, native.len, native.len + 1]) {
      expect(native.at(s, actual)).toBe(actual); page.at(s, expected); expect(actual).toEqual(expected);
    }
    expect(native.park(actual)).toBe(page.park(expected)); expect(actual).toEqual(expected);
  }
});
