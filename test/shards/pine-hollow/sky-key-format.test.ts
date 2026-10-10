import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { packSkyKeyRgb9e5 } from '@wildshard/sdk/looks/keyedSky';

describe('Pine memory trim: the HDRI sky key as RGB9_E5 (SF47-g)', () => {
  it('keeps every RGB half float, drops the constant alpha and asks the GPU for 4 bytes a texel', () => {
    const one = THREE.DataUtils.toHalfFloat(1);
    const values = [0, 0.25, 3.5, 1, 120, 0.002, 65000, 7, 0.5];
    const data = new Uint16Array(3 * 4);
    for (let i = 0; i < 3; i++) {
      data[i * 4] = THREE.DataUtils.toHalfFloat(values[i * 3] ?? 0);
      data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(values[i * 3 + 1] ?? 0);
      data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(values[i * 3 + 2] ?? 0);
      data[i * 4 + 3] = one;
    }
    const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat, THREE.HalfFloatType);
    packSkyKeyRgb9e5(tex);
    expect(tex.format).toBe(THREE.RGBFormat);
    expect(tex.type).toBe(THREE.HalfFloatType);
    expect(tex.internalFormat).toBe('RGB9_E5');
    const packed: unknown = tex.image.data;
    if (!(packed instanceof Uint16Array)) throw new Error('expected half floats');
    expect(packed).toHaveLength(9);
    for (let i = 0; i < 3; i++) for (let c = 0; c < 3; c++) expect(packed[i * 3 + c]).toBe(data[i * 4 + c]);
  });
  it('refuses anything but RGBA half-float data (a second pack or another decode)', () => {
    const tex = new THREE.DataTexture(new Uint16Array(4), 1, 1, THREE.RGBAFormat, THREE.HalfFloatType);
    packSkyKeyRgb9e5(tex);
    expect(() => { packSkyKeyRgb9e5(tex); }).toThrow('expected RGBA half-float');
  });
});
