import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { seamLookGeometrySteps, type SeamPiece } from '../src/game/grid/seamLook';

/** a strip of a jittered height grid: shared vertices, so normals accumulate across faces */
function strip(seed: number, ox: number, oz: number): SeamPiece {
  const side = 24, positions = new Float32Array(side * side * 3), colours = new Float32Array(side * side * 3).fill(0.25), indices: number[] = [];
  let s = seed;
  const rand = (): number => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let j = 0; j < side; j++) for (let i = 0; i < side; i++) {
    const k = (j * side + i) * 3;
    positions[k] = i * 1.7 + rand() * 0.3; positions[k + 1] = rand() * 2.5; positions[k + 2] = j * 1.3 + rand() * 0.3;
  }
  for (let j = 0; j < side - 1; j++) for (let i = 0; i < side - 1; i++) {
    const a = j * side + i, b = a + 1, c = a + side, d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const index = new Uint32Array(indices), third = Math.floor(index.length / 9) * 3;
  return { mesh: { origin: { x: ox, z: oz }, positions, colours, indices: index },
    features: [{ kind: 'deck', firstIndex: 0, indexCount: third }, { kind: 'cliff', firstIndex: third, indexCount: third }, { kind: 'road-wall', firstIndex: 2 * third, indexCount: third }] };
}

test('the seam merge in steps yields between strips and keeps three\'s own normal and bounding-sphere bytes', () => {
  const pieces = [strip(1, 0, 0), strip(2, 40, -12), strip(3, -25, 31)], home = { origin: { x: 5, z: -3 } };
  const steps = seamLookGeometrySteps(pieces, home, undefined, 562.5);
  let yields = 0, result: ReturnType<typeof steps.next>;
  for (result = steps.next(); result.done !== true; result = steps.next()) yields++;
  const { geometry, state } = result.value;
  expect(yields).toBeGreaterThanOrEqual(pieces.length);
  expect(state.triangles).toBe(pieces.reduce((n, p) => n + p.mesh.indices.length / 3, 0));
  // three's whole calls on the same merged positions and index
  const index = geometry.getIndex();
  if (index === null) throw new Error('Missing merged index');
  const reference = new BufferGeometry().setAttribute('position', geometry.getAttribute('position').clone()).setIndex(index.clone());
  reference.computeVertexNormals(); reference.computeBoundingSphere();
  expect(Buffer.from(new Float32Array(geometry.getAttribute('normal').array).buffer)).toEqual(Buffer.from(new Float32Array(reference.getAttribute('normal').array).buffer));
  expect(geometry.boundingSphere?.center.toArray()).toEqual(reference.boundingSphere?.center.toArray());
  expect(geometry.boundingSphere?.radius).toBe(reference.boundingSphere?.radius);
  expect(geometry.getAttribute('normal')).toBeInstanceOf(BufferAttribute);
});

test('palette lookup preserves negative-zero bins, neighbour order and explicit surfaces', () => {
  const positions = Float32Array.of(-2, 0, 0, 0, 0, 0, 2, 0, 0, 1, 3, 0, 0, 4, 1, -1, 2, 0);
  const colours = Float32Array.of(0.1, 0.1, 0.8, 0.8, 0.1, 0.1, 0.1, 0.8, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const grey = [0.32, 0.3, 0.28], expectedGround = [2, 1, 1];
  for (const resolved of [false, true]) {
    const piece: SeamPiece = { mesh: { origin: { x: 0, z: 0 }, positions, colours, indices: Uint32Array.of(0, 1, 2, 3, 4, 5) },
      features: [{ kind: 'deck', firstIndex: 0, indexCount: 3 }, { kind: 'cliff', firstIndex: 3, indexCount: 3, sourceSurface: 'soil' }] };
    const surface = [0.4, 0.2, 0.6] as const;
    const steps = seamLookGeometrySteps([piece], { origin: { x: 0, z: 0 } }, resolved ? () => surface : undefined);
    let result = steps.next(); while (!result.done) result = steps.next();
    const geometry = result.value.geometry, actual = geometry.getAttribute('color');
    try {
      for (let k = 0; k < expectedGround.length; k++) for (let c = 0; c < 3; c++) {
        const g = expectedGround[k] ?? 0, own = resolved ? surface[c] ?? 0 : colours[g * 3 + c] ?? 0;
        expect(actual.array[(k + 3) * 3 + c]).toBe(Math.fround((own * 0.6 + (grey[c] ?? 0) * 0.4) * 0.9));
      }
    } finally { geometry.dispose(); }
  }
});
