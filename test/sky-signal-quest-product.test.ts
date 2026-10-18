import { expect, test } from 'vitest';
import { readProjectAssets } from '../src/sdk/project';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parsePersistedQuestPage } from '../src/sdk/quests';
import skyPage from '../src/shards/far-reach/data/questPage.generated.json' with { type: 'json' };
import signalPage from '../src/shards/sunscar-dunes/data/questPage.generated.json' with { type: 'json' };
import signalPhysics from '../src/shards/sunscar-dunes/data/physics.generated.json' with { type: 'json' };
import skyPrompts from '../src/shards/far-reach/data/questPrompts.generated.json' with { type: 'json' };
import { SKY_SPOTS, SKY_ACT, SKY_INTERACT, QUEST_STEP, ROOST_IDS } from '../src/shards/far-reach/generators/questPrompts';
import { KEEPER_AT } from '../src/shards/far-reach/generators/quests';
import type { QuestHostRow } from '../src/format/questHost';

/** Z7 changes only presentation dispatch: project ids back to the original
 * visible/light calls so the complete frozen quest policy stays checked. */
function originalSignalPresentation(host: QuestHostRow | null | undefined): unknown {
  if (host?.page?.bindings?.labels === undefined || host.page.bindings.visible === undefined || host.page.bindings.calls === undefined || host.page.initial === undefined) throw new Error('Missing Signal page');
  const page = host.page, bindings = page.bindings;
  const effects = (rows: typeof page.actions[number]['after']): unknown[] | undefined => rows?.flatMap<unknown>(row => {
    if (row.kind === 'label' && row.target === 'signal') return [];
    if (row.kind !== 'emitter') return [row];
    if (row.target === 'signal') return [{ kind: 'call', target: 'catch-fire' }];
    const id = row.target.slice('brazier.'.length);
    return [{ kind: 'visible', target: `fire.${id}`, value: row.value }, { kind: 'call', target: `glow.${id}` }];
  });
  return { ...host, page: { ...page, bindings: { ...bindings,
    labels: bindings?.labels?.filter(row => row.target !== 'signal'),
    visible: bindings?.visible?.flatMap(row => row.target.startsWith('oil.') ? [row, { ...row, target: row.target.replace('oil.', 'fire.'), path: ['braziers', Number(row.target.slice(4)), 'parts', 'fire', 'visible'] }] : [row]),
    calls: [...(bindings?.calls?.filter(row => row.target === 'haul') ?? []),
      { target: 'catch-fire', owner: 'commands', path: ['catchFire'] },
      ...(bindings?.calls?.filter(row => row.target === 'summon') ?? []),
      ...[0, 1, 2].map(id => ({ target: `glow.${String(id)}`, owner: 'world', path: ['braziers', id, 'parts', 'glow'], args: [true] }))],
  }, actions: page.actions.map(row => Object.assign(structuredClone(row), { before: effects(row.before), after: effects(row.after) })),
  initial: page.initial?.map(row => Object.assign(structuredClone(row), { effects: effects(row.effects) })) } };
}

// Shipping declarations frozen before the quest authoring modules left data/.
// The moved scout source path is diagnostic metadata, normalized below.
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
      const value = slug === 'sunscar-dunes' && section === 'questHost' ? originalSignalPresentation(loaded.shard.questHost) : loaded.shard[section];
      const bytes = new TextEncoder().encode(JSON.stringify(value).replaceAll('sunscar-dunes/generators/questPresentation.ts', 'sunscar-dunes/data/questPresentation.ts'));
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
