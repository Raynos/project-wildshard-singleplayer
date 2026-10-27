import { expect, it } from 'vitest';
import { BufferAttribute, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { createOwnedGeometry } from '@wildshard/engine/models/ownedGeometry';
import { staticGlb } from './glb';
import { brotliBytes, compactPhoneGlb } from './compactGlb';

/** A phone-tier model big enough for the grid to pay: a 20 m sphere off the origin with per-vertex colours (`native`:
 *  written with its exact channel storage declared, as the foliage batches are). */
function sphereGlb(native = false): Uint8Array {
  const geometry = new SphereGeometry(10, 96, 64).translate(30, 4, -12), colours = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colours.length; i++) colours[i] = (i % 7) / 7;
  geometry.setAttribute('color', new BufferAttribute(colours, 3));
  return staticGlb([{ geometry, material: new MeshStandardMaterial(), ...(native ? { nativeAttributes: true } : {}) }]);
}

it('quantizes and meshopt-compresses a phone model only when its brotli bytes shrink', async () => {
  const input = sphereGlb(), packed = await compactPhoneGlb(input);
  expect(brotliBytes(packed)).toBeLessThan(brotliBytes(input) * 0.75);
  const json = JSON.parse(new TextDecoder().decode(packed.subarray(20, 20 + new DataView(packed.buffer, packed.byteOffset).getUint32(12, true)))) as { extensionsUsed?: string[] };
  expect(json.extensionsUsed).toEqual(expect.arrayContaining(['KHR_mesh_quantization', 'EXT_meshopt_compression']));
  // a compacted file is left alone the second time, and a two-mesh file is never touched
  expect(await compactPhoneGlb(packed)).toBe(packed);
  const pair = staticGlb([{ geometry: new SphereGeometry(1), material: new MeshStandardMaterial() }, { geometry: new SphereGeometry(2), material: new MeshStandardMaterial() }]);
  expect(await compactPhoneGlb(pair)).toBe(pair);
});

it.each([false, true])('the owned-geometry intake reads a compacted model back in its own space (native=%s)', async native => {
  const input = sphereGlb(native), original = createOwnedGeometry('/original.glb'), compact = createOwnedGeometry('/compact.glb');
  await original.load(input); await compact.load(await compactPhoneGlb(input));
  const a = original.take(), b = compact.take();
  try {
    const pa = a.getAttribute('position'), pb = b.getAttribute('position'), index = a.getIndex(), other = b.getIndex();
    expect(pb.array).toBeInstanceOf(Float32Array);
    expect(pb.count).toBe(pa.count);
    // the meshopt writer keeps the vertex order; one grid step of a 20 m sphere is ~0.5 mm
    let worst = 0;
    for (let i = 0; i < pa.count; i++) for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(pa.getComponent(i, c) - pb.getComponent(i, c)));
    expect(worst).toBeLessThan(1e-3);
    expect(Array.from(other?.array ?? [])).toEqual(Array.from(index?.array ?? []));
    const na = a.getAttribute('normal'), nb = b.getAttribute('normal');
    let normal = 0;
    for (let i = 0; i < na.count; i++) for (let c = 0; c < 3; c++) normal = Math.max(normal, Math.abs(na.getComponent(i, c) - nb.getComponent(i, c)));
    expect(normal).toBeLessThan(0.02);
    const mesh = new Mesh(b);
    b.computeBoundingBox();
    expect(b.boundingBox?.min.x).toBeCloseTo(20, 2);
    expect(mesh.matrixWorld.equals(mesh.matrix)).toBe(true);
  } finally { a.dispose(); b.dispose(); }
});
