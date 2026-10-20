import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { Mesh, SkinnedMesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packedCreatureBodies } from '../../../../src/game/plugin/geometry';
const root = 'art/driftwood-isle/approved-brine-pitcher/grown-fan-anatomy/';
const read = (name: string): unknown => JSON.parse(readFileSync(root + name, 'utf8'));
const numbers = v.array(v.number());
const source = v.parse(v.object({ bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: numbers })), parts: v.array(v.object({ name: v.string(), positions: numbers, colorsLinear: numbers, skinIndices: numbers, skinWeights: numbers, furLen: numbers })) }), read('native-source.json'));
async function load() {
  const loader = packedCreatureBodies(read('metadata.json'), undefined, () => Promise.resolve(new Uint8Array(readFileSync(root + 'payload.bin'))));
  await loader.preload();
  return loader.copy('brine-pitcher-matriarch', 'brine-pitcher-matriarch');
}
test('actual packed native consumer preserves every position/color/skin attribute and bind', async () => {
  const body = await load();
  expect(body.bones).toEqual(source.bones);
  expect(body.hardParts).toHaveLength(7);
  const attrs = [['position', 'positions'], ['color', 'colorsLinear'], ['skinIndex', 'skinIndices'], ['skinWeight', 'skinWeights'], ['furLen', 'furLen']] as const;
  body.hardParts.forEach((geometry, i) => {
    const part = source.parts[i];
    if (part === undefined) throw new Error('Missing part');
    for (const [attribute, key] of attrs) {
      const expected = key === 'skinIndices' ? new Uint16Array(part[key]) : new Float32Array(part[key]);
      expect(geometry.getAttribute(attribute).array).toEqual(expected);
    }
    geometry.dispose();
  });
});
test('independent GLTFLoader consumes all triangles, valid rigid skin and outward flat normals', async () => {
  const bytes = readFileSync(root + 'brine-pitcher-v1.glb');
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  gltf.scene.updateMatrixWorld(true);
  let triangles = 0;
  gltf.scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    expect(object instanceof SkinnedMesh).toBe(true);
    const geometry = object.geometry, positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), weights = geometry.getAttribute('skinWeight'), index = geometry.getIndex();
    if (index === null) throw new Error('Expected indexed GLB');
    triangles += index.count / 3;
    for (let i = 0; i < index.count; i += 3) {
      const ia = index.getX(i), ib = index.getX(i + 1), ic = index.getX(i + 2);
      const a = new Vector3().fromBufferAttribute(positions, ia), b = new Vector3().fromBufferAttribute(positions, ib), c = new Vector3().fromBufferAttribute(positions, ic);
      const normal = b.sub(a).cross(c.sub(a)).normalize();
      for (const vertex of [ia, ib, ic]) {
        expect(normal.dot(new Vector3().fromBufferAttribute(normals, vertex))).toBeGreaterThan(.999);
        expect(weights.getX(vertex)).toBe(1);
        expect(weights.getY(vertex) + weights.getZ(vertex) + weights.getW(vertex)).toBe(0);
      }
    }
    geometry.dispose();
  });
  expect(triangles).toBe(4698);
});
test('native consumer copies own separate finite geometry', async () => {
  const a = await load(), b = await load();
  a.hardParts.forEach((geometry, i) => {
    const other = b.hardParts[i];
    if (other === undefined) throw new Error('Missing part');
    expect(geometry).not.toBe(other);
    expect(geometry.getAttribute('position').array).not.toBe(other.getAttribute('position').array);
    expect(Array.from(geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
    geometry.dispose(); other.dispose();
  });
});
