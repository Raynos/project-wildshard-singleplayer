import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Byte proof of standard GLB files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Immutable predecessor typed-array fingerprints.
import { createHash } from 'node:crypto';
import { BufferAttribute, BufferGeometry, Material, Mesh, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assembleWholeGeometryViews } from '../../../src/game/plugin/geometry';
import source from '../../../src/shards/nine-dragon-stack/shard.config';
import world from '../../../src/shards/nine-dragon-stack/data/world.generated.json' with { type: 'json' };
import predecessor from './sourceBytes.json' with { type: 'json' };
import portableNormals from './portableNormals.json' with { type: 'json' };

function fingerprint(geometry: BufferGeometry): Record<string, object> {
  const attrs = Object.entries(geometry.attributes), index = geometry.getIndex();
  if (index !== null) attrs.push(['index', index]);
  return Object.fromEntries(attrs.map(([name, attribute]) => {
    if (!(attribute instanceof BufferAttribute)) throw new Error(`Interleaved predecessor channel ${name}`);
    return [name, { type: attribute.array.constructor.name, half: 'isFloat16BufferAttribute' in attribute,
      components: attribute.itemSize, normalized: attribute.normalized,
      hash: createHash('sha256').update(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength)).digest('hex') }];
  }));
}

function isSourceMesh(node: Object3D): node is Mesh {
  if (!(node instanceof Mesh)) return false;
  const geometry: unknown = node.geometry, material: unknown = node.material;
  return geometry instanceof BufferGeometry && (material instanceof Material || Array.isArray(material) && material.every((row: unknown) => row instanceof Material));
}

describe('Nine static scene through bake()', () => {
  it('admits whole L0 fabric without double-binding its runtime draws', () => {
    expect(source.tiles.filter(tile => tile.lod === 0)).toHaveLength(34);
    expect(source.runtime?.binds).toContain('props');
    expect(source.files.filter(file => file.kind === 'glb')).toHaveLength(383);
    expect(source.files.every(file => file.compressed <= 25_000_000 && file.decoded <= 25_000_000 && file.gpu <= 25_000_000)).toBe(true);
  });
  it('reconstructs 122 source draws exactly, with the approved portable near-zero normals', async () => {
    const loader = new GLTFLoader(), observed: Record<string, Record<string, object>> = {};
    const sections = [source.props?.tiles.flatMap(tile => [tile.file].concat(tile.additionalFiles ?? [])).concat(world.libraries.layout) ?? [], world.libraries.boot, world.libraries.explorer];
    for (const refs of sections) {
      const nodes: Mesh[] = [];
      for (const hash of refs) {
        const bytes = readFileSync(new URL(`../../../src/shards/nine-dragon-stack/assets/${hash}`, import.meta.url));
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
        const gltf = await loader.parseAsync(Uint8Array.from(bytes).buffer, '');
        gltf.scene.traverse(node => { if (isSourceMesh(node)) nodes.push(node); });
      }
      const assembled = assembleWholeGeometryViews(nodes);
      try { for (const [id, view] of assembled) observed[id] = fingerprint(view.geometry); }
      finally {
        for (const view of assembled.values()) view.geometry.dispose();
        for (const node of nodes) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); }
      }
    }
    const expected: Record<string, Record<string, object>> = { ...predecessor };
    for (const [id, normal] of Object.entries(portableNormals)) expected[id] = { ...expected[id], normal };
    expect(observed).toEqual(expected);
    expect(Object.keys(observed)).toHaveLength(122);
  }, 60_000);
});
