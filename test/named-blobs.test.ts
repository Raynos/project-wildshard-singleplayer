import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- Author-source admission needs real filesystem/symlink refusal coverage.
import { mkdirSync, mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The fixture owns a bounded temporary project directory.
import { resolve } from 'node:path';
import { nameBlob, emitNamedBlobs, readNamedBlob } from '../src/sdk/blobs';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { compileGltfSource } from '../src/sdk/bake/gltfSource';
import { parseGlb } from '../src/sdk/assets';
import { NodeIO } from '@gltf-transform/core';

const wasm = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const position = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
const indices = new Uint16Array([0, 1, 2]);
const gltf = (uri = 'geometry.bin') => ({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
  buffers: [{ byteLength: position.byteLength, uri }, { byteLength: indices.byteLength, uri: `data:application/octet-stream;base64,${btoa(String.fromCodePoint(...new Uint8Array(indices.buffer)))}` }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: position.byteLength }, { buffer: 1, byteOffset: 0, byteLength: indices.byteLength }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }] });
const jsonBytes = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('named blobs derive hash paths/costs, own their bytes and refuse ambiguous or changed entries', () => {
  const source = Uint8Array.from(wasm), blob = nameBlob('behaviour/director.wasm', 'wasm', source, { critical: true });
  source.fill(255);
  expect(blob.bytes).toEqual(wasm);
  expect(blob.file).toMatchObject({ name: 'behaviour/director.wasm', path: `blobs/wasm/${hashImmutableBytes(wasm)}.wasm`, critical: true });
  const emitted = emitNamedBlobs([blob]);
  expect(emitted.assets.get(blob.file.hash)).toEqual(wasm);
  expect(emitted.files).toEqual([blob.file]);
  expect(() => nameBlob('../escape.wasm', 'wasm', wasm)).toThrow('logical name');
  expect(() => nameBlob('bad.wasm', 'wasm', new Uint8Array([1, 2]))).toThrow();
  expect(() => nameBlob('bad.bin', 'bin', wasm, { decoded: 0 })).toThrow('understate');
  expect(() => nameBlob('model.bin', 'bin', jsonBytes(gltf()))).toThrow('compile to GLB');
  expect(() => emitNamedBlobs([blob, blob])).toThrow('Duplicate');
  expect(() => emitNamedBlobs([blob, nameBlob('alias.wasm', 'wasm', wasm)])).toThrow('Duplicate');
  blob.bytes.fill(0);
  expect(() => emitNamedBlobs([blob])).toThrow();
});

test('text glTF compiles external and embedded buffers into an admitted GLB without geometry changes', async () => {
  const resources: string[] = [];
  const bytes = await compileGltfSource(jsonBytes(gltf()), uri => { resources.push(uri); return new Uint8Array(position.buffer); });
  expect(resources).toEqual(['geometry.bin']);
  const document = await new NodeIO().readBinary(bytes), primitive = document.getRoot().listMeshes()[0]?.listPrimitives()[0];
  expect(primitive?.getAttribute('POSITION')?.getArray()).toEqual(position);
  expect(primitive?.getIndices()?.getArray()).toEqual(indices);
  expect(parseGlb(bytes).triangles).toBeGreaterThan(0);
  expect(nameBlob('models/triangle.glb', 'glb', bytes).file.path).toMatch(/^blobs\/glb\/[a-f0-9]{64}\.glb$/u);
  await expect(compileGltfSource(jsonBytes({ ...gltf(), extensionsRequired: ['UNSUPPORTED_extension'] }), () => { throw new Error('Never read'); })).rejects.toThrow('unsupported extension');
});

test('named source intake refuses remote resources and project escapes including symlinks', async () => {
  mkdirSync(resolve('tmp'), { recursive: true });
  const scratch = mkdtempSync(resolve('tmp/named-blobs-')), project = resolve(scratch, 'project');
  mkdirSync(project);
  try {
    writeFileSync(resolve(project, 'model.gltf'), jsonBytes(gltf()));
    writeFileSync(resolve(project, 'geometry.bin'), new Uint8Array(position.buffer));
    writeFileSync(resolve(scratch, 'outside.bin'), wasm);
    symlinkSync(resolve(scratch, 'outside.bin'), resolve(project, 'escape.bin'));
    const blob = await readNamedBlob(project, 'models/triangle.glb', 'model.gltf', 'glb');
    expect(blob.file.kind).toBe('glb');
    const packed = await readNamedBlob(project, 'models/triangle.glb', 'model.gltf', 'glb', { meshopt: true });
    expect(packed.file.hash).not.toBe(blob.file.hash);
    expect(parseGlb(packed.bytes)).toMatchObject({ gpu: blob.file.gpu, triangles: blob.file.triangles, draws: blob.file.draws });
    await expect(readNamedBlob(project, 'bad.bin', 'geometry.bin', 'bin', { meshopt: true })).rejects.toThrow('GLB');
    await expect(readNamedBlob(project, 'escape.bin', '../outside.bin', 'bin')).rejects.toThrow('escapes');
    await expect(readNamedBlob(project, 'escape.bin', 'escape.bin', 'bin')).rejects.toThrow('escapes');
    await expect(readNamedBlob(project, 'model.bin', 'model.gltf', 'bin')).rejects.toThrow('GLB');
    writeFileSync(resolve(project, 'remote.gltf'), jsonBytes(gltf('https://example.invalid/geometry.bin')));
    await expect(readNamedBlob(project, 'models/remote.glb', 'remote.gltf', 'glb')).rejects.toThrow('local relative');
    writeFileSync(resolve(project, 'outside.gltf'), jsonBytes(gltf('../outside.bin')));
    await expect(readNamedBlob(project, 'models/outside.glb', 'outside.gltf', 'glb')).rejects.toThrow('escapes');
  } finally { rmSync(scratch, { recursive: true }); }
});
