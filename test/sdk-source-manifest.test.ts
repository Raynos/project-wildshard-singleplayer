// oxlint-disable-next-line import/no-nodejs-modules -- Verify the committed card payload's immutable content address.
import { createHash } from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the exact asset that the portable author build will emit.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/sdk/shardfile';
import { sourceManifest } from '../src/sdk/sourceManifest';
import { assetBytes } from '../src/sdk/assets';
import { validateShardfileAssets } from '../src/game/shardfile/validate';
import { shardEntries } from '../src/game/shard/entryMode';
import { SOURCE } from '../src/shards/blender-template/data/source';
import { CARD_BASE64, CARD_HASH } from '../src/shards/blender-template/data/card';
import { CARD_BYTES } from '../src/shards/blender-template/boot/card';
import manifest from '../src/shards/blender-template/manifest';
import project from '../src/shards/blender-template/shard.config';

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
it('admits the real presentation payload and gives the catalogue the same identity, accent and image', () => {
  const wire = new Uint8Array(readFileSync(`src/shards/blender-template/assets/${CARD_HASH}`));
  expect(wire).toEqual(CARD_BYTES); expect(hash(wire)).toBe(CARD_HASH);
  expect(assetBytes(CARD_BASE64)).toEqual(wire);
  const empty = emptyShardfile(SOURCE.identity);
  expect([project.identity, project.accent, project.spawn, project.look, project.presentation])
    .toEqual([SOURCE.identity, SOURCE.accent, SOURCE.spawn, SOURCE.look, SOURCE.presentation]);
  const source = parseShardfile({ ...empty, ...SOURCE,
    files: project.files, library: project.library, budgets: project.budgets,
  });
  const assets = new Map([[CARD_HASH, wire]]), before = JSON.stringify(source);
  const mapped = sourceManifest(validateShardfileAssets(source, assets, hash), assets);
  expect(JSON.stringify(source)).toBe(before);
  expect([manifest.slug, manifest.name, manifest.accent, manifest.spawn, manifest.biome, manifest.blurb, manifest.card])
    .toEqual([mapped.slug, mapped.name, mapped.accent, mapped.spawn, mapped.biome, mapped.blurb, mapped.card]);
  expect(mapped.card.thumb.startsWith('data:image/jpeg;base64,')).toBe(true);
  expect(manifest.status).toBe('hidden');
  expect(manifest.load).toBeUndefined(); expect(manifest.boot).toBeUndefined();
  expect(shardEntries(manifest)).toEqual({ legacy: false, shardfile: true, public: 'shardfile' });
  expect(() => sourceManifest(source)).toThrow('missing admitted bytes');
});

it('keeps the empty-author catalogue asset-free and enters renderer/equipment modules only through hooks', async () => {
  const mapped = sourceManifest(emptyShardfile(SOURCE.identity));
  expect(mapped.card.thumb.startsWith('data:image/svg+xml,')).toBe(true);
  expect(mapped.load).toBeTypeOf('function');
  const look = await mapped.render?.();
  expect(look?.mode).toBe('extend');
});
