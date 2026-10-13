import { BufferAttribute, BufferGeometry, Float16BufferAttribute, Float32BufferAttribute, Group, InstancedMesh, Matrix4, InterleavedBufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { staticGlb } from '../src/sdk/bake/glb';
import { assembleWholeGeometry, bakeProps, partitionWholeGeometry } from '../src/sdk/bake/props';
import { parseGlb } from '../src/sdk/assets';

function geometry(): BufferGeometry {
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    .setAttribute('splat', new Float32BufferAttribute([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 4))
    .setAttribute('surf', new Float32BufferAttribute([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 4))
    .setAttribute('rdir', new Float32BufferAttribute([0.25, 0.5, 0.75, 1, -1, 0], 2))
    .setAttribute('zone', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3))
    .setAttribute('canopy', new Float32BufferAttribute([0, 0.5, 1], 1)).setIndex([0, 2, 1]);
}
describe('native terrain GLB application channels', () => {
  it('preserves explicit named nodes through the actual loader and keeps unnamed bytes unchanged', async () => {
    const g = geometry(), material = new MeshStandardMaterial();
    const original = staticGlb([{ geometry: g, material }, { geometry: g, material }], 'beacon');
    const named = staticGlb([{ name: 'tower', geometry: g, material }, { name: 'flame', geometry: g, material }], 'beacon');
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(named).buffer, '');
    expect(parsed.scene.children.map(child => child.name)).toEqual(['tower', 'flame']);
    for (const child of parsed.scene.children) {
      if (!(child instanceof Mesh)) throw new Error('Expected separate loaded mesh');
      const loaded: unknown = child.geometry;
      if (!(loaded instanceof BufferGeometry)) throw new Error('Expected actual loaded geometry');
      const position: unknown = loaded.getAttribute('position');
      if (!(position instanceof BufferAttribute) && !(position instanceof InterleavedBufferAttribute)) throw new Error('Expected loaded vertex positions');
      expect(Array.from(position.array)).toEqual(Array.from(g.getAttribute('position').array));
      expect(Array.from(loaded.getIndex()?.array ?? [])).toEqual(Array.from(g.getIndex()?.array ?? []));
    }
    const namedCost = parseGlb(named), oldCost = parseGlb(original);
    expect({ ...namedCost, decoded: oldCost.decoded }).toEqual(oldCost);
    expect(namedCost.decoded - oldCost.decoded).toBe(named.length - original.length);
    expect(staticGlb([{ geometry: g, material }, { geometry: g, material }], 'beacon')).toEqual(original);
    for (const name of ['', 'with.space', 'with space', 'a'.repeat(129), 'beacon'])
      expect(() => staticGlb([{ name, geometry: g, material }, { geometry: g, material }], 'beacon')).toThrow('unique loader-safe');
    expect(() => staticGlb([{ name: 'flame', geometry: g, material }, { name: 'flame', geometry: g, material }])).toThrow('unique loader-safe');
  });
  it('round-trips Pine/Nalati channels through the actual loader and charges their emitted bytes', async () => {
    const g = geometry(), material = new MeshStandardMaterial(); material.name = 'pine.native-ground';
    const customAttributes = { _SPLAT: 'splat', _SURF: 'surf', _RDIR: 'rdir', _ZONE: 'zone', _CANOPY: 'canopy' };
    const bytes = staticGlb([{ geometry: g, material, customAttributes }]);
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    let meshes = 0;
    parsed.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const loadedGeometry: unknown = object.geometry;
      if (!(loadedGeometry instanceof BufferGeometry)) throw new Error('Expected actual loaded BufferGeometry');
      meshes++;
      for (const [semantic, name] of Object.entries(customAttributes)) {
        const original = g.getAttribute(name);
        const loaded: unknown = loadedGeometry.getAttribute(semantic.toLowerCase());
        if (!(loaded instanceof BufferAttribute) && !(loaded instanceof InterleavedBufferAttribute)) throw new Error('Expected loaded vertex channel');
        expect(loaded.itemSize).toBe(original.itemSize);
        expect(Array.from(loaded.array)).toEqual(Array.from(original.array));
      }
    });
    expect(meshes).toBe(1);
    const cost = parseGlb(bytes), plain = parseGlb(staticGlb([{ geometry: g, material }]));
    expect(cost.decoded).toBeGreaterThan(plain.decoded); expect(cost.gpu).toBeGreaterThan(plain.gpu);
  });
  it('keeps the old byte path when no custom channels are requested and is deterministic', () => {
    const g = geometry(), material = new MeshStandardMaterial();
    expect(staticGlb([{ geometry: g, material }])).toEqual(staticGlb([{ geometry: g, material, customAttributes: {} }]));
    const customAttributes = { _ZONE: 'zone', _SURF: 'surf' };
    expect(staticGlb([{ geometry: g, material, customAttributes }])).toEqual(staticGlb([{ geometry: g, material, customAttributes: { _SURF: 'surf', _ZONE: 'zone' } }]));
  });
  it('refuses missing, non-application and malformed attributes instead of silently dropping them', () => {
    const g = geometry(), material = new MeshStandardMaterial();
    expect(() => staticGlb([{ geometry: g, material, customAttributes: { _SURF: 'missing' } }])).toThrow('custom attribute _SURF');
    expect(() => staticGlb([{ geometry: g, material, customAttributes: { NORMAL: 'normal' } }])).toThrow('custom attribute NORMAL');
    g.setAttribute('zone', new Float32BufferAttribute([1, 2, 3], 3));
    expect(() => staticGlb([{ geometry: g, material, customAttributes: { _ZONE: 'zone' } }])).toThrow('Mismatched');
  });
});


describe('native whole-shape storage', () => {
  it('retains half-float bits, normalized bytes, custom names and source transform doubles through GLTFLoader', async () => {
    const g = geometry(), material = new MeshStandardMaterial({ vertexColors: true });
    const halves = new Uint16Array([0x3c00, 0, 0, 0, 0x3c00, 0, 0, 0, 0x3c00]);
    g.setAttribute('normal', new Float16BufferAttribute(halves, 3));
    g.setAttribute('color', new BufferAttribute(new Uint8Array([255, 17, 3, 1, 2, 3, 0, 128, 255]), 3, true));
    g.setAttribute('ink', new BufferAttribute(new Int8Array([-128, 0, 127]), 1, true));
    const transform = new Matrix4().makeTranslation(0.123456789012345, 125, -0.987654321098765);
    const props = bakeProps({ static: new Group(), whole: [{ id: 'nine_fabric', mesh: new Mesh(g, material), transform,
      customAttributes: { _INK: 'ink' }, nativeAttributes: true }] });
    expect(props.tiles).toHaveLength(1);
    const bytes = props.assets.get(props.props.tiles[0]?.file ?? '');
    if (bytes === undefined) throw new Error('Missing whole tile');
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    const mesh = loaded.scene.getObjectByName('nine_fabric');
    if (!(mesh instanceof Mesh)) throw new Error('Missing whole mesh');
    const restored: unknown = mesh.geometry;
    if (!(restored instanceof BufferGeometry)) throw new Error('Missing geometry');
    const channel = (name: string): { array: ArrayLike<number>; normalized: boolean } => {
      const attribute: unknown = restored.getAttribute(name);
      if (!(attribute instanceof BufferAttribute)) throw new Error(`Missing channel ${name}`);
      return { array: attribute.array, normalized: attribute.normalized };
    };
    expect(Array.from(channel('_ws_raw_normal').array)).toEqual(Array.from(halves));
    expect(Array.from(channel('_ws_raw_color_0').array)).toEqual(Array.from(g.getAttribute('color').array));
    expect(channel('_ws_raw_color_0').normalized).toBe(true);
    expect(Array.from(channel('_ws_raw_ink').array)).toEqual([-128, 0, 127]);
    expect(mesh.userData['matrix64']).toEqual(transform.elements);
    expect(mesh.userData['nativeAttributes']).toMatchObject({
      position: { semantic: 'POSITION', storage: 'Float32Array', normalized: false, itemSize: 3 },
      normal: { semantic: '_WS_RAW_NORMAL', storage: 'Float16Array', normalized: false, itemSize: 3 },
      color: { semantic: '_WS_RAW_COLOR_0', storage: 'Uint8Array', normalized: true, itemSize: 3 },
      ink: { semantic: '_WS_RAW_INK', storage: 'Int8Array', normalized: true, itemSize: 1 },
    });
    expect(parseGlb(bytes).gpu).toBeGreaterThan(0);
  });
  it('keeps instance transform doubles beside portable float32 instancing', async () => {
    const matrix = new Matrix4().makeTranslation(1 / 3, 2 / 7, 3 / 11);
    const bytes = staticGlb([{ geometry: geometry(), material: new MeshStandardMaterial(), instances: [matrix], nativeAttributes: true }]);
    const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    const mesh = loaded.scene.children[0];
    if (!(mesh instanceof InstancedMesh)) throw new Error('Missing instances');
    expect(mesh.userData['instances64']).toEqual([matrix.elements]);
  });
});


it('reports provisional whole-tile caps while retaining exact admitted costs', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  try {
    const props = bakeProps({ static: new Group(), whole: Array.from({ length: 9 }, (_, i) => ({
      id: `fabric_${i}`, mesh: new Mesh(geometry(), new MeshStandardMaterial()), transform: new Matrix4(),
    })) });
    expect(props.report[0]?.draws).toBe(9);
    expect(props.report[0]?.warnings).toContain('draws 9 > 8');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('provisional caps'));
    const bytes = props.assets.get(props.props.tiles[0]?.file ?? '');
    if (bytes === undefined) throw new Error('Missing admitted tile');
    expect(parseGlb(bytes).draws).toBe(props.report[0]?.draws);
    expect(parseGlb(bytes).triangles).toBe(props.report[0]?.triangles);
  } finally { warn.mockRestore(); }
});


describe('exact whole geometry partitioning', () => {
  it('owns each triangle once by transformed centroid and restores every raw source byte in any order', () => {
    const source = new BufferGeometry()
      .setAttribute('position', new Float32BufferAttribute([-80, 0, -80, -60, 0, -80, -80, 0, -60, 60, 0, 60, 80, 0, 60, 60, 0, 80, 0, -0, 0], 3))
      .setAttribute('normal', new Float16BufferAttribute(new Uint16Array(21).fill(0x3c00), 3))
      .setAttribute('color', new BufferAttribute(new Uint8Array(21).map((_, i) => i * 7), 3, true))
      .setAttribute('ink', new BufferAttribute(new Int8Array([-128, 17, 127, -1, 0, 42, -7]), 1, true))
      .setIndex(new BufferAttribute(new Uint16Array([0, 1, 2, 3, 4, 5]), 1));
    source.computeBoundingBox(); source.computeBoundingSphere(); source.addGroup(0, 3, 0); source.addGroup(3, 3, 0);
    const parts = partitionWholeGeometry(source, new Matrix4().makeTranslation(10, 0, 10));
    expect(parts.map(part => [part.x, part.z, part.triangles])).toEqual([[2, 2, [0]], [5, 5, [1]]]);
    const restored = assembleWholeGeometry(source, [...parts].reverse());
    for (const [key, attribute] of Object.entries(source.attributes)) {
      const actual = restored.getAttribute(key);
      expect(actual.array.constructor).toBe(attribute.array.constructor);
      expect(actual.normalized).toBe(attribute.normalized);
      expect(new Uint8Array(actual.array.buffer, actual.array.byteOffset, actual.array.byteLength)).toEqual(new Uint8Array(attribute.array.buffer, attribute.array.byteOffset, attribute.array.byteLength));
    }
    expect(restored.index?.array).toEqual(source.index?.array);
    expect(restored.groups).toEqual(source.groups);
    expect(restored.boundingBox).toEqual(source.boundingBox);
    expect(restored.boundingSphere).toEqual(source.boundingSphere);
    expect(() => assembleWholeGeometry(source, parts.slice(0, 1))).toThrow('incomplete');
    expect(() => assembleWholeGeometry(source, [...parts, ...parts])).toThrow('duplicate');
  });
  it('keeps non-indexed topology and puts actual whole GLB subsets in their owning tiles', async () => {
    const source = new BufferGeometry()
      .setAttribute('position', new Float32BufferAttribute([-80, 0, -80, -60, 0, -80, -80, 0, -60, 60, 0, 60, 80, 0, 60, 60, 0, 80], 3))
      .setAttribute('normal', new Float32BufferAttribute(new Float32Array(18).fill(0.5), 3));
    const parts = partitionWholeGeometry(source);
    expect(assembleWholeGeometry(source, parts).index).toBeNull();
    const props = bakeProps({ static: new Group(), whole: [{ id: 'trail', mesh: new Mesh(source, new MeshStandardMaterial()), transform: new Matrix4(), partition: true, nativeAttributes: true }] });
    expect(props.props.tiles.map(tile => [tile.x, tile.z])).toEqual([[2, 2], [5, 5]]);
    const owned: unknown[] = [];
    for (const bytes of props.assets.values()) {
      const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
      owned.push(...loaded.scene.children.map(node => { const row: unknown = node.userData['wholePartition']; return row; }));
    }
    expect(owned).toEqual([
      { id: 'trail', vertices: [0, 1, 2], triangles: [0], vertexCount: 6, indexCount: 0, index: 'none' },
      { id: 'trail', vertices: [3, 4, 5], triangles: [1], vertexCount: 6, indexCount: 0, index: 'none' },
    ]);
    expect(props.report.reduce((total, row) => total + row.triangles, 0)).toBe(2);
  });
});
