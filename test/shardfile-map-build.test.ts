// oxlint-disable-next-line import/no-nodejs-modules -- Build and inspect a disposable real author project.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The test owns its temporary project.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the author's output files.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { buildProject, contentHash } from '../src/sdk/project';
import { admitProduct } from '../src/game/shardfile/product';

it('emits the exact map bytes and admits a moved offline product without public asset URLs', async () => {
  const project = mkdtempSync(join(tmpdir(), 'shard-map-'));
  const source = emptyShardfile({ slug: 'template', name: 'Map', author: 'Fixture', seed: 1, revision: 1 });
  const bytes = Uint8Array.from(atob('UklGRjAAAABXRUJQVlA4ICQAAABwAQCdASoCAAMAAUAmJYwCdAFAAAD++b4XAkrVm6WHJtcxAAA='), c => c.codePointAt(0) ?? 0);
  try {
    writeFileSync(join(project, 'shard.config.ts'), `export default ${JSON.stringify(source)};`);
    const output = join(project, 'output'), built = await buildProject(project, output, { client: null, map: { bytes, tilesHash: 'b'.repeat(64) } });
    expect(built.map?.image).toBe(contentHash(bytes));
    expect(Uint8Array.from(readFileSync(join(output, contentHash(bytes))))).toEqual(bytes);
    const cachedSource: unknown = JSON.parse(readFileSync(join(output, 'shard.json'), 'utf8'));
    const cache = { product: () => Promise.resolve({ source: cachedSource, firstParty: true }),
      asset: (_base: string, hash: string) => Promise.resolve(Uint8Array.from(readFileSync(join(output, hash)))), putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() };
    const admitted = await admitProduct(built, { firstParty: true, offline: true, base: 'https://moved.test/product/', cache,
      hash: image => Promise.resolve(contentHash(image)), fetch: () => Promise.reject(new Error('No browser/public map fetch')) });
    expect(admitted.source.map).toEqual(built.map); expect(admitted.assets.get(contentHash(bytes))).toEqual(bytes);
  } finally { rmSync(project, { recursive: true, force: true }); }
});
