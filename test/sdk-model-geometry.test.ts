import { describe, expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { modelGeometry } from '../src/sdk/modelGeometry';
import { staticGlb } from '../src/sdk/bake/glb';

function fixture(): { geometry: BufferGeometry; material: MeshStandardMaterial } {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  geometry.setAttribute('color', new Float32BufferAttribute([0.5, 0.25, 0.125, 0.3, 0.6, 0.9, 0.75, 0.5, 0.25], 3));
  geometry.setAttribute('aSway', new Float32BufferAttribute([0, 1, 0.25, 2, 0.5, 3], 2));
  return { geometry, material: new MeshStandardMaterial({ vertexColors: true }) };
}
const bake = (source: ReturnType<typeof fixture>): Uint8Array => staticGlb([{ ...source, customAttributes: { _SWAY: 'aSway' } }]);
describe('SDK baked model geometry', () => {
  it('loads once, preserves exact geometry channels and hands independent copies to runtime owners', async () => {
    const source = fixture(), asset = modelGeometry('fixed.glb', { _sway: 'aSway' }), bytes = bake(source);
    expect(() => asset.copy()).toThrow('not loaded');
    const first = asset.load(bytes); expect(asset.load(bytes)).toBe(first); await first;
    const copy = asset.copy();
    expect(copy.index).toBeNull();
    expect(Object.keys(copy.attributes).sort()).toEqual(Object.keys(source.geometry.attributes).sort());
    for (const name of Object.keys(copy.attributes)) expect(copy.getAttribute(name).array).toEqual(source.geometry.getAttribute(name).array);
    copy.scale(2, 3, 4); copy.dispose();
    expect(asset.copy().getAttribute('position').array).toEqual(source.geometry.getAttribute('position').array);
    source.geometry.dispose(); source.material.dispose();
  });
  it('refuses an ambiguous multi-mesh bake and allows a corrected explicit load to retry', async () => {
    const source = fixture(), asset = modelGeometry('fixed.glb');
    await expect(asset.load(staticGlb([source, source]))).rejects.toThrow('one mesh');
    expect(() => asset.copy()).toThrow('not loaded');
    await asset.load(bake(source));
    expect(asset.copy().getAttribute('position').count).toBe(3);
    source.geometry.dispose(); source.material.dispose();
  });
});
