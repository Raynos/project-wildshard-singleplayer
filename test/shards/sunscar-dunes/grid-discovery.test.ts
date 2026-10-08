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
import { SUNSCAR_DUNES } from '../../../src/shards/sunscar-dunes/manifest';
import declaration from '../../../src/shards/sunscar-dunes/shard.config';

it('discovers and admits the emitted Signal Dunes product at its complete measured runtime cost', async () => {
  const output = mkdtempSync(join(tmpdir(), 'sun-grid-product-'));
  const allocator = new ResidencyAllocator(), scope = new Scope('sun.grid.discovery');
  try {
    const source = await buildProject(resolve('src/shards/sunscar-dunes'), output, { client: null });
    expect(source).toEqual(declaration);
    expect(readFileSync(join(output, 'shard.json'), 'utf8')).toBe(canonicalJson(source));
    expect(SUNSCAR_DUNES.shardfile).toBeUndefined(); // Standalone keeps its ordinary legacy loader.
    expect(SUNSCAR_DUNES.gridShardfile).toBe('/shardfiles/sunscar-dunes/shard.json');
    expect(SUNSCAR_DUNES.trustedRuntime).toEqual({ slug: SUNSCAR_DUNES.slug, entry: source.runtime?.entry });
    const fetched: string[] = [];
    vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      const filename = new URL(url).pathname.split('/').at(-1);
      if (filename === undefined) throw new Error('Missing product filename');
      return Promise.resolve(new Response(Uint8Array.from(readFileSync(join(output, filename)))));
    });
    const product = await gridShardfileProduct(SUNSCAR_DUNES.slug, { allocator, scope });
    if (product === null) throw new Error('Signal Dunes was not discovered');
    expect(product.admitted.source).toEqual(source);
    expect(product.options.firstParty).toBe(true);
    expect(fetched).toEqual(['http://localhost:5173/shardfiles/sunscar-dunes/shard.json', ...source.files.map(file => `http://localhost:5173/shardfiles/sunscar-dunes/${file.hash}`)]);
    expect(regionalRuntimeAccountedBytes(product.admitted, SUNSCAR_DUNES)).toBe(49_369_323);
    expect(source.entryways.map(entry => [entry.edge, entry.kind ?? 'ground', entry.width])).toEqual(['north', 'east', 'south', 'west'].map(edge => [edge, 'ground', 8]));
    expect(source.accent).toBe('orchid');
    expect(source.runtime?.cost).toEqual(SUNSCAR_DUNES.runtimeCost);
    expect(source.runtime?.cost?.rev).toBe('744cf67ef347bd635ae8126cb80d5355a77fec85');
    product.release();
  } finally { scope.dispose(); vi.unstubAllGlobals(); rmSync(output, { recursive: true, force: true }); }
  expect(allocator.entries()).toHaveLength(0);
});
