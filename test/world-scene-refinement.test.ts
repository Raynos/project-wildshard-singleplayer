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
import * as work from '../src/engine/core/workSlice';

function fixture(indexed = false) {
  const owner = new Scope('fine-resident'), source = emptyShardfile({ slug: 'fine-fixture', name: 'Fine', author: 'Fixture', revision: 1, seed: 1 });
  const original = new BufferGeometry().setAttribute('position', new BufferAttribute(Float32Array.of(-230, 0, -230, -229, 0, -230, -230, 0, -229, 30, 0, -230, 31, 0, -230, 30, 0, -229), 3));
  original.setAttribute('normal', new BufferAttribute(Float32Array.of(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0), 3));
  if (indexed) original.setIndex(new BufferAttribute(Uint16Array.of(0, 1, 2, 3, 4, 5), 1));
  const bakeMaterial = new MeshBasicMaterial();
  const partitions = partitionWholeGeometry(original), assets = new Map<string, Uint8Array>();
  for (const part of partitions) {
    const bytes = staticGlb([{ name: 'fabric', geometry: part.geometry, material: bakeMaterial, transform: new Matrix4(), nativeAttributes: true, compactIndex: true, extras: {
      wholePartition: { id: 'fabric', vertices: part.vertices, triangles: part.triangles, vertexCount: 6, indexCount: indexed ? 6 : 0, index: indexed ? 'u16' : 'none' },
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
    expect(f.read).not.toHaveBeenCalled(); expect(f.mesh.geometry.attributes).toEqual({}); expect(f.mesh.visible).toBe(false); // NR4: out of the draw until a union gives it channels
    const material = [f.mesh.material].flat()[0], version = material?.version ?? -1;
    await f.content.attach(a, first); expect(f.read).toHaveBeenCalledTimes(1); expect(f.cover).toHaveBeenCalledTimes(1);
    // the first union over the channel-less placeholder rebuilds the programs built against it; a later union does not
    expect(material?.version).toBe(version + 1); expect(f.mesh.visible).toBe(true);
    const firstGeometry = f.mesh.geometry, firstDisposed = vi.fn<() => void>(); firstGeometry.addEventListener('dispose', firstDisposed);
    await f.content.attach(b, second);
    expect(material?.version).toBe(version + 1);
    expect(f.read).toHaveBeenCalledTimes(2); expect(firstDisposed).toHaveBeenCalledOnce();
    expect(f.mesh.geometry.getAttribute('position').array).toEqual(f.original.getAttribute('position').array);
    expect(f.mesh.geometry.groups).toEqual([]); expect(f.mesh.children).toEqual([]);
    first.dispose(); expect(f.mesh.geometry.getAttribute('position').count).toBe(3);
    expect(f.mesh.geometry.getAttribute('position').array).toEqual(f.original.getAttribute('position').array.slice(9));
    second.dispose(); expect(f.mesh.geometry.attributes).toEqual({});
    for (const [hash, bytes] of f.assets) expect(hashImmutableBytes(bytes)).toBe(hash);
  } finally { f.close(); }
});

// the triangles a union draws, by their corner positions (a degenerate triangle draws nothing)
function drawn(geometry: BufferGeometry): number[][] {
  const index = geometry.index, position = geometry.getAttribute('position'), out: number[][] = [];
  if (index === null) throw new Error('Expected an indexed union');
  for (let i = 0; i < index.count; i += 3) {
    const corners = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (corners[0] === corners[1] && corners[1] === corners[2]) continue;
    out.push(corners.flatMap(v => [position.getX(v), position.getY(v), position.getZ(v)]));
  }
  return out;
}

test('an indexed retire drops only its own triangles from the union on screen, then an attach compacts (QC1)', async () => {
  const f = fixture(true), first = f.owner.child('first'), second = f.owner.child('second'), keys = [...f.content.tiles()];
  const a = keys[0], b = keys[1]; if (a === undefined || b === undefined) throw new Error('Missing original tiles');
  try {
    await f.content.attach(a, first); await f.content.attach(b, second);
    const union = f.mesh.geometry, index = union.index; if (index === null) throw new Error('Expected an indexed union');
    expect(index.count).toBe(6); const all = drawn(union), remaining = all.slice(1); expect(all).toHaveLength(2);
    const disposed = vi.fn<() => void>(); union.addEventListener('dispose', disposed);
    first.dispose();
    // no re-join and no re-upload: the same union, the first tile's 3 indices degenerate and queued as the one update range
    expect(f.mesh.geometry).toBe(union); expect(disposed).not.toHaveBeenCalled();
    expect([...index.array]).toEqual([0, 0, 0, ...[...index.array].slice(3)]); expect(index.updateRanges).toEqual([{ start: 0, count: 3 }]);
    expect(drawn(union)).toEqual(remaining); expect(f.mesh.visible).toBe(true);
    // the next attach publishes a compact union of what is held, in held order
    const again = f.owner.child('again');
    await f.content.attach(a, again);
    expect(disposed).toHaveBeenCalledOnce(); expect(f.mesh.geometry.index?.count).toBe(6);
    expect(drawn(f.mesh.geometry)).toEqual([...remaining, all[0]]);
    second.dispose(); again.dispose(); expect(f.mesh.geometry.attributes).toEqual({}); expect(f.mesh.visible).toBe(false);
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

test('retirement during a spent join drains without publishing the stale fine piece', async () => {
  const f = fixture(), holder = f.owner.child('joining'), key = [...f.content.tiles()][0];
  if (key === undefined) throw new Error('Missing original tile');
  let release = (): void => undefined, started = (): void => undefined;
  const paused = new Promise<void>(resolve => { started = resolve; }), resume = new Promise<void>(resolve => { release = resolve; });
  const original = work.workSlice; let held = false;
  vi.spyOn(work, 'workSlice').mockImplementation((budget, owner) => owner !== f.owner ? original(budget, owner) : {
    due: () => !held, yield: () => Promise.resolve(), check: () => { if (held) return undefined; held = true; started(); return resume; },
  });
  const initial = f.mesh.geometry, pending = f.content.attach(key, holder);
  try {
    await paused; expect(f.mesh.geometry).toBe(initial);
    holder.dispose(); const retired = f.mesh.geometry;
    expect(retired.attributes).toEqual({}); release(); await pending;
    expect(f.mesh.geometry).toBe(retired); expect(f.mesh.geometry.attributes).toEqual({});
    expect(f.cover).toHaveBeenCalledOnce();
  } finally { release(); f.close(); }
});

test('concurrent arrivals await one current union before either fine hold becomes ready', async () => {
  const f = fixture(), first = f.owner.child('first-joining'), second = f.owner.child('second-joining'), keys = [...f.content.tiles()];
  const a = keys[0], b = keys[1]; if (a === undefined || b === undefined) throw new Error('Missing original tiles');
  let release = (): void => undefined, started = (): void => undefined, added = (): void => undefined;
  const paused = new Promise<void>(resolve => { started = resolve; }), resume = new Promise<void>(resolve => { release = resolve; });
  const joined = new Promise<void>(resolve => { added = resolve; }), register = second.onDispose.bind(second);
  vi.spyOn(second, 'onDispose').mockImplementation(cleanup => { register(cleanup); added(); });
  const original = work.workSlice; let held = false;
  vi.spyOn(work, 'workSlice').mockImplementation((budget, owner) => owner !== f.owner ? original(budget, owner) : {
    due: () => !held, yield: () => Promise.resolve(), check: () => { if (held) return undefined; held = true; started(); return resume; },
  });
  let firstReady = false, secondReady = false;
  const initial = f.mesh.geometry, left = (async () => { await f.content.attach(a, first); firstReady = true; })();
  try {
    await paused;
    const right = (async () => { await f.content.attach(b, second); secondReady = true; })();
    await joined;
    expect(firstReady).toBe(false); expect(secondReady).toBe(false); expect(f.mesh.geometry).toBe(initial);
    release(); await Promise.all([left, right]);
    expect(firstReady && secondReady).toBe(true); expect(f.mesh.children).toEqual([]); expect(f.mesh.geometry.groups).toEqual([]);
    expect(f.mesh.geometry.getAttribute('position').array).toEqual(f.original.getAttribute('position').array);
    expect(f.read).toHaveBeenCalledTimes(2);
    first.dispose(); expect(f.mesh.geometry.getAttribute('position').count).toBe(3);
    second.dispose(); expect(f.mesh.geometry.attributes).toEqual({});
  } finally { release(); f.close(); }
});
