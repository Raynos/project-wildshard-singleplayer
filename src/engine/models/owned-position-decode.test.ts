import { expect, test, vi } from 'vitest';
import { BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { identitySpaceGeometry } from './ownedGeometry';

/** The original two-pass result: the Float32 store between normalization and
 * matrix multiplication is part of the shipped decoder's numerical contract. */
function original(mesh: Mesh): BufferGeometry {
  const geometry = mesh.geometry.clone(), position = geometry.getAttribute('position');
  const values = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) { values[i * 3] = position.getX(i); values[i * 3 + 1] = position.getY(i); values[i * 3 + 2] = position.getZ(i); }
  geometry.setAttribute('position', new BufferAttribute(values, 3)); geometry.applyMatrix4(mesh.matrixWorld);
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    if (name === 'position' || (attribute instanceof BufferAttribute && attribute.array instanceof Float32Array && !attribute.normalized)) continue;
    const out = new Float32Array(attribute.count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) for (let c = 0; c < attribute.itemSize; c++) out[i * attribute.itemSize + c] = attribute.getComponent(i, c);
    geometry.setAttribute(name, new BufferAttribute(out, attribute.itemSize));
  }
  return geometry;
}

test.each([1, 0.00037, 3.141592653589793].flatMap(scale => [false, true].map(interleaved => ({ scale, interleaved }))))(
  'fused grid decode retains every original channel and bound ($scale, interleaved $interleaved)', ({ scale, interleaved }) => {
    const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
    const values = new Int16Array([-32768, -32767, -16384, -1, 0, 1, 16383, 16384, 32766, 32767, 12345, -23456]);
    if (interleaved) {
      const padded = new Int16Array(16);
      for (let i = 0; i < 4; i++) { padded.set(values.subarray(i * 3, i * 3 + 3), i * 4); padded[i * 4 + 3] = 1234; }
      geometry.setAttribute('position', new InterleavedBufferAttribute(new InterleavedBuffer(padded, 4), 3, 0, true));
    } else geometry.setAttribute('position', new BufferAttribute(values, 3, true));
    geometry.setAttribute('normal', new BufferAttribute(new Int8Array([127, 3, 0, 0, -127, 4, 3, 4, 126, -50, 60, 100]), 3, true));
    geometry.setAttribute('tangent', new BufferAttribute(new Int16Array([32767, 0, 0, -32767, 0, 32767, 1, 32767, 1, 0, 32767, -32767, 20000, 21000, 22000, 32767]), 4, true));
    geometry.setAttribute('colour', new BufferAttribute(new Uint8Array([1, 2, 3, 255, 128, 127, 0, 254]), 2, true));
    geometry.setIndex([0, 1, 2, 1, 3, 2]); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mesh = new Mesh(geometry, material); mesh.scale.setScalar(scale); mesh.position.set(123.456789, -0.000037, -76.54321); mesh.updateMatrixWorld(true);
    const expected = original(mesh), actual = identitySpaceGeometry(mesh);
    try {
      expect(actual).not.toBeNull(); if (actual === null) throw new Error('Missing quantized result');
      expect(actual.index?.array).toEqual(expected.index?.array);
      expect(Object.keys(actual.attributes)).toEqual(Object.keys(expected.attributes));
      for (const name of Object.keys(expected.attributes)) {
        const a = actual.getAttribute(name), b = expected.getAttribute(name);
        expect(a.itemSize).toBe(b.itemSize); expect(a.normalized).toBe(b.normalized);
        if (!(a instanceof BufferAttribute) || !(b instanceof BufferAttribute)) throw new Error('Decoded channels must be plain');
        expect(a.version).toBe(b.version);
        expect(new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength)).toEqual(new Uint8Array(b.array.buffer, b.array.byteOffset, b.array.byteLength));
      }
      expect(actual.boundingBox).toEqual(expected.boundingBox); expect(actual.boundingSphere).toEqual(expected.boundingSphere);
      expect(geometry.getAttribute('position').normalized).toBe(true); expect(values[0]).toBe(-32768);
    } finally { actual?.dispose(); expected.dispose(); geometry.dispose(); material.dispose(); }
  });

test('ordinary float geometry keeps the original non-grid refusal', () => {
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3));
  try { expect(identitySpaceGeometry(new Mesh(geometry, material))).toBeNull(); }
  finally { geometry.dispose(); material.dispose(); }
});

function boundedMesh(): Mesh {
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(new Int16Array([
    -32768, 0, 32767, 1000, -2000, 3000, 32767, -32768, 0,
  ]), 3, true));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.scale.setScalar(0.00037); mesh.position.set(1.23456789, -0.12345678, 98.7654321); mesh.updateMatrixWorld(true);
  return mesh;
}
function closeMesh(mesh: Mesh): void {
  mesh.geometry.dispose();
  for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
}

test.each([[false, false], [false, true], [true, false], [true, true]])('retains original optional bounds (box %s, sphere %s)', (box, sphere) => {
  const mesh = boundedMesh();
  if (box) mesh.geometry.computeBoundingBox();
  if (sphere) mesh.geometry.computeBoundingSphere();
  const expected = original(mesh), actual = identitySpaceGeometry(mesh);
  try {
    if (actual === null) throw new Error('Missing quantized result');
    expect(actual.boundingBox).toEqual(expected.boundingBox); expect(actual.boundingSphere).toEqual(expected.boundingSphere);
    expect(actual.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
  } finally { expected.dispose(); actual?.dispose(); closeMesh(mesh); }
});

test.each([false, true])('morph positions keep the original bounds pass (relative %s)', relative => {
  const mesh = boundedMesh();
  mesh.geometry.morphAttributes.position = [new BufferAttribute(new Float32Array([2, -3, 4, -5, 6, -7, 8, -9, 10]), 3)];
  mesh.geometry.morphTargetsRelative = relative;
  mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
  const expected = original(mesh), actual = identitySpaceGeometry(mesh);
  try {
    if (actual === null) throw new Error('Missing quantized result');
    expect(actual.boundingBox).toEqual(expected.boundingBox); expect(actual.boundingSphere).toEqual(expected.boundingSphere);
    expect(actual.morphAttributes).toEqual(expected.morphAttributes);
  } finally { expected.dispose(); actual?.dispose(); closeMesh(mesh); }
});

test('custom position accessors retain their normalized read and bounds semantics', () => {
  const mesh = boundedMesh(), getX: unknown = Reflect.get(BufferAttribute.prototype, 'getX');
  if (typeof getX !== 'function') throw new Error('Missing original position getter');
  mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
  const read = vi.spyOn(BufferAttribute.prototype, 'getX').mockImplementation(function readPosition(this: BufferAttribute, index: number) {
    const value: unknown = Reflect.apply(getX, this, [index]);
    if (typeof value !== 'number') throw new Error('Position getter must return a number');
    return value + 0.00001;
  });
  let expected: BufferGeometry | undefined, actual: BufferGeometry | null = null;
  try {
    expected = original(mesh); actual = identitySpaceGeometry(mesh);
    if (actual === null) throw new Error('Missing quantized result');
    expect(actual.getAttribute('position').array).toEqual(expected.getAttribute('position').array);
    expect(actual.boundingBox).toEqual(expected.boundingBox); expect(actual.boundingSphere).toEqual(expected.boundingSphere);
  } finally { read.mockRestore(); expected?.dispose(); actual?.dispose(); closeMesh(mesh); }
});
