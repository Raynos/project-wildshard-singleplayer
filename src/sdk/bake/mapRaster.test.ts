// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining source module without publishing a product.
import { resolve } from 'node:path';
import { Document, WebIO } from '@gltf-transform/core';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { assertConfigBoundary } from '../configBoundary';
import { MapRaster } from './mapRaster';

function floor(height: number): Promise<Uint8Array> {
  const doc = new Document(), buffer = doc.createBuffer();
  const position = doc.createAccessor().setBuffer(buffer).setType('VEC3')
    .setArray(new Float32Array([200, height, 200, 200, height, 150, 150, height, 200]));
  const mesh = doc.createMesh('floor').addPrimitive(doc.createPrimitive().setAttribute('POSITION', position));
  doc.createScene().addChild(doc.createNode('floor').setMesh(mesh));
  return new WebIO().writeBinary(doc);
}

test('owned GLBs need no reader and documents cache by exact input identity', async () => {
  const bytes = await floor(4), raster = new MapRaster(100);
  const doc = await raster.document(bytes);
  expect(await raster.document(bytes) === doc).toBe(true);
  expect(await raster.document(new Uint8Array(bytes)) === doc).toBe(false);
  await raster.glb(bytes);
  expect(raster.triangles).toBe(1);
  expect(raster.height[12 * 100 + 12]).toBe(4 * 65536);
  await expect(raster.document('ungranted.glb')).rejects.toThrow('explicit byte reader');
  await expect(raster.glb(bytes, undefined, () => false)).rejects.toThrow('missing map geometry part');
});

test('retained file identities use only the explicit reader and cache stays per raster', async () => {
  const first = await floor(4), second = await floor(8); let reads = 0;
  const reader = (file: string): Uint8Array => {
    expect(file).toBe('floor.glb'); reads++; return reads === 1 ? first : second;
  };
  const raster = new MapRaster(100, {}, reader), other = new MapRaster(100, {}, reader);
  await raster.glb('floor.glb'); await raster.glb('floor.glb');
  expect(reads).toBe(1); expect(raster.triangles).toBe(2);
  expect(raster.height[12 * 100 + 12]).toBe(4 * 65536);
  await other.glb('floor.glb'); expect(reads).toBe(2);
  expect(other.height[12 * 100 + 12]).toBe(8 * 65536);
  const refused = new MapRaster(100, {}, () => { throw new Error('Unadmitted input'); });
  await expect(refused.glb('ungranted.glb')).rejects.toThrow('Unadmitted input');
});

test('the canonical raster bundles without filesystem, module or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/sdk/bake/mapRaster.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing raster author bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
});
