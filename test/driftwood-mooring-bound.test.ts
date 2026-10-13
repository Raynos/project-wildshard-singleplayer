// oxlint-disable-next-line import/no-nodejs-modules -- Compare all geometry bytes through the native buffer primitive.
import { Buffer } from 'node:buffer';
// oxlint-disable-next-line import/no-nodejs-modules -- Read the shipped rope algorithm for the original-loop byte oracle.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Execute the original finite fixture loops without a game/browser.
import { runInNewContext } from 'node:vm';
import ts from '@typescript/typescript6';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { expect, it } from 'vitest';
import { MooringLines } from '../src/shards/driftwood-isle/runtime/props/mooringLines';
import { BOAT_MOORING } from '../src/shards/driftwood-isle/runtime/looks/boatLook';
import { runtimePerformanceSites } from '../lint/runtime-performance.mjs';

it('preserves every shipped rope geometry byte and lifted pose with explicit finite bounds', () => {
  const source = readFileSync('src/shards/driftwood-isle/runtime/props/mooringLines.ts', 'utf8');
  expect(runtimePerformanceSites(source).filter(site => site.kind === 'unbounded-loop')).toEqual([]);
  // Restore only the four former loop conditions and omit their new refusal checks.
  const former = source.replaceAll(/^import .*;$/gmu, '').replaceAll('export ', '')
    .replace('Math.min(n, LINE_VERTICES)', 'n').replace('Math.min(rp.count, TOTAL_VERTICES)', 'rp.count')
    .replace('Math.min(this.cleatDy.length, CLEATS)', 'this.cleatDy.length')
    .replace('Math.min(this.weight.length, TOTAL_VERTICES)', 'this.weight.length')
    .replaceAll(/^\s*if \([^\n]*\) throw new Error\('Mooring [^\n]*\);$/gmu, '');
  const record: { make?: (...args: ConstructorParameters<typeof MooringLines>) => MooringLines } = {};
  const js = ts.transpileModule(`${former}\nrecord.make=(...args)=>new MooringLines(...args);`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(js, { THREE, mergeGeometries, record, Float32Array, Uint8Array }, { timeout: 1000 });
  if (record.make === undefined) throw new Error('Original rope constructor missing');
  const material = new THREE.MeshStandardMaterial();
  const args: ConstructorParameters<typeof MooringLines> = [BOAT_MOORING,
    [new THREE.Vector3(-4, 1, -3), new THREE.Vector3(-4, 1, 3)], [{ x: 0, z: -4 }, { x: 0, z: 4 }], 0.8, [-3, 3], material];
  const actual = new MooringLines(...args), original = record.make(...args);
  const compare = (): void => {
    expect(Object.keys(actual.mesh.geometry.attributes)).toEqual(Object.keys(original.mesh.geometry.attributes));
    for (const key of Object.keys(actual.mesh.geometry.attributes)) {
      const a = actual.mesh.geometry.getAttribute(key), b = original.mesh.geometry.getAttribute(key);
      expect(a.count).toBe(b.count); expect(a.itemSize).toBe(b.itemSize);
      expect(Buffer.compare(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength), Buffer.from(b.array.buffer, b.array.byteOffset, b.array.byteLength))).toBe(0);
    }
    expect(actual.mesh.matrix.elements).toEqual(original.mesh.matrix.elements);
    expect(actual.mesh.material).toBe(original.mesh.material);
    expect(actual.mesh.castShadow).toBe(original.mesh.castShadow);
  };
  try {
    compare();
    for (const [heave, pitch] of [[0, 0], [0.23, 0.1], [-0.2, -0.03]] as const) {
      actual.lift(heave, pitch); original.lift(heave, pitch); compare();
    }
    expect(() => new MooringLines({ ...BOAT_MOORING, segments: 9 }, args[1], args[2], args[3], args[4], args[5])).toThrow();
  } finally { actual.mesh.geometry.dispose(); original.mesh.geometry.dispose(); material.dispose(); }
});
