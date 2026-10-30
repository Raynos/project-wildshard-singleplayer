import { expect, test } from 'vitest';
import { output, source } from './fixtures/nine-source-program';
import { parseClientPlan } from '../src/format/clientPlan';
import { parseExplorerCatalogue } from '../src/format/explorerCatalogue';
import { parseWorldSceneWeld } from '../src/format/worldSceneWeld';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { explorerRoster } from '../src/game/models/explorerCatalogue';
import { heldArmsGear } from '../src/game/models/heldGear';
import { nameBlob } from '../src/sdk/blobs';
import { WorldRegistry } from '../src/engine/world/registry';
import { modelContext } from '../src/engine/models/model';
import { Scope } from '../src/engine/app/scope';
import { withOwner } from '../src/engine/app/ownership';
import type { RosterEntry } from '../src/engine/models/live';
import heldCards from '../src/shards/nine-dragon-stack/data/heldCards.json' with { type: 'json' };
import heldPrimary from '../src/shards/nine-dragon-stack/data/heldPrimary.json' with { type: 'json' };
import manifest from '../src/shards/nine-dragon-stack/manifest.json' with { type: 'json' };
import { NINE_HELD_CARDS } from '../src/shards/nine-dragon-stack/generators/explorerDeclarations';

const decode = (bytes: Uint8Array): unknown => JSON.parse(new TextDecoder().decode(bytes));
function section(name: string): unknown {
  const bytes = output.platform.files.get(`sections/${name}.json`);
  if (bytes === undefined) throw new Error(`Missing ${name}`);
  return decode(bytes);
}
const catalogue = parseExplorerCatalogue(section('explore/catalogue'));
const cardsFile = output.namedFiles.find(row => row.name === NINE_HELD_CARDS);
const cardsBytes = cardsFile === undefined ? undefined : output.assets.get(cardsFile.hash);
if (cardsBytes === undefined) throw new Error('Missing declared graph card book');
const emittedCards = decode(cardsBytes);
function product(cards: unknown = emittedCards, entries: unknown = catalogue, arms: unknown = heldPrimary): ReturnType<typeof createShardProduct> {
  const blob = nameBlob(NINE_HELD_CARDS, 'json', new TextEncoder().encode(JSON.stringify(cards)));
  return createShardProduct({ slug: source.identity.slug, revision: source.identity.revision, shardfile: source,
    sections: new Map<string, unknown>([['explore/catalogue', entries], ['held/arms', arms]]),
    files: new Map([[NINE_HELD_CARDS, { hash: blob.file.hash, url: blob.file.hash }]]),
    read: hash => {
      if (hash !== blob.file.hash) throw new Error('Unexpected Explorer resource read');
      return Promise.resolve(blob.bytes);
    }, check: true });
}

test('declares exactly the existing six welded place groups without a second binding', () => {
  const file = output.namedFiles.find(row => row.name === 'world/fabric.json');
  const bytes = file === undefined ? undefined : output.assets.get(file.hash);
  if (bytes === undefined) throw new Error('Missing existing frozen fabric');
  const weld = parseWorldSceneWeld(decode(bytes)), plan = parseClientPlan(section('client/plan'));
  const declared = plan.features.find(row => row.kind === 'world.sets');
  if (declared?.kind !== 'world.sets') throw new Error('Missing declared Sets');
  expect(declared.rows).toHaveLength(6);
  expect(declared.rows.map(({ id, name, file: origin, place, pois }) => ({ id, name, file: origin, place, members: pois }))).toEqual(weld.sets);
  expect(new Set(declared.rows.map(row => row.place)).size).toBe(6);
  expect(plan.features.some(row => row.kind === 'world.bind-sets')).toBe(false);
});

function listed(entry: RosterEntry): unknown {
  const scope = new Scope('nf9-card'), registry = new WorldRegistry();
  try {
    withOwner(scope, () => entry.list(modelContext(null), () => [], registry));
    const row = registry.get(`model:${entry.id}`);
    if (row === undefined) throw new Error('Missing card registration');
    // Builders remain the same heldArmsGear implementation; compare all
    // registered data without invoking a renderer or a model's lazy build.
    return JSON.stringify(row);
  } finally { scope.dispose(); }
}

test('declared held card lists the identical original fp-arms metadata without a native roster', async () => {
  expect(manifest.bindings).not.toHaveProperty('roster');
  expect(emittedCards).toEqual(heldCards);
  expect(catalogue.entries).toEqual([{ kind: 'held', item: heldPrimary.primary.item, cards: NINE_HELD_CARDS }]);
  const original = heldArmsGear(heldCards), declared = await explorerRoster(product());
  expect(declared.map(row => row.id)).toEqual(original.map(row => row.id));
  expect(declared.map(listed)).toEqual(original.map(listed));
  expect(declared).toHaveLength(1);
});

test('graph card references refuse foreign owners, presentations, ambiguous cards and unknown items', async () => {
  const row = catalogue.entries[0];
  if (row?.kind !== 'held') throw new Error('Missing held row');
  for (const cards of [
    { ...heldCards, slug: 'other-product' }, { ...heldCards, file: 'other-view.json' },
    { ...heldCards, cards: [...heldCards.cards, { ...heldCards.cards[0], id: 'other-card' }] },
    { ...heldCards, cards: [] },
  ]) await expect(explorerRoster(product(cards))).rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
  await expect(explorerRoster(product(heldCards, { version: 1, entries: [{ ...row, item: 'missing' }] })))
    .rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
  await expect(explorerRoster(product(heldCards, catalogue, { ...heldPrimary, primary: { ...heldPrimary.primary, item: 'other-item' } })))
    .rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
  await expect(explorerRoster(product(heldCards, { version: 1, entries: [{ ...row, id: 'missing' }] })))
    .rejects.toMatchObject({ item: 'explore/catalogue', reason: 'schema' });
});
