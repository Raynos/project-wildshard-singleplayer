import { describe, expect, it, vi } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { Rng } from '@wildshard/engine/core/rng';
import { seedOf } from '@wildshard/engine/models/model';
import { leafClump } from '../src/shards/driftwood-isle/generators/hibiscus';
import { hibiscusBush } from '../src/shards/driftwood-isle/runtime/models/hibiscusBush';
import { HIBISCUS_FILES } from '../src/shards/driftwood-isle/data/hibiscusFiles';
import { loadHibiscusVariants, copyHibiscusVariant, decodeHibiscusWorld } from '../src/shards/driftwood-isle/runtime/boot/hibiscusGeometry';

const phone = (): Uint8Array => {
  const buffer = new ArrayBuffer(16 + (6 + 3 * 11) * 4), header = new DataView(buffer);
  header.setUint32(0, 0x31424948, true); header.setUint32(4, 1, true); header.setUint32(8, 3, true); header.setUint32(12, 1, true);
  new Float32Array(buffer, 16).set([-1, 0, -1, 1, 2, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]);
  return new Uint8Array(buffer);
};
describe('the owned hibiscus world bake', () => {
  it('draws the compacted native shape with independent disposable channels and original copy boxes', () => {
    const bytes = phone(), count = new DataView(bytes.buffer).getUint32(12, true);
    const { geometry, boxes } = decodeHibiscusWorld(bytes, count);
    expect(boxes.length).toBe(count * 6);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count);
    const position = geometry.getAttribute('position').array, colour = geometry.getAttribute('color').array;
    expect(position.buffer).not.toBe(bytes.buffer);
    expect(colour.buffer).not.toBe(position.buffer);
    expect(boxes.buffer).not.toBe(position.buffer);
    geometry.dispose();
  });
  it('refuses another scatter, truncated data and nonfinite channels before returning geometry', () => {
    const bytes = phone(), count = new DataView(bytes.buffer).getUint32(12, true);
    expect(() => decodeHibiscusWorld(bytes, count + 1)).toThrow('topology');
    expect(() => decodeHibiscusWorld(bytes.subarray(0, -4), count)).toThrow('topology');
    new DataView(bytes.buffer).setFloat32(16 + count * 24, Number.NaN, true);
    expect(() => decodeHibiscusWorld(bytes, count)).toThrow('Nonfinite');
  });
});

it('loads the three Explorer bakes through the native intake with their wind channels', async () => {
  const files = HIBISCUS_FILES[TIER === 'phone' ? 'phone' : 'desktop'], emitted = new Map<string, Uint8Array>();
  for (const variant of hibiscusBush.variants ?? []) {
    if (variant.id !== 'flowering' && variant.id !== 'leaf' && variant.id !== 'small') throw new Error('Unexpected specimen');
    const geometry = leafClump({ ...hibiscusBush.defaults, ...variant.params }, new Rng(seedOf(hibiscusBush)));
    emitted.set(files[variant.id], staticGlb([{ geometry, material: new MeshStandardMaterial(), customAttributes: { _SWAY: 'aSway' }, compactIndex: true }])); geometry.dispose();
  }
  const mocked = vi.spyOn(globalThis, 'fetch').mockImplementation(input => {
    const bytes = typeof input === 'string' ? emitted.get(input) : undefined;
    if (bytes === undefined) throw new Error('Unknown specimen request');
    return Promise.resolve(new Response(Uint8Array.from(bytes).buffer));
  });
  try {
    await loadHibiscusVariants();
    for (const variant of hibiscusBush.variants ?? []) {
      const geometry = copyHibiscusVariant({ ...hibiscusBush.defaults, ...variant.params });
      expect(geometry.getAttribute('aSway').count).toBe(geometry.getAttribute('position').count);
      expect(geometry.getAttribute('position').count).toBeGreaterThan(0); geometry.dispose();
    }
    expect(() => copyHibiscusVariant({ r: 8, flowers: true, phase: 0 })).toThrow('no authored bake');
  } finally { mocked.mockRestore(); }
});
