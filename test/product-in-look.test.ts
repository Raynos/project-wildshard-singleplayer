import { describe, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the checkout root for the discovery generator.
import { resolve } from 'node:path';
import type { LookStrategy } from '@wildshard/engine/render/look';
import type { RosterEntry } from '@wildshard/engine/models/live';
import { toLevelSpec } from '../src/game/shard/spec';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { createShardProduct, ProductError, type ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { readProjectAssets } from '../src/sdk/project';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { MANIFEST as driftwood } from '../src/shards/driftwood-isle/discovery.generated';
import { MANIFEST as pine } from '../src/shards/pine-hollow/discovery.generated';

// progress/shard-platform/product-in-look-o272: the game binds the shard's loaded product into the look and roster loaders
// it hands the engine; the engine's LevelSpec keeps plain zero-argument loaders.
// Both platform look rows and custom rows come from the shard's emitted output.
const emittedSections = async (slug: string): Promise<Map<string, unknown>> => {
  const output = (await readProjectAssets(`src/shards/${slug}`)).output;
  const sections = new Map<string, unknown>();
  for (const group of [output.custom, output.platform]) for (const row of group?.sections ?? []) {
    const bytes = group?.files.get(row.path);
    if (bytes !== undefined) sections.set(row.name, JSON.parse(new TextDecoder().decode(bytes)));
  }
  return sections;
};
const productOf = async (slug: string): Promise<ShardProduct> => {
  const sections = await emittedSections(slug);
  // This fixture observes product forwarding, with no native specimen roster.
  sections.delete('explore/catalogue');
  return createShardProduct({ slug, revision: 1,
    shardfile: emptyShardfile({ slug, name: slug, author: 'Wildshard', revision: 1, seed: 1 }),
    sections, files: new Map(), read: () => Promise.reject(new Error('no files in this fixture')) });
};

test.each([
  ['driftwood-isle', 'custom/enemyPlacements', 'sim/enemy-placement.json'],
  ['pine-hollow', 'custom/cabinAmbience', 'world/ambience.json'],
])('%s %s retains the original named payload exactly', async (slug, section, name) => {
  const loaded = await readProjectAssets(`src/shards/${slug}`);
  const entry = loaded.output.custom?.sections.find(row => row.name === section);
  const named = loaded.output.namedFiles?.find(row => row.name === name);
  const sectionBytes = entry === undefined ? undefined : loaded.output.custom?.files.get(entry.path);
  const namedBytes = named === undefined ? undefined : loaded.assets.get(named.hash);
  if (sectionBytes === undefined || namedBytes === undefined) throw new Error('Missing build-validated content');
  expect(JSON.parse(new TextDecoder().decode(sectionBytes))).toEqual(JSON.parse(new TextDecoder().decode(namedBytes)));
}, 30_000);

describe('toLevelSpec binds the product', () => {
  const seen: { look: ShardProduct | null; roster: ShardProduct | null } = { look: null, roster: null };
  const manifest: ShardManifest = { ...driftwood,
    render: (product) => { seen.look = product; return Promise.resolve<LookStrategy>({ compose: () => ({}) }); },
    roster: (product) => { seen.roster = product; return Promise.resolve<readonly RosterEntry[]>([]); } };

  test('the look and roster loaders get the loaded product', async () => {
    const product = await productOf(driftwood.slug), spec = toLevelSpec(manifest, product);
    await spec.look?.(); await spec.roster?.();
    expect(seen.look).toBe(product); expect(seen.roster).toBe(product);
  }, 60000);

  test('without a product they get an absent one whose reads refuse', async () => {
    const spec = toLevelSpec(manifest);
    await spec.look?.();
    expect(seen.look?.has('quests/quests')).toBe(false);
    expect(() => seen.look?.shardfile).toThrow(ProductError);
  });
});

describe('Driftwood and Pine looks read the product, not shard.config', () => {
  for (const manifest of [driftwood, pine]) test(`${manifest.slug} builds its look from product sections`, async () => {
    const product = await productOf(manifest.slug);
    let reads = 0;
    const counted = new Proxy(product, { get(target, key, receiver): unknown {
      if (key === 'section') reads += 1;
      return Reflect.get(target, key, receiver);
    } });
    const look = await toLevelSpec(manifest, counted).look?.();
    expect(look?.backdrop).toBeTypeOf('function');
    expect(reads).toBeGreaterThan(0);
    await expect(toLevelSpec(manifest).look?.()).rejects.toThrow(ProductError);
  }, 60000);

  test('discovery forwards the product to called look and roster factories', () => {
    const root = resolve(import.meta.dirname, '..');
    for (const slug of ['driftwood-isle', 'pine-hollow', 'far-reach', 'sunscar-dunes']) {
      const source = authoredManifestSource(root, slug);
      expect(source).toContain(slug === 'far-reach' || slug === 'sunscar-dunes'
        ? "render: async (product) => (await import('@wildshard/game/looks/paintedLook')).productPaintedLook(product)"
        : slug === 'driftwood-isle'
          ? "render: async (product) => (await import('@wildshard/game/looks/toonLook')).toonLook(product)"
          // G571: Pine's look is the keyed-sky render host's, from its declared rows
          : "render: async (product) => (await import('@wildshard/game/looks/keyedSky')).keyedSkyRender(product, ");
      if (slug === 'driftwood-isle') expect(source).not.toContain('import("./runtime/look/render")');
      if (slug === 'driftwood-isle') {
        expect(source).toContain('const callWithProduct = ');
        expect(source).toContain("import type { ShardProduct } from '../../game/shardfile/shardProduct';");
      }
    }
    const compiled = authoredManifestSource(root, 'pine-hollow');
    expect(compiled).toContain('declaredClientPlanEntry({"retainHomeRuntime":true,"stagesOwner":"runtime"})');
    expect(compiled).not.toContain('const callWithProduct = ');
    expect(compiled).not.toContain('runtimeModule');
    expect(compiled).not.toContain('import("./roster")');
    expect(authoredManifestSource(root, 'sunscar-dunes')).not.toContain('import("./roster")');
    // d78cef781: Driftwood's roster is a called factory now, so discovery forwards the product to it too
    expect(authoredManifestSource(root, 'driftwood-isle')).toContain('roster: async (product) => callWithProduct((await import("./roster"))["roster"], product)');
  });
});
