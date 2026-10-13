import { describe, expect, it } from 'vitest';
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { staticGlb } from '../src/sdk/bake/glb';
import { bakeKinds } from '../src/sdk/bake/kinds';
import { parseGlb, visitGlbTriangles } from '../src/format/product';
import { applyExactInstanceMatrices } from '../src/engine/anim/rig';
import { contentHash } from '../src/sdk/project';

const geometry = new BoxGeometry(1, 2, 3), material = new MeshStandardMaterial();
function matrices(): Matrix4[] {
  return Array.from({ length: 64 }, (_, i) => {
    const q = new Quaternion((i + 1) / 67, 0.1234, 0.3456, 0.789).normalize();
    const matrix = new Matrix4().compose(new Vector3(i * 1.234, 0.1, -0.3), q, new Vector3(0.7, 1.3, 2.1));
    return new Matrix4().fromArray(new Float32Array(matrix.elements));
  });
}
async function mesh(bytes: Uint8Array): Promise<InstancedMesh> {
  const gltf = await new GLTFLoader().parseAsync(bytes.slice().buffer, '');
  applyExactInstanceMatrices(gltf.scene);
  const object = gltf.scene.children[0];
  if (!(object instanceof InstancedMesh)) throw new Error('Missing actual loaded instances');
  return object;
}
/** Change only admitted JSON or instance bytes, keeping chunk layout and length valid. */
function mutate(bytes: Uint8Array, edit: (doc: Record<string, unknown>, bin: Uint8Array) => void): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), length = view.getUint32(12, true);
  const raw: unknown = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + length)));
  const doc = record(raw), bin = bytes.slice(28 + length); edit(doc, bin);
  const json = new TextEncoder().encode(JSON.stringify(doc)), n = (json.length + 3) & ~3, out = new Uint8Array(28 + n + bin.length), writer = new DataView(out.buffer);
  out.set(bytes.subarray(0, 12)); writer.setUint32(8, out.length, true); writer.setUint32(12, n, true); writer.setUint32(16, 0x4e4f534a, true);
  out.fill(32, 20, 20 + n); out.set(json, 20); writer.setUint32(20 + n, bin.length, true); writer.setUint32(24 + n, 0x004e4942, true); out.set(bin, 28 + n);
  return out;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function record(value: unknown): Record<string, unknown> { if (!isRecord(value)) throw new Error('Expected record'); return value; }
function attrs(doc: Record<string, unknown>): Record<string, unknown> {
  const nodes = doc['nodes']; if (!Array.isArray(nodes)) throw new Error('Expected nodes');
  const extensions = record(record(nodes[0])['extensions']);
  return record(record(extensions['EXT_mesh_gpu_instancing'])['attributes']);
}
function matrixOffset(doc: Record<string, unknown>): number {
  const id = attrs(doc)['_MATRIX'], accessors = doc['accessors'], views = doc['bufferViews'];
  if (typeof id !== 'number' || !Array.isArray(accessors) || !Array.isArray(views)) throw new Error('Expected matrix accessor');
  const accessor = record(accessors[id]), bv = accessor['bufferView']; if (typeof bv !== 'number') throw new Error('Expected buffer view');
  const offset = record(views[bv])['byteOffset']; if (typeof offset !== 'number') throw new Error('Expected byte offset'); return offset;
}

describe('exact optional instance attributes', () => {
  it('keeps legacy TRS byte fixtures and admission costs unchanged', async () => {
    const bytes = staticGlb([{ geometry, material, instances: matrices().slice(0, 2) }], 'fixture');
    expect(contentHash(bytes)).toBe('94d23bc8f72824fcade80699912504336e0fd335e68c9ae517af441b652e202c');
    const cost = parseGlb(bytes), restored = await mesh(bytes);
    expect(restored.count).toBe(2); expect(restored.instanceColor).toBeNull();
    expect(cost).toEqual({"decoded": 2624, "gpu": 1120, "triangles": 24, "draws": 2});
  });

  it('restores every float32 matrix and linear RGB colour byte exactly', async () => {
    const instances = matrices(), colours = instances.map((_, i) => new Color(i / 64, 0.4, 0.8));
    const bytes = staticGlb([{ geometry, material, instances, exactInstances: true, instanceColours: colours }]);
    expect(() => parseGlb(bytes)).not.toThrow();
    const restored = await mesh(bytes);
    expect(new Uint8Array(restored.instanceMatrix.array.buffer)).toEqual(new Uint8Array(new Float32Array(instances.flatMap(m => m.elements)).buffer));
    const color = restored.instanceColor; if (color === null) throw new Error('Missing actual instance colour');
    expect(new Uint8Array(color.array.buffer)).toEqual(new Uint8Array(new Float32Array(colours.flatMap(c => [c.r, c.g, c.b])).buffer));
    expect(restored.geometry.hasAttribute('_MATRIX')).toBe(false);
    const trs = await mesh(staticGlb([{ geometry, material, instances }]));
    expect(trs.instanceMatrix.array).not.toEqual(restored.instanceMatrix.array);
  });

  it('admits colours with ordinary TRS and leaves absent exact matrices untouched', async () => {
    const bytes = staticGlb([{ geometry, material, instances: [new Matrix4()], instanceColours: [new Color(0.2, 0.4, 0.6)] }]);
    const restored = await mesh(bytes), before = restored.instanceMatrix.array.slice(), version = restored.instanceMatrix.version;
    applyExactInstanceMatrices(restored);
    expect(restored.instanceMatrix.array).toEqual(before); expect(restored.instanceMatrix.version).toBe(version);
    expect(restored.instanceColor?.array).toEqual(new Float32Array([0.2, 0.4, 0.6]));
  });

  it('uses exact matrices in the renderer-free triangle reader', () => {
    const matrix = matrices()[5]; if (matrix === undefined) throw new Error('Missing fixture matrix');
    const bytes = staticGlb([{ geometry, material, instances: [matrix], exactInstances: true }]);
    const actual: number[][] = [], expected: number[][] = [];
    visitGlbTriangles(bytes, triangle => { for (const point of triangle) actual.push([point.x, point.y, point.z]); });
    const position = geometry.getAttribute('position'), index = geometry.getIndex();
    if (index === null) throw new Error('Missing fixture indices');
    for (let i = 0; i < index.count; i++) expected.push(new Vector3().fromBufferAttribute(position, index.getX(i)).applyMatrix4(matrix).toArray());
    expect(actual).toEqual(expected);
  });

  it('opts bakedKinds into the exact matrix and colour path', async () => {
    const instances = matrices(), object = new InstancedMesh(geometry, material, instances.length);
    instances.forEach((matrix, i) => { object.setMatrixAt(i, matrix); object.setColorAt(i, new Color(i / 64, 0.2, 0.3)); });
    expect(() => bakeKinds('fixture', [['kind', object]], [])).toThrow('per-instance colours');
    const output = bakeKinds('fixture', [['kind', object]], [], { exactInstances: true });
    const restored = await mesh(output.glb);
    expect(restored.instanceMatrix.array).toEqual(object.instanceMatrix.array);
    expect(restored.instanceColor?.array).toEqual(object.instanceColor?.array);
  });

  it('refuses ambiguous, malformed or non-affine exact attributes', () => {
    const bytes = staticGlb([{ geometry, material, instances: [new Matrix4()], exactInstances: true }]);
    expect(() => parseGlb(mutate(bytes, doc => { attrs(doc)['TRANSLATION'] = attrs(doc)['_MATRIX']; }))).toThrow('cannot mix');
    for (const [key, value] of [['type', 'VEC4'], ['componentType', 5123], ['normalized', true], ['normalized', 'false'], ['count', 0]] as const) {
      expect(() => parseGlb(mutate(bytes, doc => {
        const id = attrs(doc)['_MATRIX'], list = doc['accessors'];
        if (typeof id !== 'number' || !Array.isArray(list)) throw new Error('Missing accessor');
        record(list[id])[key] = value;
      }))).toThrow();
    }

    for (const [component, value] of [[3, 0.1], [15, 0], [0, 0], [0, -1], [0, Infinity], [0, Number.NaN], [0, 1001]] as const) {
      expect(() => parseGlb(mutate(bytes, (doc, bin) => { new DataView(bin.buffer).setFloat32(matrixOffset(doc) + component * 4, value, true); }))).toThrow();
    }
    expect(() => staticGlb([{ geometry, material, exactInstances: true }])).toThrow('need instances');
    expect(() => staticGlb([{ geometry, material, instances: [new Matrix4()], instanceColours: [] }])).toThrow('match instance count');
    expect(() => staticGlb([{ geometry, material, instances: [new Matrix4()], instanceColours: [new Color(-0.1, 0, 0)] }])).toThrow('instance transform');
  });
});
