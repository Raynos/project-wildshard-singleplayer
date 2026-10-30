// NF11: a refine library's baked slabs draw as plain chunk meshes under their key's anchor, one a frame, with no join.
import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial } from 'three';
import { Scope } from '../src/engine/app/scope';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { parseWorldScenes } from '../src/format/worldScenes';
import { provideRuntimeProduct, runtimeProduct } from '../src/game/shardfile/runtimeProduct';
import { createShardProduct } from '../src/game/shardfile/shardProduct';
import { ControlRefinement } from '../src/game/shardfile/controlRefinement';
import { SlabLibrary } from '../src/game/shardfile/slabLibrary';

const triangle = (x: number): BufferGeometry => new BufferGeometry()
  .setAttribute('position', new BufferAttribute(Float32Array.of(x, 0, 0, x + 1, 0, 0, x, 0, 1), 3))
  .setAttribute('normal', new BufferAttribute(Float32Array.of(0, 1, 0, 0, 1, 0, 0, 1, 0), 3));

function isGeometry(value: unknown): value is BufferGeometry { return value instanceof BufferGeometry; }
/** a drawn chunk's geometry */
function geometryOf(part: unknown): BufferGeometry {
  const geometry: unknown = part instanceof Mesh ? Reflect.get(part, 'geometry') : null;
  if (!isGeometry(geometry)) throw new Error('Expected a chunk mesh');
  return geometry;
}

function fixture() {
  const owner = new Scope('slab-resident'), source = emptyShardfile({ slug: 'slab-fixture', name: 'Slabs', author: 'Fixture', revision: 1, seed: 1 });
  const bakeMaterial = new MeshBasicMaterial(), assets = new Map<string, Uint8Array>(), shapes = [triangle(0), triangle(5), triangle(40)];
  // tile 0 holds two chunks of k0 in one file; tile 1 one chunk
  const files = [{ tile: 0, shapes: [shapes[0], shapes[1]] }, { tile: 1, shapes: [shapes[2]] }].map(({ tile, shapes: parts }) => {
    const bytes = staticGlb(parts.map((geometry, chunk) => ({ name: `k0-chunk_${String(chunk)}`, geometry: geometry ?? triangle(0), material: bakeMaterial, transform: new Matrix4(),
      nativeAttributes: true, compactIndex: true, extras: { slab: { key: 'k0', tile, chunk } } })), `slab_tile_${String(tile)}`), hash = hashImmutableBytes(bytes);
    assets.set(hash, bytes);
    source.files.push({ hash, kind: 'glb', compressed: bytes.length, decoded: 72, gpu: 0, triangles: parts.length, draws: parts.length, dependencies: [], critical: false });
    source.tiles.push({ lod: 0, x: tile, z: 0, geometricError: 0, bounds: { min: [-250 + tile * 62.5, -1, -250], max: [-250 + (tile + 1) * 62.5, 1, -187.5] }, files: [hash], compressed: bytes.length, decoded: 72, gpu: 0, triangles: 1, draws: 1 });
    return { tile, files: [{ file: hash, chunks: parts.map(() => ({ key: 'k0', bytes: 72, geometricError: 0, box: [0, 0, 0, 1, 1, 1], sphere: [0.5, 0.5, 0.5, 1] })) }] };
  });
  provideRuntimeProduct({ source, assets, cached: false }, owner, { base: 'https://test.example/shardfiles/slab-fixture/', offline: false, firstParty: true,
    cache: { product: () => Promise.resolve(null), asset: () => Promise.resolve(null), verifiedAsset: hash => Promise.resolve(assets.get(hash)?.slice() ?? null),
      putAsset: () => Promise.resolve(), putProduct: () => Promise.resolve() },
    fetch: () => Promise.reject(new Error('Only admitted source bytes are permitted')), hash: bytes => Promise.resolve(hashImmutableBytes(bytes)) });
  const product = createShardProduct({ slug: 'slab-fixture', revision: 1, shardfile: source, sections: new Map(), files: new Map(), read: () => Promise.reject(new Error('Use declared content hash')) });
  const [whole, slabs] = parseWorldScenes({ version: 1, materials: [], steps: [], libraries: [
    { id: 'fine', kind: 'whole', load: 'refine', models: [{ id: 'fabric', part: 'fabric', files: [...assets.keys()] }, { id: 'alias', part: 'alias', files: [...assets.keys()] }] },
    { id: 'fine-slabs', kind: 'slabs', of: 'fine', keys: [{ id: 'k0', node: 'fabric.node', material: 'kit', castShadow: true, receiveShadow: true, renderOrder: 2, layers: 1,
      frustumCulled: true, visible: true, sources: ['fabric', 'alias'] }], tiles: files }] }).libraries;
  if (whole?.kind !== 'whole' || slabs?.kind !== 'slabs') throw new Error('Missing fixture libraries');
  const queue = new ControlRefinement(owner, undefined, () => ({ x: -230, z: -230 }), () => Promise.resolve()), cover = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const library = new SlabLibrary(owner, product, whole, slabs, queue, cover), material = new MeshBasicMaterial();
  const anchor = new Mesh(library.geometry('fabric') ?? new BufferGeometry(), material), alias = new Mesh(library.geometry('alias') ?? new BufferGeometry(), material);
  const read = vi.spyOn(runtimeProduct(source).assets, 'read');
  const content = library.bind('fabric', anchor, owner), aliasContent = library.bind('alias', alias, owner);
  return { owner, shapes, anchor, alias, material, content, aliasContent, read, cover, close: () => {
    owner.dispose(); for (const shape of shapes) shape.dispose(); material.dispose(); bakeMaterial.dispose(); vi.restoreAllMocks();
  } };
}

test('a key draws its tiles\' chunks under its anchor, one instanced mesh each, and a retire takes only its own', async () => {
  const f = fixture(), first = f.owner.child('first'), second = f.owner.child('second');
  try {
    expect([...f.content.tiles()]).toEqual([0, 1]); expect([...f.aliasContent.tiles()]).toEqual([]);
    // NR4: the channel-less anchor and the merged alias stay out of the draw
    expect(f.anchor.visible).toBe(false); expect(f.alias.visible).toBe(false);
    const version = f.material.version;
    await f.content.attach(0, first);
    expect(f.read).toHaveBeenCalledTimes(1); expect(f.cover).toHaveBeenCalledOnce();
    expect(f.anchor.children).toHaveLength(2); expect(f.anchor.visible).toBe(true); expect(f.material.version).toBe(version);
    // EP7: the anchor holds its chunks but draws nothing itself (no empty call on a plain program)
    expect(f.anchor.layers.mask).toBe(0);
    // it keeps its channel-less stand-in, so the precompile links no plain program for it either
    expect(Object.keys(f.anchor.geometry.attributes)).toEqual([]); expect(f.anchor.geometry.index).toBeNull();
    const [a, b] = f.anchor.children, ga = geometryOf(a), gb = geometryOf(b);
    if (a === undefined) throw new Error('Expected chunk meshes');
    expect(Array.from(ga.getAttribute('position').array)).toEqual(Array.from(f.shapes[0]?.getAttribute('position').array ?? []));
    expect(Array.from(gb.getAttribute('position').array)).toEqual(Array.from(f.shapes[1]?.getAttribute('position').array ?? []));
    expect(Reflect.get(a, 'material')).toBe(f.material); expect(a.castShadow).toBe(true); expect(a.renderOrder).toBe(2); expect(a.matrixAutoUpdate).toBe(false);
    expect(ga.boundingSphere?.radius).toBe(1); expect(ga.boundingBox?.max.x).toBe(1);
    // EP7: one identity instance with white colours, drawn through its material's instanced (coloured) program
    if (!(a instanceof InstancedMesh)) throw new Error('Expected an instanced chunk');
    expect(a.count).toBe(1); expect(Array.from(a.instanceMatrix.array)).toEqual(new Matrix4().toArray());
    expect(Array.from(a.instanceColor?.array ?? [])).toEqual([1, 1, 1]);
    await f.content.attach(1, second);
    expect(f.anchor.children).toHaveLength(3); expect(f.material.version).toBe(version);
    first.dispose(); expect(f.anchor.children).toHaveLength(1);
    second.dispose(); expect(f.anchor.children).toHaveLength(0);
    // a later attach reads the retired tile again
    const again = f.owner.child('again'); await f.content.attach(0, again); expect(f.read).toHaveBeenCalledTimes(3); expect(f.anchor.children).toHaveLength(2);
  } finally { f.close(); }
});

