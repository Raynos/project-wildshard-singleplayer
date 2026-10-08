import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { staticGlb } from '../src/sdk/bake/glb';
import { parseGlb } from '../src/sdk/assets';

function geometry(): BufferGeometry {
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3))
    .setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
    .setAttribute('splat', new Float32BufferAttribute([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0], 4))
    .setAttribute('surf', new Float32BufferAttribute([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 4))
    .setAttribute('rdir', new Float32BufferAttribute([0.25, 0.5, 0.75, 1, -1, 0], 2))
    .setAttribute('zone', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3))
    .setAttribute('canopy', new Float32BufferAttribute([0, 0.5, 1], 1)).setIndex([0, 2, 1]);
}
describe('native terrain GLB application channels', () => {
  it('round-trips Pine/Nalati channels through the actual loader and charges their emitted bytes', async () => {
    const g = geometry(), material = new MeshStandardMaterial(); material.name = 'pine.native-ground';
    const customAttributes = { _SPLAT: 'splat', _SURF: 'surf', _RDIR: 'rdir', _ZONE: 'zone', _CANOPY: 'canopy' };
    const bytes = staticGlb([{ geometry: g, material, customAttributes }]);
    const parsed = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
    let meshes = 0;
    parsed.scene.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const loadedGeometry: unknown = object.geometry;
      if (!(loadedGeometry instanceof BufferGeometry)) throw new Error('Expected actual loaded BufferGeometry');
      meshes++;
      for (const [semantic, name] of Object.entries(customAttributes)) {
        const original = g.getAttribute(name), loaded = loadedGeometry.getAttribute(semantic.toLowerCase());
        expect(loaded.itemSize).toBe(original.itemSize);
        expect(Array.from(loaded.array)).toEqual(Array.from(original.array));
      }
    });
    expect(meshes).toBe(1);
    const cost = parseGlb(bytes), plain = parseGlb(staticGlb([{ geometry: g, material }]));
    expect(cost.decoded).toBeGreaterThan(plain.decoded); expect(cost.gpu).toBeGreaterThan(plain.gpu);
  });
  it('keeps the old byte path when no custom channels are requested and is deterministic', () => {
    const g = geometry(), material = new MeshStandardMaterial();
    expect(staticGlb([{ geometry: g, material }])).toEqual(staticGlb([{ geometry: g, material, customAttributes: {} }]));
    const customAttributes = { _ZONE: 'zone', _SURF: 'surf' };
    expect(staticGlb([{ geometry: g, material, customAttributes }])).toEqual(staticGlb([{ geometry: g, material, customAttributes: { _SURF: 'surf', _ZONE: 'zone' } }]));
  });
  it('refuses missing, non-application and malformed attributes instead of silently dropping them', () => {
    const g = geometry(), material = new MeshStandardMaterial();
    expect(() => staticGlb([{ geometry: g, material, customAttributes: { _SURF: 'missing' } }])).toThrow('custom attribute _SURF');
    expect(() => staticGlb([{ geometry: g, material, customAttributes: { NORMAL: 'normal' } }])).toThrow('custom attribute NORMAL');
    g.setAttribute('zone', new Float32BufferAttribute([1, 2, 3], 3));
    expect(() => staticGlb([{ geometry: g, material, customAttributes: { _ZONE: 'zone' } }])).toThrow('Mismatched');
  });
});
