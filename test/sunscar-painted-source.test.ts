import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { parsePaintedLook } from '../src/format/paintedLook';
import { signalPaintedPresentation } from '../src/shards/sunscar-dunes/generators/paintedLook';
import { LAST_LIGHT_SUN } from '../src/shards/sunscar-dunes/generators/rows/lightLook';
import { SAND_FILES } from '../src/shards/sunscar-dunes/generators/rows/sand';
import { FLAG, SCOUT_AT, SCOUT_FLAG } from '../src/shards/sunscar-dunes/generators/rows/flags';
import * as questFlags from '../src/shards/sunscar-dunes/generators/rows/signalQuest';
import { FIRE_GRAPH_IDS } from '../src/shards/sunscar-dunes/generators/rows/fire';

// Complete original values; only object-key enumeration is canonicalized.
for (const [name, value, length, hash] of [
  ['look', { look: parsePaintedLook(signalPaintedPresentation()).look, painterSun: LAST_LIGHT_SUN, sand: SAND_FILES }, 1582,
    'fb526a15f54f75eeba24bdaf1339d9160969e0256031b3c9e5e5a58dbc5f714d'],
  ['flags', { FLAG, SCOUT_AT, SCOUT_FLAG, ...questFlags }, 449,
    'c60b948c00791597d030d65b111468e33e5295b296e4ec60817e5a936c97b33f'],
  ['fire programs', FIRE_GRAPH_IDS, 152,
    'b5fdd3bc69b9dc966eece07962cfa625bbd1edec6c92c99d3ddd9ecec5b946a8'],
] as const) {
  test(`source ${name} retains every original painted handoff value`, () => {
    const bytes = new TextEncoder().encode(encodeCanonicalJson(value));
    expect(bytes.length).toBe(length); expect(hashImmutableBytes(bytes)).toBe(hash);
  });
}
