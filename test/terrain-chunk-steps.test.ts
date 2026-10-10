import * as THREE from 'three';
import { expect, it } from 'vitest';
import { CHUNK_SIZE, TERRAIN_RES } from '../src/engine/core/config';
import { terrainChunkGeometry, terrainChunkSteps, vertexNormalSteps } from '../src/engine/world/Terrain';

// SF63: the chunk's ground is built in steps (a grid cell builds it in play); the bytes must be the old one-call build's.
const field = {
  heightAt: (x: number, z: number): number => 4 * Math.sin(x * 0.031) * Math.cos(z * 0.027) + 0.6 * Math.sin(x * 0.29 + z * 0.17),
  splatAt: (x: number, z: number): [number, number, number, number] => { const a = 0.5 + 0.5 * Math.sin(x * 0.05), b = 0.5 + 0.5 * Math.cos(z * 0.04); const s = a + b + 1; return [a / s, b / s, 0.5 / s, 0.5 / s]; },
};
/** the build as it was before the steps: three's computeVertexNormals in one call */
function reference(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, TERRAIN_RES - 1, TERRAIN_RES - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position'), splat = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, field.heightAt(x, z)); splat.set(field.splatAt(x, z), i * 4); }
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 4));
  geo.computeVertexNormals(); geo.computeBoundingSphere();
  return geo;
}
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const bytes = (geo: THREE.BufferGeometry, name: string): Uint8Array => {
  const a = geo.getAttribute(name);
  if (!(a instanceof THREE.BufferAttribute) || !(a.array instanceof Float32Array)) throw new Error(`no float attribute ${name}`);
  return new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength);
};

it('builds the same position, normal and splat bytes as the one-call build, yielding between short steps', () => {
  const want = reference(), got = terrainChunkGeometry(field);
  for (const name of ['position', 'normal', 'splat']) expect(same(bytes(got, name), bytes(want, name)), name).toBe(true);
  expect(got.boundingSphere?.radius).toBe(want.boundingSphere?.radius);
  let yields = 0;
  const steps = terrainChunkSteps(field);
  while (steps.next().done !== true) yields++;
  expect(yields).toBeGreaterThan(20);
});

it('steps three\'s computeVertexNormals for any indexed geometry with normals', () => {
  const a = new THREE.TorusKnotGeometry(1, 0.3, 200, 32), b = a.clone();
  const p = a.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 1.3 + Math.sin(i) * 0.01);
  b.setAttribute('position', p.clone());
  a.computeVertexNormals();
  const steps = vertexNormalSteps(b);
  while (steps.next().done !== true) { /* drain */ }
  expect(same(bytes(b, 'normal'), bytes(a, 'normal'))).toBe(true);
});
