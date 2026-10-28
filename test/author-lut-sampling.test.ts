import { expect, test } from 'vitest';
import { COLOUR_LUT_EDGE, COLOUR_LUT_CHANNELS } from '../src/format/colourLut';
import { LUT_SIZE } from '../src/engine/render/lut';
import { colourLutSampleTransform } from '../src/sdk/bake/materialGraph';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { compositeRow } from '../src/shards/nine-dragon-stack/generators/compositeGraph';

test('native cube storage and author texel centres retain the fitted 33-cube contract', () => {
  expect(COLOUR_LUT_EDGE).toBe(33);
  expect(COLOUR_LUT_CHANNELS).toBe(4);
  expect(LUT_SIZE).toBe(33);
  const transform = colourLutSampleTransform();
  expect(transform).toEqual({ scale: (33 - 1) / 33, offset: 0.5 / 33 });
  for (const value of [0, 0.1, 0.5, 0.9, 1])
    expect(value * transform.scale + transform.offset).toBe(value * ((33 - 1) / 33) + 0.5 / 33);
  expect(colourLutSampleTransform()).not.toBe(transform);
});

test('all three original Nine post graphs, links and pass order remain byte-identical', () => {
  const bytes = new TextEncoder().encode(JSON.stringify(compositeRow()));
  expect(bytes.byteLength).toBe(77350);
  expect(hashImmutableBytes(bytes)).toBe('bc3650202fa79520e5a63bd6752c266d2c485ca9dee15ffc1ba4906d83f493ed');
});
