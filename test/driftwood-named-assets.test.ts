import { expect, test, vi } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { driftwoodBlobName, readDriftwoodBlob } from '../src/shards/driftwood-isle/runtime/boot/blobAssets';
import lateReadRows from '../src/shards/driftwood-isle/data/boot-lateReads.generated.json' with { type: 'json' };
import { resolveBootFiles, bootLateReads } from '../src/engine/boot/filePolicy';
import { DRIFTWOOD_BOOT_FILES } from '../src/shards/driftwood-isle/data/bootFiles';
import { GPU_FILES } from '../src/shards/driftwood-isle/ktx2.generated';

test('Driftwood aliases resolve only listed named product bytes, with no public URL fallback', async () => {
  const bytes = new Uint8Array([1, 2, 3]), read = vi.fn(() => Promise.resolve(bytes));
  const product = createShardProduct({ slug: 'driftwood-isle', revision: 1,
    shardfile: emptyShardfile({ slug: 'driftwood-isle', name: 'Test', author: 'Test', revision: 1, seed: 1 }),
    sections: new Map([['custom/assets', { byUrl: { '/old/body.glb': 'models/body.glb', '/alias/body.glb': 'models/body.glb', '/missing.glb': 'models/absent.glb' } }]]),
    files: new Map([['models/body.glb', { hash: 'checked-hash', url: '/shardfiles/driftwood-isle/blobs/glb/checked-hash.glb' }]]), read, check: true });
  expect(driftwoodBlobName(product, '/old/body.glb')).toBe('models/body.glb');
  expect(await readDriftwoodBlob('models/body.glb', product)).toBe(bytes);
  expect(await readDriftwoodBlob('/alias/body.glb', product)).toBe(bytes);
  expect(read).toHaveBeenCalledWith('checked-hash');
  await expect(readDriftwoodBlob('/unlisted.glb', product)).rejects.toThrow('missing its named asset');
  await expect(readDriftwoodBlob('/missing.glb', product)).rejects.toThrow('missing its named asset');
  await expect(readDriftwoodBlob('models/absent.glb', product)).rejects.toThrow('missing its named asset');
});

test('only the five migrated public prefetch groups retire; remaining boot content stays selected', () => {
  for (const tier of ['phone', 'desktop'] as const) for (const mode of ['img', 'ktx2'] as const) {
    const previous = resolveBootFiles(DRIFTWOOD_BOOT_FILES, 'late', tier, mode, GPU_FILES);
    const migrated = new Set(['reef', 'ground', 'palms', 'hibiscus', 'cover'].flatMap(group => resolveBootFiles(DRIFTWOOD_BOOT_FILES, group, tier, mode, GPU_FILES)));
    const remaining = bootLateReads(lateReadRows, tier, mode);
    expect(remaining).toEqual(previous.filter(url => !migrated.has(url)));
    expect(remaining).toContain('/assets/lut/driftwood-isle.bin');
    expect(remaining.every(url => !migrated.has(url))).toBe(true);
  }
});
