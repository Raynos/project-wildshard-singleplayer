import { describe, expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the checkout root for the discovery generator.
import { resolve } from 'node:path';
import type { LookStrategy } from '@wildshard/engine/render/look';
import type { RosterEntry } from '@wildshard/engine/models/live';
import { toLevelSpec } from '../src/game/shard/spec';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { createShardProduct, ProductError, type ShardProduct } from '@wildshard/game/shardfile/shardProduct';
import { emptyShardfile } from '../src/sdk/author';
import { authoredManifestSource } from '../scripts/authored-manifest.mjs';
import { MANIFEST as driftwood } from '../src/shards/driftwood-isle/discovery.generated';
import { MANIFEST as pine } from '../src/shards/pine-hollow/discovery.generated';

// progress/shard-platform/product-in-look-o272: the game binds the shard's loaded product into the look and roster loaders
// it hands the engine; the engine's LevelSpec keeps plain zero-argument loaders.
const productOf = (slug: string): ShardProduct => createShardProduct({ slug, revision: 1,
  shardfile: emptyShardfile({ slug, name: slug, author: 'Wildshard', revision: 1, seed: 1 }),
  sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('no files in this fixture')) });

describe('toLevelSpec binds the product', () => {
  const seen: { look: ShardProduct | null; roster: ShardProduct | null } = { look: null, roster: null };
  const manifest: ShardManifest = { ...driftwood,
    render: (product) => { seen.look = product; return Promise.resolve<LookStrategy>({}); },
    roster: (product) => { seen.roster = product; return Promise.resolve<readonly RosterEntry[]>([]); } };

  test('the look and roster loaders get the loaded product', async () => {
    const product = productOf(driftwood.slug), spec = toLevelSpec(manifest, product);
    await spec.look?.(); await spec.roster?.();
    expect(seen.look).toBe(product); expect(seen.roster).toBe(product);
  });

  test('without a product they get an absent one whose reads refuse', async () => {
    const spec = toLevelSpec(manifest);
    await spec.look?.();
    expect(seen.look?.has('quests/quests')).toBe(false);
    expect(() => seen.look?.shardfile).toThrow(ProductError);
  });
});

describe('Driftwood and Pine looks read the product, not shard.config', () => {
  for (const manifest of [driftwood, pine]) test(`${manifest.slug} builds its look from product.shardfile`, async () => {
    const product = productOf(manifest.slug);
    let reads = 0;
    const counted: ShardProduct = { ...product, get shardfile() { reads += 1; return product.shardfile; } };
    const look = await toLevelSpec(manifest, counted).look?.();
    expect(look?.backdrop).toBeTypeOf('function');
    expect(reads).toBeGreaterThan(0);
    await expect(toLevelSpec(manifest).look?.()).rejects.toThrow(ProductError);
  });

  test('discovery forwards the product to called look and roster factories', () => {
    const root = resolve(import.meta.dirname, '..');
    for (const slug of ['driftwood-isle', 'pine-hollow', 'far-reach', 'sunscar-dunes']) {
      const source = authoredManifestSource(root, slug);
      expect(source).toContain('render: async (product) => callWithProduct(');
      expect(source).toContain('import { callWithProduct, defineAuthoredShard }');
    }
    expect(authoredManifestSource(root, 'sunscar-dunes')).toContain('roster: async (product) => callWithProduct(');
    expect(authoredManifestSource(root, 'driftwood-isle')).toContain('roster: async () => (await import("./roster"))["ROSTER"]');
  });
});
