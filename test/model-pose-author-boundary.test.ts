// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the actual defining author-safe module.
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { modelPoseMatrix } from '../src/engine/models/modelPose';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

test('model pose owns independent matrices and the original YXZ placement convention', () => {
  const pose = { x: 4, y: -2, z: 8, yaw: Math.PI / 2, scale: 3 };
  const first = modelPoseMatrix(pose), second = modelPoseMatrix(pose);
  expect(second.elements).toEqual(first.elements);
  expect(second).not.toBe(first);
  expect(second.elements).not.toBe(first.elements);
  expect(first.elements.slice(12, 15)).toEqual([4, -2, 8]);
  expect(first.elements[2]).toBeCloseTo(-3, 14);
  expect(first.elements[8]).toBeCloseTo(3, 14);
  expect(first.elements[5]).toBe(3);
  first.identity();
  expect(second.elements[12]).toBe(4);
  expect(pose).toEqual({ x: 4, y: -2, z: 8, yaw: Math.PI / 2, scale: 3 });
});

for (const entry of ['src/engine/models/modelPose.ts', 'src/shards/nalati-grasslands/generators/decorative.ts']) test(`${entry} bundles without runtime placement or service modules`, async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve(entry), formats: ['es'] },
    rolldownOptions: { output: { codeSplitting: false } } } });
  const built = Array.isArray(result) ? result[0] : result;
  if (built === undefined || !('output' in built)) throw new Error('Missing model pose author bundle');
  const chunks = built.output.filter(row => row.type === 'chunk');
  expect(chunks).toHaveLength(1);
  for (const chunk of chunks) {
    expect(() => assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports])).not.toThrow();
    expect(Object.keys(chunk.modules).some(file => /(?:placementBatch|models\/place\.|world\/registry)/u.test(file))).toBe(false);
  }
});
