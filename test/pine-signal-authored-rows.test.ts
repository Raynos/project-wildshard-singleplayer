import { expect, test } from 'vitest';
import * as v from 'valibot';
import sky from '../src/shards/pine-hollow/data/sky.json' with { type: 'json' };
import { KEYED_SKY } from '../src/shards/pine-hollow/data/keyedSkyRows';
import { PINE_KEYED_DAY } from '../src/shards/pine-hollow/look/dayKeys';
import { FIRE_GRAPHS } from '../src/shards/sunscar-dunes/generators/fireLook';
import { signalProductRows } from '../src/shards/sunscar-dunes/generators/product';
import { hashImmutableBytes } from '../src/sdk/immutable';

// Evaluated before conversion at 192f37727: every sky key, light preset,
// derived phase, overcast operation and fire graph node is included.
for (const [label, rows, hash] of [
  ['Pine sky', sky, '56cf6753cf02554a8656dc7edbaa1bfb05407991a54f0cc6331aca69eeb313d9'],
  ['Signal fire', FIRE_GRAPHS, '5c6f2cb819c2a06a8ca52884643da110f62f0890636e19520a7c73e79b5286a4'],
] as const) {
  test(`${label} retains the complete original evaluated rows`, () => {
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(rows)))).toBe(hash);
  });
}

test('the keyed clock consumes the authored sky JSON', () => {
  expect(PINE_KEYED_DAY.style).toEqual(sky);
});

test('the clock boundary refuses malformed tuples and weather field kinds', () => {
  expect(v.safeParse(KEYED_SKY, { ...sky, dusk: [0.06] }).success).toBe(false);
  expect(v.safeParse(KEYED_SKY, { ...sky, overcast: [{ op: 'grey', key: 'lightI', by: 0.6, tint: [1, 1, 1] }] }).success).toBe(false);
});

test('the admitted Signal product contains the complete offline fire graphs', () => {
  const product = signalProductRows();
  for (const [id, graph] of Object.entries(FIRE_GRAPHS)) {
    expect(product.look.materials[id]).toEqual({ family: 'graph', graph });
  }
});
