// oxlint-disable-next-line import/no-nodejs-modules -- Read retained GLBs to verify exact offline channels and atlas bytes.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the actual source painter without its publication adapter.
import { resolve } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { build } from 'vite';
import { readSourceModel } from '@wildshard/sdk/bake/skinned';
import { assertConfigBoundary } from '../../../src/sdk/configBoundary';
import { MODEL_FILES, bakeModelPaint, cloneFrame } from '../../../src/shards/nalati-grasslands/generators/modelPaint.mjs';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import originals from '../../fixtures/nalati-model-paint.json' with { type: 'json' };
import { worldFiles, nalatiBootAssets } from '../../../src/shards/nalati-grasslands/generators/bootFiles';
import { rawFromGltf, bakeVertexAO } from '../../../src/shards/nalati-grasslands/generators/modelPainting';

const words = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute): Uint8Array => {
  if (!(a instanceof THREE.BufferAttribute)) throw new Error('Expected packed channel');
  return new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
};
const equal = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, i) => value === b[i]);
const firstMesh = (scene: THREE.Object3D): THREE.Mesh => {
  const isMesh = (node: THREE.Object3D): node is THREE.Mesh => node instanceof THREE.Mesh;
  const meshes: THREE.Mesh[] = []; scene.traverse(node => { if (isMesh(node)) meshes.push(node); });
  const mesh = meshes[0]; if (mesh === undefined) throw new Error('Missing model'); return mesh;
};

describe('Nalati fixed model paint', () => {
  it('owns all 43 original GLBs in one publication-free author bundle', async () => {
    expect([...MODEL_FILES].sort()).toEqual(originals.map(row => row.file).sort());
    expect(originals.reduce((bytes, row) => bytes + row.bytes, 0)).toBe(14247456);
    const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
      lib: { entry: resolve('src/shards/nalati-grasslands/generators/modelPaint.mjs'), formats: ['es'] },
      rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } },
    } });
    const built = Array.isArray(result) ? result[0] : result;
    if (built === undefined || !('output' in built)) throw new Error('Missing model-paint author bundle');
    const chunks = built.output.filter(row => row.type === 'chunk');
    expect(chunks).toHaveLength(1);
    for (const chunk of chunks) {
      const imports = [...chunk.imports, ...chunk.dynamicImports];
      expect(() => assertConfigBoundary(imports)).not.toThrow();
      expect(imports).not.toContain('node:fs');
      expect(Object.keys(chunk.modules).some(path => path.endsWith('/scripts/bake-output.mjs'))).toBe(false);
      expect(() => assertConfigBoundary([...imports, 'node:fs'])).toThrow('must use injected build capabilities');
    }
  });
  it('prefetches creature rigs while painted near and far models use product files', () => {
    const prepared = '/assets/nalati/baked/painted-models/';
    const rig = '/assets/nalati/models/wolf.rigged.glb', phoneRig = '/assets/nalati/models/wolf.phone.rigged.glb';
    const inventory = { [`${prepared}boulder-1.glb`]: 1, [`${prepared}boulder-1.phone.glb`]: 1,
      [`${prepared}horse-wild.far.glb`]: 1, '/assets/nalati/models/boulder-1.glb': 1, [rig]: 1, [phoneRig]: 1 };
    for (const tier of ['phone', 'desktop'] as const) {
      const files = worldFiles(tier, nalatiBootAssets(`/assets/nalati/baked/bodies-${'0'.repeat(64)}.bin`), inventory);
      expect(files).not.toContain(`${prepared}boulder-1.glb`);
      expect(files).not.toContain(`${prepared}boulder-1.phone.glb`);
      expect(files).not.toContain(`${prepared}horse-wild.far.glb`);
      expect(files).toContain(tier === 'phone' ? phoneRig : rig);
      expect(files).not.toContain('/assets/nalati/models/boulder-1.glb');
    }
  });
  it.each(MODEL_FILES)('roundtrips exact channels, fitted paint and atlas: %s', async file => {
    const name = file.split('.')[0]; if (name === undefined) throw new Error('Missing model name');
    const input = readFileSync(`public/assets/nalati/models/${file}`), source = await readSourceModel(input);
    const expected = rawFromGltf(source.gltf.scene, name).geometry;
    const plain = expected.getAttribute('color').array;
    if (!(plain instanceof Float32Array)) throw new Error('Expected Float32 colours');
    const clone = cloneFrame(name, expected.clone());
    expected.setAttribute('color', new THREE.BufferAttribute(bakeVertexAO(expected, plain), 3));
    const bytes = await bakeModelPaint(input, name);
    const original = originals.find(row => row.file === file);
    if (original === undefined) throw new Error(`Missing original GLB pin: ${file}`);
    expect(bytes.length).toBe(original.bytes);
    expect(hashImmutableBytes(bytes)).toBe(original.sha256);
    const prepared = await readSourceModel(bytes), mesh = firstMesh(prepared.gltf.scene);
    expect(mesh.matrixWorld.equals(new THREE.Matrix4())).toBe(true);
    for (const channel of Object.keys(expected.attributes)) expect(equal(words(mesh.geometry.getAttribute(channel)), words(expected.getAttribute(channel)))).toBe(true);
    const a = mesh.geometry.index, b = expected.index;
    expect(a?.array.constructor.name).toBe(b?.array.constructor.name);
    expect(a === null || b === null ? a === b : equal(words(a), words(b))).toBe(true);
    if (clone !== null) expect(equal(words(mesh.geometry.getAttribute('_paint_clone')), new Uint8Array(bakeVertexAO(clone, plain).buffer))).toBe(true);
    const material = firstMesh(source.gltf.scene).material, output = mesh.material;
    if (Array.isArray(material) || Array.isArray(output)) throw new Error('Expected single material');
    const before = source.texture(material), after = prepared.texture(output);
    expect(after?.mimeType).toBe(before?.mimeType); expect(after?.sampler).toEqual(before?.sampler);
    expect(equal(after?.image ?? new Uint8Array(), before?.image ?? new Uint8Array())).toBe(true);
  });
});
