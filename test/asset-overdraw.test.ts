import { expect, it } from 'vitest';
import { assetOverdraw, parseGlb } from '../src/sdk/assets';
import { projectedLayerCoverage } from '../src/game/shardfile/overdraw';

function fixture(layers: number, alpha = 'BLEND', nodes = 1, scale = 1): Uint8Array {
  const positions = [0, 0, 0, scale, 0, 0, scale, scale, 0, 0, 0, 0, scale, scale, 0, 0, scale, 0];
  const json = new TextEncoder().encode(JSON.stringify({ asset: { version: '2.0' }, buffers: [{ byteLength: positions.length * 4 }],
    bufferViews: [{ buffer: 0, byteLength: positions.length * 4 }], accessors: [{ bufferView: 0, componentType: 5126, count: 6, type: 'VEC3' }],
    materials: [{ alphaMode: alpha }], meshes: [{ primitives: Array.from({ length: layers }, () => ({ attributes: { POSITION: 0 }, material: 0 })) }],
    nodes: Array.from({ length: nodes }, () => ({ mesh: 0 })) }));
  const length = Math.ceil(json.length / 4) * 4, bytes = new Uint8Array(28 + length + positions.length * 4), view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true); bytes.fill(32, 20, 20 + length); bytes.set(json, 20);
  view.setUint32(20 + length, positions.length * 4, true); view.setUint32(24 + length, 0x004e4942, true);
  positions.forEach((value, index) => view.setFloat32(28 + length + index * 4, value, true)); return bytes;
}
it('detects alpha-blended stacking that triangle and draw counts alone do not describe', () => {
  expect(assetOverdraw('glb', fixture(1))).toEqual({ layers: 1, blendedLayers: 1, maskedLayers: 0, basis: 'primitive-bounds' });
  expect(assetOverdraw('glb', fixture(12))).toEqual({ layers: 12, blendedLayers: 12, maskedLayers: 0, basis: 'primitive-bounds' });
  expect(parseGlb(fixture(12)).triangles).toBe(24);
});
it('scales with node copies, stays invariant under uniform scale, and separates opaque/masked surfaces', () => {
  expect(assetOverdraw('glb', fixture(2, 'BLEND', 3, 100)).blendedLayers).toBe(6);
  expect(assetOverdraw('glb', fixture(2, 'OPAQUE')).blendedLayers).toBe(0);
  expect(assetOverdraw('glb', fixture(2, 'MASK')).maskedLayers).toBe(2);
  expect(assetOverdraw('glb', fixture(1, 'BLEND', 0)).layers).toBe(1);
});
it('rejects nonfinite geometry, malformed alpha modes and bytes before producing a raster estimate', () => {
  expect(() => assetOverdraw('glb', fixture(1, 'SCRIPT'))).toThrow('alpha mode');
  expect(() => assetOverdraw('glb', fixture(1, 'BLEND', 1, Number.NaN))).toThrow('nonfinite GLB position');
  expect(() => assetOverdraw('glb', new Uint8Array(4))).toThrow();
  expect(projectedLayerCoverage([])).toBe(0);
  expect(projectedLayerCoverage([[{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }]])).toBe(0);
});
