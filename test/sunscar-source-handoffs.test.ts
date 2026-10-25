import { expect, test } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import * as models from '../src/shards/sunscar-dunes/generators/rows/files';
import * as surfaces from '../src/shards/sunscar-dunes/generators/rows/surfaces';
import { SIGNAL_PIECES as pieces } from '../src/shards/sunscar-dunes/generators/rows/pieces';
import cues from '../src/shards/sunscar-dunes/data/cues.json' with { type: 'json' };
import { heldPlayback } from '../src/shards/sunscar-dunes/generators/heldPlayback';
import { SIGNAL_EMITTERS as emitters } from '../src/shards/sunscar-dunes/generators/lightEmitters';
import { SIGNAL_CLIENT_PLAN as client } from '../src/shards/sunscar-dunes/generators/clientPlan';

// Captured from the original signal-view-data / signal-held-playback outputs
// before GR4 removes their JSON handoffs. Canonicalization ignores object-key
// enumeration only; every ordered array and numeric/string value stays pinned.
// Emitter/client values were captured at a6f2532a8f before replacing their rest-scene input.
const rows = { models, surfaces, pieces, cues, playback: heldPlayback(), emitters, client };
const originals = {
  "models": "435326655c23a2b60a49c412b2c22ca90a20642411403e963e12ce83683d23aa",
  "surfaces": "fe3d5a65e365f6d509e8dc0ba37012c2f7ef3d7918dbb7058f2571207c2dff83",
  "pieces": "c4a9e1d9e8bfb22f278ce7422701b02fa8ef7b4483f8ff74bf93555f9dc4e7be",
  "cues": "c94bf77d00aca3336f327b5d980f707b3bc0d26eed28831b1e538d6f5e08d339",
  "playback": "106bbca67f251316e23f95be7f91dd4db1516aa82f3b7bee8aee64e57c3330f1",
  "emitters": "f9c6a47f1aabcafa976339b9cd17ca5f919a31eeb688d68ac40474a4abd63822",
  "client": "966e1354ef8333e4188ae6b81b3e114723c2045eba418a83cfa2373bac929951"
};

for (const name of Object.keys(rows) as (keyof typeof rows)[]) {
  test(`Sunscar ${name} keeps the original product values`, () => {
    const bytes = new TextEncoder().encode(encodeCanonicalJson(rows[name]));
    expect(hashImmutableBytes(bytes)).toBe(originals[name]);
  });
}
