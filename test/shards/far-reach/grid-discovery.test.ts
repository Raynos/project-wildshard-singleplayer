// oxlint-disable-next-line import/no-nodejs-modules -- Serve actual SDK product bytes from an isolated local output.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the author product without touching shared public output.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the config and immutable output paths.
import { join, resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { ResidencyAllocator } from '../../../src/game/grid/allocator';
import { gridShardfileProduct } from '../../../src/game/grid/products';
import { regionalRuntimeAccountedBytes } from '../../../src/game/grid/regionalRuntime';
import { buildProject, canonicalJson } from '../../../src/sdk/project';
import { SKY_REACH } from '../../../src/shards/far-reach/manifest';
import declaration from '../../../src/shards/far-reach/shard.config';

it('discovers and admits the emitted Sky Reach product at its matched measured runtime increment', async () => {
  const output = mkdtempSync(join(tmpdir(), 'sky-grid-product-'));
  const allocator = new ResidencyAllocator(), scope = new Scope('sky.grid.discovery');
  try {
    const source = await buildProject(resolve('src/shards/far-reach'), output, { client: null });
    expect(source).toEqual(declaration);
    expect(readFileSync(join(output, 'shard.json'), 'utf8')).toBe(canonicalJson(source));
    expect(SKY_REACH.shardfile).toBeUndefined(); // Standalone keeps its ordinary legacy loader.
    expect(SKY_REACH.gridShardfile).toBe('/shardfiles/far-reach/shard.json');
    expect(SKY_REACH.trustedRuntime).toEqual({ slug: SKY_REACH.slug, entry: source.runtime?.entry });
    const fetched: string[] = [];
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      const filename = new URL(url).pathname.split('/').at(-1);
      if (filename === undefined) throw new Error('Missing product filename');
      return Promise.resolve(new Response(Uint8Array.from(readFileSync(join(output, filename)))));
    });
    const product = await gridShardfileProduct(SKY_REACH.slug, { allocator, scope });
    if (product === null) throw new Error('Sky Reach was not discovered');
    expect(product.admitted.source).toEqual(source);
    expect(product.options.firstParty).toBe(true);
    expect(fetched).toEqual(['http://localhost:5173/shardfiles/far-reach/shard.json', ...source.files.map(file => `http://localhost:5173/shardfiles/far-reach/${file.hash}`)]);
    expect(regionalRuntimeAccountedBytes(product.admitted, SKY_REACH)).toBe(145_233_228);
    expect(source.entryways.map(entry => [entry.edge, entry.kind, entry.width])).toEqual(['north', 'east', 'south', 'west'].map(edge => [edge, 'socketLift', 8]));
    expect(source.accent).toBe('pink');
    product.release();
  } finally { scope.dispose(); vi.unstubAllGlobals(); rmSync(output, { recursive: true, force: true }); }
  expect(allocator.entries()).toHaveLength(0);
});
