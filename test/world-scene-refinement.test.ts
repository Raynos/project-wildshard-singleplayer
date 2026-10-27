import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { partitionWholeGeometry } from '../src/sdk/bake/props';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseWorldScenes } from '../src/format/worldScenes';
import { provideRuntimeProduct, runtimeProduct } from '../src/game/shardfile/runtimeProduct';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { ControlRefinement } from '../src/game/shardfile/controlRefinement';
import { RefiningWholeLibrary } from '../src/game/shardfile/refiningWholeLibrary';

function fixture() {
  const owner = new Scope('fine-resident'), source = emptyShardfile({ slug: 'fine-fixture', name: 'Fine', author: 'Fixture', revision: 1, seed: 1 });
  const original = new BufferGeometry().setAttribute('position', new BufferAttribute(Float32Array.of(-230, 0, -230, -229, 0, -230, -230, 0, -229, 30, 0, -230, 31, 0, -230, 30, 0, -229), 3));
  original.setAttribute('normal', new BufferAttribute(Float32Array.of(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0), 3));
  const bakeMaterial = new MeshBasicMaterial();
  const partitions = partitionWholeGeometry(original), assets = new Map<string, Uint8Array>();
  for (const part of partitions) {
    const bytes = staticGlb([{ name: 'fabric', geometry: part.geometry, material: bakeMaterial, transform: new Matrix4(), nativeAttributes: true, compactIndex: true, extras: {
      wholePartition: { id: 'fabric', vertices: part.vertices, triangles: part.triangles, vertexCount: 6, indexCount: 0, index: 'none' },
    } }]), hash = hashImmutableBytes(bytes);
    assets.set(hash, bytes);
    source.files.push({ hash, kind: 'glb', compressed: bytes.length, decoded: part.geometry.getAttribute('position').array.byteLength, gpu: 0, triangles: 1, draws: 1, dependencies: [], critical: false });
    source.tiles.push({ lod: 0, x: part.x, z: part.z, geometricError: 0, bounds: { min: [-250 + part.x * 62.5, -1, -250 + part.z * 62.5], max: [-250 + (part.x + 1) * 62.5, 1, -250 + (part.z + 1) * 62.5] }, files: [hash], compressed: bytes.length, decoded: 72, gpu: 0, triangles: 1, draws: 1 });
  }
  provideRuntimeProduct({ source, assets, cached: false }, owner, { base: 'https://test.example/shardfiles/fine-fixture/', offline: false, firstParty: true,
    cache: { product: () => Promise.resolve(null), asset: () => Promise.resolve(null),
      verifiedAsset: hash => { const bytes = assets.get(hash); if (bytes !== undefined && hashImmutableBytes(bytes) !== hash) throw new Error('Corrupt fixture cache'); return Promise.resolve(bytes?.slice() ?? null); },
      putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() },
    fetch: () => Promise.reject(new Error('Only admitted source bytes are permitted')), hash: bytes => Promise.resolve(hashImmutableBytes(bytes)) });
  const product = createShardProduct({ slug: 'fine-fixture', revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('Use declared content hash')) });
  const row = parseWorldScenes({ version: 1, libraries: [{ id: 'fine', kind: 'whole', load: 'refine', models: [{ id: 'fabric', part: 'fabric', files: [...assets.keys()] }] }], materials: [], steps: [] }).libraries[0];
  if (row?.kind !== 'whole') throw new Error('Missing fine library');
  const queue = new ControlRefinement(owner, undefined, () => ({ x: -230, z: -230 }), () => Promise.resolve()), cover = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const library = new RefiningWholeLibrary(owner, product, row, queue, cover), material = new MeshBasicMaterial(), initial = new BufferGeometry(), mesh = new Mesh(initial, material);
  const content = library.bind('fabric', mesh, owner), read = vi.spyOn(runtimeProduct(source).assets, 'read');
  return { owner, original, partitions, assets, source, product, row, queue, mesh, content, read, cover, close: () => { owner.dispose(); original.dispose(); for (const part of partitions) part.geometry.dispose(); initial.dispose(); material.dispose(); bakeMaterial.dispose(); vi.restoreAllMocks(); } };
}

test('original tile pieces append to one stable draw and leave with their actual ring holds', async () => {
  const f = fixture(), first = f.owner.child('first'), second = f.owner.child('second'), keys = [...f.content.tiles()];
  const a = keys[0], b = keys[1]; if (a === undefined || b === undefined) throw new Error('Missing original tiles');
  try {
    expect(f.read).not.toHaveBeenCalled(); expect(f.mesh.geometry.attributes).toEqual({});
    await f.content.attach(a, first); expect(f.read).toHaveBeenCalledTimes(1); expect(f.cover).toHaveBeenCalledTimes(1);
    const firstGeometry = f.mesh.geometry, firstDisposed = vi.fn<() => void>(); firstGeometry.addEventListener('dispose', firstDisposed);
    await f.content.attach(b, second);
    expect(f.read).toHaveBeenCalledTimes(2); expect(firstDisposed).toHaveBeenCalledOnce();
    expect(f.mesh.geometry.getAttribute('position').array).toEqual(f.original.getAttribute('position').array);
    expect(f.mesh.geometry.groups).toEqual([]); expect(f.mesh.children).toEqual([]);
    first.dispose(); expect(f.mesh.geometry.getAttribute('position').count).toBe(3);
    expect(f.mesh.geometry.getAttribute('position').array).toEqual(f.original.getAttribute('position').array.slice(9));
    second.dispose(); expect(f.mesh.geometry.attributes).toEqual({});
    for (const [hash, bytes] of f.assets) expect(hashImmutableBytes(bytes)).toBe(hash);
  } finally { f.close(); }
});

test('a retiring tile drains its already-started read without appending a late piece', async () => {
  const f = fixture(), holder = f.owner.child('held'), key = [...f.content.tiles()][0];
  if (key === undefined) throw new Error('Missing original tile');
  let release = (_bytes: Uint8Array): void => { throw new Error('Missing held read'); }, started = (): void => { throw new Error('Missing started read'); };
  const reading = new Promise<void>(resolve => { started = resolve; });
  f.read.mockImplementationOnce(() => new Promise<Uint8Array>(resolve => { release = resolve; started(); }));
  const pending = f.content.attach(key, holder);
  try {
    await reading; holder.dispose();
    const hash = f.source.tiles.find(tile => tile.z * 8 + tile.x === key)?.files[0], bytes = hash === undefined ? undefined : f.assets.get(hash);
    if (bytes === undefined) throw new Error('Missing held source bytes'); release(bytes);
    await pending; expect(f.mesh.geometry.attributes).toEqual({}); expect(f.read).toHaveBeenCalledTimes(1);
  } finally { f.close(); }
});


test('a declared GLB outside the fine tile inventory refuses before any read or publication', () => {
  const f = fixture(), removed = f.source.tiles.shift(), hash = removed?.files[0];
  if (hash === undefined) throw new Error('Missing original fine tile');
  try {
    expect(f.source.files.some(file => file.hash === hash && file.kind === 'glb')).toBe(true);
    expect(() => new RefiningWholeLibrary(f.owner, f.product, f.row, f.queue, f.cover)).toThrow(`Refinement requires declared fine geometry: fine ${hash}`);
    expect(f.read).not.toHaveBeenCalled(); expect(f.mesh.geometry.attributes).toEqual({});
  } finally { f.close(); }
});
