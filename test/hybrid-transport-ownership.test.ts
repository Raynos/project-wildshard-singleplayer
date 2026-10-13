import { expect, it, vi } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseGlb } from '../src/sdk/assets';
import { contentHash } from '../src/sdk/project';
import { parseShardfile } from '../src/format/shardSchema';
import { ClientAssets } from '../src/game/shardfile/clientAssets';
import { ShardfileClient } from '../src/game/shardfile/client';

function fixture(bound: boolean) {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  const material = new MeshStandardMaterial();
  const bytes = staticGlb([{ geometry, material }], 'bound'), other = staticGlb([{ geometry, material }], 'unbound');
  geometry.dispose(); material.dispose();
  const hash = contentHash(bytes), keep = contentHash(other);
  const base = emptyShardfile({ slug: 'hybrid-transport', name: 'Hybrid Transport', author: 'test', revision: 1, seed: 1 });
  const source = parseShardfile({ ...base, runtime: { entry: 'runtime/index.ts', binds: bound ? ['props'] : [] },
    props: { version: 1, family: 'toon', wholeLibrary: [hash], tiles: [], panels: [], models: [], far: null, textures: [], colliders: [] },
    library: [hash, keep], files: [[hash, bytes], [keep, other]].map(([ref, wire]) => {
      if (typeof ref !== 'string' || !(wire instanceof Uint8Array)) throw new Error('Fixture layout');
      const row = { hash: ref, kind: 'glb', compressed: wire.length, dependencies: [], critical: false };
      return Object.assign(row, parseGlb(wire));
    }) });
  const fetch = vi.fn(() => Promise.resolve(new Response(Uint8Array.from(bytes).buffer)));
  const retained = new Map([[hash, bytes], [keep, other]]);
  const assets = new ClientAssets(source, retained, { base: 'https://fixture.test/', firstParty: true, offline: false, fetch,
    hash: wire => Promise.resolve(contentHash(wire)) });
  return { source, hash, keep, bytes, assets, fetch, retained };
}
function client(f: ReturnType<typeof fixture>): ShardfileClient {
  return new ShardfileClient(f.source, f.assets, { instance: 'hybrid-transport', trustedRuntime: true, audioOwner: 'runtime', worldOwner: 'runtime',
    catalogue: [], items: new Map(), recipes: new Map(), voices: () => new Map(), icon: () => { throw new Error('No icon used'); } });
}

it('forgets only runtime-owned transports while preserving unbound library bytes and the caller map', async () => {
  const f = fixture(true); client(f);
  expect([...f.assets.retained.keys()]).toEqual([f.keep]);
  expect([...f.retained.keys()]).toEqual([f.hash, f.keep]);
  expect(await f.assets.read(f.hash)).toEqual(f.bytes);
  expect(f.fetch).toHaveBeenCalledExactlyOnceWith(`https://fixture.test/${f.hash}`);
  expect([...f.assets.retained.keys()]).toEqual([f.keep]);
});

it('keeps unbound content unchanged and does not fetch it again', async () => {
  const f = fixture(false); client(f);
  expect([...f.assets.retained.keys()]).toEqual([f.hash, f.keep]);
  expect(await f.assets.read(f.hash)).toBe(f.bytes);
  expect(f.fetch).not.toHaveBeenCalled();
});

it.each(['size', 'hash'] as const)('still refuses a corrupt %s on reread after dropping a runtime transport', async failure => {
  const f = fixture(true); client(f);
  const corrupt = failure === 'size' ? new Uint8Array(0) : Uint8Array.from(f.bytes);
  if (failure === 'hash') corrupt[0] = (corrupt[0] ?? 0) ^ 1;
  f.fetch.mockResolvedValue(new Response(corrupt.buffer));
  await expect(f.assets.read(f.hash)).rejects.toThrow('hash or size mismatch');
  expect(f.assets.retained.has(f.hash)).toBe(false);
});
