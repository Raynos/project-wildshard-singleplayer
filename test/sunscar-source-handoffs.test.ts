import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import * as models from '../src/shards/sunscar-dunes/generators/rows/files';
import * as surfaces from '../src/shards/sunscar-dunes/generators/rows/surfaces';
import { SIGNAL_PIECES as pieces } from '../src/shards/sunscar-dunes/generators/rows/pieces';
import cues from '../src/shards/sunscar-dunes/data/cues.json' with { type: 'json' };
import { heldPlayback } from '../src/shards/sunscar-dunes/generators/heldPlayback';

// Captured from the original signal-view-data / signal-held-playback outputs
// before GR4 removes their JSON handoffs. Canonicalization ignores object-key
// enumeration only; every ordered array and numeric/string value stays pinned.
const rows = { models, surfaces, pieces, cues, playback: heldPlayback() };
const originals = {
  "models": "435326655c23a2b60a49c412b2c22ca90a20642411403e963e12ce83683d23aa",
  "surfaces": "fe3d5a65e365f6d509e8dc0ba37012c2f7ef3d7918dbb7058f2571207c2dff83",
  "pieces": "c4a9e1d9e8bfb22f278ce7422701b02fa8ef7b4483f8ff74bf93555f9dc4e7be",
  "cues": "c94bf77d00aca3336f327b5d980f707b3bc0d26eed28831b1e538d6f5e08d339",
  "playback": "106bbca67f251316e23f95be7f91dd4db1516aa82f3b7bee8aee64e57c3330f1"
};

for (const name of Object.keys(rows) as (keyof typeof rows)[]) {
  test(`Sunscar ${name} keeps the original product values`, () => {
    const bytes = new TextEncoder().encode(encodeCanonicalJson(rows[name]));
    expect(hashImmutableBytes(bytes)).toBe(originals[name]);
  });
}
