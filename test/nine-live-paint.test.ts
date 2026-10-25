// oxlint-disable-next-line import/no-nodejs-modules -- Pin only the authored image bytes used by the live layer contract.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { NINE_WORLD_SCENES } from './fixtures/nine-product-inputs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import before from './fixtures/nine-live-paint.json' with { type: 'json' };
import light from '../src/shards/nine-dragon-stack/data/light.json' with { type: 'json' };
import filament from '../src/shards/nine-dragon-stack/data/filament.json' with { type: 'json' };
import { parseFilamentRows, parseGlowRows, parseHaloState } from '../src/shards/nine-dragon-stack/generators/sections';

test('the live layers retain every look, URL and original image byte in both tiers', () => {
  const rows = NINE_WORLD_SCENES.lent.filter(row => row.kind === 'layers');
  expect(rows).toEqual(before.rows);
  const files = rows.flatMap(row => row.layers.flatMap(layer => ['', ...(layer.alpha ? ['-a'] : [])].flatMap(suffix =>
    ['.jpg', '.phone.webp'].map(extension => {
      const url = `${row.base}/${layer.name}${suffix}${extension}`, bytes = readFileSync(`public${url}`);
      return { url, bytes: bytes.byteLength, hash: hashImmutableBytes(bytes) };
    }))));
  expect(files).toEqual(before.files);
});

test('ordinary authored JSON keeps the original uniform arities and additive-alpha state', () => {
  expect(parseFilamentRows(filament)).toEqual(filament);
  expect(parseGlowRows(light.glow)).toEqual(light.glow);
  expect(parseHaloState(light.haloState)).toEqual(light.haloState);
  expect(() => parseFilamentRows({ ...filament, uRes: { v2: [1] } })).toThrow();
  expect(() => parseGlowRows({ ...light.glow, uGlow: { v4: [1, 2, 3] } })).toThrow();
  expect(() => parseHaloState({ ...light.haloState, blending: 0 })).toThrow();
});
