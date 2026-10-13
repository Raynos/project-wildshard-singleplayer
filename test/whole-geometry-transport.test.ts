import { BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial } from 'three';
import { expect, it, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { bakeProps } from '../src/sdk/bake/props';
import { contentHash } from '../src/sdk/project';
import { admitProduct, type ProductOptions } from '../src/game/shardfile/product';
import { admittedRuntimeProduct, provideRuntimeProduct } from '../src/game/shardfile/runtimeProduct';
import { readWholeGeometry } from '../src/game/plugin/geometry';

async function fixture() {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3)), material = new MeshStandardMaterial();
  const baked = bakeProps({ static: new Group(), whole: [{ id: 'triangle', mesh: new Mesh(geometry, material), transform: new Matrix4(), partition: true }] });
  geometry.dispose(); material.dispose();
  const source = emptyShardfile({ slug: 'whole-release', name: 'Whole', author: 'test', revision: 1, seed: 1 });
  Object.assign(source, { runtime: { entry: 'runtime/index.ts', binds: ['props'] }, props: baked.props, files: baked.files, tiles: baked.tiles,
    library: baked.library, far: baked.far });
  const disk = new Map<string, Uint8Array>();
  const options: ProductOptions = { base: 'https://fixture.test/', firstParty: true, offline: false, hash: bytes => Promise.resolve(contentHash(bytes)),
    fetch: url => { const bytes = baked.assets.get(url.split('/').at(-1) ?? ''); if (bytes === undefined) throw new Error('Unexpected file'); return Promise.resolve(new Response(Uint8Array.from(bytes).buffer)); },
    cache: { product: () => Promise.resolve(null), putProduct: () => Promise.resolve(),
      asset: (_base, hash) => { const bytes = disk.get(hash); return Promise.resolve(bytes === undefined ? null : Uint8Array.from(bytes)); },
      putAsset: (_base, hash, bytes) => { disk.set(hash, Uint8Array.from(bytes)); return Promise.resolve(true); }, pin: () => () => undefined } };
  const admitted = await admitProduct(source, options), scope = new Scope('whole-release');
  provideRuntimeProduct(admitted, scope, options);
  const runtime = admittedRuntimeProduct(source.identity.slug);
  if (runtime === null) throw new Error('No resident reader');
  return { source, admitted, runtime, scope, hash: baked.files[0]?.hash ?? '' };
}

it('releases verified wire only after its whole mesh is copied, preserving the per-mesh pause and exact draw', async () => {
  const f = await fixture();
  try {
    const pause = vi.fn(() => { expect(f.admitted.assets.has(f.hash)).toBe(true); return Promise.resolve(); });
    const views = await readWholeGeometry(f.scope, f.source, undefined, pause);
    expect(pause).toHaveBeenCalledOnce();
    expect(f.admitted.assets.size).toBe(0); expect(f.runtime.assets.retained.size).toBe(0);
    expect(views.size).toBe(1);
    expect(views.get('triangle')?.geometry.getAttribute('position').array).toEqual(Float32Array.of(0, 0, 0, 1, 0, 0, 0, 0, 1));
    expect((await f.runtime.assets.read(f.hash)).length).toBeGreaterThan(0);
  } finally { f.scope.dispose(); }
});

it('keeps the admitted wire when decoding pauses fail before handoff', async () => {
  const f = await fixture();
  try {
    await expect(readWholeGeometry(f.scope, f.source, undefined, () => Promise.reject(new Error('Stopped decoder')))).rejects.toThrow('Stopped decoder');
    expect(f.admitted.assets.has(f.hash)).toBe(true); expect(f.runtime.assets.retained.has(f.hash)).toBe(true);
  } finally { f.scope.dispose(); }
});
