// oxlint-disable-next-line import/no-nodejs-modules -- Pin the complete shipping encounter, geometry frame and strike values.
import { createHash } from 'node:crypto';
import { expect, test } from 'vitest';
import layout from '../src/shards/nalati-grasslands/data/kurganLayout.generated.json' with { type: 'json' };
import king from '../src/shards/nalati-grasslands/data/goldenKing.generated.json' with { type: 'json' };
import strikes from '../src/shards/nalati-grasslands/data/strikeProfiles.generated.json' with { type: 'json' };

test('Kurgan JSON preserves every shipping phase, hazard, reward, frame and strike value', () => {
  const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  expect(hash(layout)).toBe('92655243c93910250b44d0dfbb1fcb4a53a166e26238f341ea6b13bdd8fe93be');
  expect(hash(king)).toBe('9163328707cf74ceaed1c70338ade9fd545bb374b09ceab4f81e97208e27c9c6');
  expect(hash(strikes)).toBe('eccb116bc506b17807899b138731b64615ca49e16af01b77a440e18a05533c22');
});
