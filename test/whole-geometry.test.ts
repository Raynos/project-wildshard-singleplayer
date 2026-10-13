import { BufferAttribute, BufferGeometry, Float16BufferAttribute, Float32BufferAttribute, Group, Matrix4, Mesh, type Object3D, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { bakeProps } from '../src/sdk/bake/props';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseGlb } from '../src/sdk/assets';
import { assembleWholeGeometryViews, nativeWholeGeometry } from '../src/game/plugin/geometry';
import { validatePropsReferences } from '../src/format/props';
import { parseShardfile } from '../src/sdk/shardfile';
import template from '../src/shards/_template/shard.config';
import ink from '../src/shards/ink-cel-valley/shard.config';
import pastel from '../src/shards/pastel-plain/shard.config';
import sky from '../src/shards/far-reach/shard.config';
import signal from '../src/shards/sunscar-dunes/shard.config';

function isMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }
const meshes = (root: Group): Mesh[] => { const nodes: Mesh[] = []; root.traverse(node => { if (isMesh(node)) nodes.push(node); }); return nodes; };
describe('shared runtime whole-geometry assembly', () => {
  it('admits existing Template, Ink, Pastel, Sky and Signal declarations unchanged', () => {
    for (const source of [template, ink, pastel, sky, signal]) {
      expect(parseShardfile(source)).toEqual(source);
      for (const tile of source.props?.tiles ?? []) expect(Object.hasOwn(tile, 'additionalFiles')).toBe(false);
    }
  });
  it('retains UVs and every typed shader channel with native storage alone', async () => {
    const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
      .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
      .setAttribute('uv', new Float16BufferAttribute(new Uint16Array([0, 0x3c00, 0x3c00, 0, 0, 0]), 2))
      .setAttribute('wind', new BufferAttribute(new Int8Array([-128, 1, 127]), 1, true));
    const baked = bakeProps({ static: new Group(), whole: [{ id: 'pool', mesh: new Mesh(source, new MeshStandardMaterial()), transform: new Matrix4(), nativeAttributes: true }] });
    const bytes = [...baked.assets.values()][0]; if (bytes === undefined) throw new Error('Missing native whole GLB');
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, ''), node = meshes(parsed.scene)[0];
    if (node === undefined) throw new Error('Missing native whole node');
    const result = nativeWholeGeometry(node);
    for (const [key, attribute] of Object.entries(source.attributes)) {
      expect(result.getAttribute(key).array).toEqual(attribute.array);
      expect(result.getAttribute(key).normalized).toBe(attribute.normalized);
      expect(result.getAttribute(key).array.constructor).toBe(attribute.array.constructor);
    }
  });
  it('retains a four-component shader normal in a typed application accessor', async () => {
    const source = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
      .setAttribute('normal', new Float16BufferAttribute(new Uint16Array([0, 0x3c00, 0, 0x4000, 0, 0x3c00, 0, 0x4200, 0, 0x3c00, 0, 0x4400]), 4));
    const bytes = staticGlb([{ geometry: source, material: new MeshStandardMaterial(), nativeAttributes: true, compactIndex: true }]);
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, ''), node = meshes(parsed.scene)[0];
    if (node === undefined) throw new Error('Missing native node');
    const result = nativeWholeGeometry(node);
    expect(result.getAttribute('normal').itemSize).toBe(4);
    expect(result.getAttribute('normal').array).toEqual(source.getAttribute('normal').array);
  });
  it('splits one tile into admitted bounded GLBs and reconstructs one exact original draw', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const count = 126000, source = new BufferGeometry();
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { positions[i * 3] = (i % 3 === 1 ? 1 : 0); positions[i * 3 + 2] = (i % 3 === 2 ? 1 : 0); }
      source.setAttribute('position', new BufferAttribute(positions, 3)).setAttribute('normal', new BufferAttribute(new Float32Array(count * 3).fill(0.5), 3));
      for (let i = 0; i < 13; i++) source.setAttribute(`shader${i}`, new Float32BufferAttribute(new Float32Array(count * 4).fill(i + 0.25), 4));
      const transform = new Matrix4().makeTranslation(1 / 3, 125, 1 / 7);
      const result = bakeProps({ static: new Group(), whole: [{ id: 'fabric', mesh: new Mesh(source, new MeshStandardMaterial()), transform, partition: true }] });
      expect(result.props.tiles).toHaveLength(1);
      expect(result.props.tiles[0]?.additionalFiles?.length).toBeGreaterThan(0);
      validatePropsReferences(result.props, { files: result.files, tiles: result.tiles, library: result.library, far: result.far });
      const nodes: Mesh[] = [];
      for (const bytes of result.assets.values()) {
        expect(parseGlb(bytes).decoded).toBeLessThanOrEqual(25000000);
        const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, ''); nodes.push(...meshes(parsed.scene));
      }
      const restored = assembleWholeGeometryViews([...nodes].reverse());
      expect(restored.size).toBe(1);
      const output = restored.get('fabric'); if (output === undefined) throw new Error('Missing original draw');
      expect(output.matrix.elements).toEqual(transform.elements);
      expect(output.geometry.index).toBeNull();
      for (const [name, attribute] of Object.entries(source.attributes)) expect(output.geometry.getAttribute(name).array).toEqual(attribute.array);
      expect(() => assembleWholeGeometryViews(nodes.slice(0, 1))).toThrow('incomplete');
      expect(() => assembleWholeGeometryViews([...nodes, ...nodes])).toThrow('duplicate');
    } finally { warn.mockRestore(); }
  });
});
