import { expect, test } from 'vitest';
import { readProjectAssets } from '../src/sdk/project';
import { hashImmutableBytes } from '../src/sdk/immutable';

// Shipping declarations frozen before the quest authoring modules left data/.
const originals = {
  "far-reach": {
    "quests": "21786c235b2d674a50c42fe406f31f37d5be6bcf0e61815fb70f4149760236f3",
    "questHost": "64163636051b1ae816676cca0bec61d6bb84667bf09059fe690b854ffcf794ba",
    "questNpcs": "f03d377e765fb40c3b216f3f854540cfcfa98db86ebf41494a307dc2a1d5162a",
    "directors": "60636cf8f62e82711453682214b9db601601a8cfd08916507f789fb395696552"
  },
  "sunscar-dunes": {
    "quests": "cac62e37c6ca08f7ff9f32f631158fdabc08edf7c96c40b9ecac1b27c6687e1f",
    "questHost": "106d6a4c0aa4c8077492eb6abb0e8cd6e9bcaf89616522b1f485195e95498b10",
    "questNpcs": "345e20349d6b80a3ea8040db300006faef26a616c73c72fe5f1f2a4dd80389b0",
    "directors": "097f9e20ec53f14caea6f9cd120adf620ac67de78cf6ee62bfd1ef3c497fdc54"
  }
} as const;

for (const slug of ['far-reach', 'sunscar-dunes'] as const) {
  test(`${slug} compiles identical quest, NPC and director continuations`, async () => {
    const loaded = await readProjectAssets(`src/shards/${slug}`);
    for (const section of ['quests', 'questHost', 'questNpcs', 'directors'] as const) {
      const bytes = new TextEncoder().encode(JSON.stringify(loaded.shard[section]));
      expect(hashImmutableBytes(bytes), section).toBe(originals[slug][section]);
    }
  }, 30_000);
}
