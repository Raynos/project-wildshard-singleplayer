import { expect, test } from 'vitest';
import { readProjectAssets } from '../src/sdk/project';
import { encodeCanonicalJson, hashImmutableBytes } from '../src/sdk/immutable';
import { parsePersistedQuestPage } from '../src/sdk/quests';
import skyPage from '../src/shards/far-reach/data/questPage.generated.json' with { type: 'json' };
import signalPage from '../src/shards/sunscar-dunes/data/questPage.generated.json' with { type: 'json' };
import signalPhysics from '../src/shards/sunscar-dunes/data/physics.generated.json' with { type: 'json' };
import skyPrompts from '../src/shards/far-reach/data/questPrompts.generated.json' with { type: 'json' };
import { SKY_SPOTS, SKY_ACT, SKY_INTERACT, QUEST_STEP, ROOST_IDS } from '../src/shards/far-reach/generators/questPrompts';
import { KEEPER_AT } from '../src/shards/far-reach/generators/quests';
import type { QuestHostRow } from '../src/format/questHost';

/** Z1 replaces reflected presentation wiring with typed refs. Keep the whole
 * quest policy frozen independently; typed page effects and restore behavior
 * are exercised by quest-page-refs and the native old-save browser proof. */
function questPolicy(host: QuestHostRow | null | undefined): unknown {
  if (host?.page === undefined || !('version' in host.page)) throw new Error('Missing typed quest page');
  const { page: _page, ...policy } = host;
  return policy;
}

// Shipping declarations frozen before the quest authoring modules left data/.
// The moved scout source path is diagnostic metadata, normalized below.
// Host policy hashes exclude page wiring and canonicalize object keys only;
// ordered arrays remain frozen from served 8efba3196.
const originals = {
  "far-reach": {
    "quests": "21786c235b2d674a50c42fe406f31f37d5be6bcf0e61815fb70f4149760236f3",
    "questHost": "de048c78f4d74eaee91cb300ab78b1ac4dd6d1b29d912dace279e1aeba9ce834",
    "questNpcs": "f03d377e765fb40c3b216f3f854540cfcfa98db86ebf41494a307dc2a1d5162a",
    "directors": "60636cf8f62e82711453682214b9db601601a8cfd08916507f789fb395696552"
  },
  "sunscar-dunes": {
    "quests": "cac62e37c6ca08f7ff9f32f631158fdabc08edf7c96c40b9ecac1b27c6687e1f",
    "questHost": "7725a5c17e9c4c3b03682562fc477451f9c996d431858071ebbefd0be29c34f6",
    "questNpcs": "345e20349d6b80a3ea8040db300006faef26a616c73c72fe5f1f2a4dd80389b0",
    "directors": "097f9e20ec53f14caea6f9cd120adf620ac67de78cf6ee62bfd1ef3c497fdc54"
  }
} as const;

for (const slug of ['far-reach', 'sunscar-dunes'] as const) {
  test(`${slug} compiles identical quest, NPC and director continuations`, async () => {
    const loaded = await readProjectAssets(`src/shards/${slug}`);
    for (const section of ['quests', 'questHost', 'questNpcs', 'directors'] as const) {
      const value = section === 'questHost' ? questPolicy(loaded.shard.questHost) : loaded.shard[section];
      const serialized = section === 'questHost' ? encodeCanonicalJson(value) : JSON.stringify(value);
      const bytes = new TextEncoder().encode(serialized.replaceAll('sunscar-dunes/generators/questPresentation.ts', 'sunscar-dunes/data/questPresentation.ts'));
      expect(hashImmutableBytes(bytes), section).toBe(originals[slug][section]);
    }
  }, 30_000);
}

// Frozen before moving page composition: strings, model, places, repairs,
// captures, finish flags, camera and persistence all retain their exact bytes.
for (const [slug, page, hash] of [
  ['far-reach', skyPage, '5bde92d1d3e601d20518a33a204c26cb117e5432cb8403720726a921860c12ac'],
  ['sunscar-dunes', signalPage, '50f8d95f610b2ab6faa67abe3ee7c83253ad3d4ca6d833c65a5a21143d27ed9b'],
] as const) {
  test(`${slug} retains the original saved page policy`, () => {
    expect(hashImmutableBytes(new TextEncoder().encode(JSON.stringify(page)))).toBe(hash);
    expect(parsePersistedQuestPage(page)).toEqual(page);
    expect(() => parsePersistedQuestPage({ ...page, persistence: { reward: { kind: 'other', key: 'paid', legacy: 'paid' } } })).toThrow();
    expect(() => parsePersistedQuestPage({ ...page, unexpectedCursor: 1 })).toThrow();
  });
}

test('Sky prompt compilation retains native command and position order', () => {
  expect(skyPrompts).toEqual({ SKY_INTERACT, SKY_ACT, QUEST_STEP, SKY_SPOTS, ROOST_IDS, KEEPER_AT });
});

// Frozen from the exact 5c6e5ff49 physics producer before moving its scout source.
test('moving the scout author changes no physics or prompt bytes', () => {
  const original = JSON.stringify(signalPhysics).replaceAll('sunscar-dunes/generators/questPresentation.ts', 'sunscar-dunes/data/questPresentation.ts');
  expect(hashImmutableBytes(new TextEncoder().encode(`${original}\n`))).toBe('e72089068751162e0321825165cafc33a2efe18d9123e75bc8e8ce0966f3ba64');
});
