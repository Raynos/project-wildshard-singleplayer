// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import * as THREE from 'three';
import { widenRgbEtc2 } from '@wildshard/engine/core/ktx2';

const block = (seed: number): number[] => Array.from({ length: 8 }, (_, i) => (seed * 31 + i * 7) & 0xff);

it('widens RGB8 ETC2 to RGBA8 ETC2/EAC with an opaque alpha block before each colour block', () => {
  // 8×8 level 0 (four blocks), 4×4 level 1 (one block), as layers of a two-layer array
  const l0 = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7].flatMap(block));
  const l1 = Uint8Array.from([8, 9].flatMap(block));
  const t = new THREE.CompressedArrayTexture([{ data: l0, width: 8, height: 8 }, { data: l1, width: 4, height: 4 }], 8, 8, 2, THREE.RGB_ETC2_Format);
  const version = t.version;
  expect(widenRgbEtc2(t)).toBe(t);
  expect(t.format).toBe(THREE.RGBA_ETC2_EAC_Format);
  expect(t.version).toBeGreaterThan(version);
  const [m0, m1] = t.mipmaps;
  expect(m0?.data.byteLength).toBe(l0.byteLength * 2);
  expect(m1?.data.byteLength).toBe(l1.byteLength * 2);
  expect([m0?.width, m0?.height, m1?.width, m1?.height]).toEqual([8, 8, 4, 4]);
  const out = m0 === undefined ? new Uint8Array(0) : new Uint8Array(m0.data.buffer, m0.data.byteOffset, m0.data.byteLength);
  for (let b = 0; b < 8; b++) {
    expect([...out.subarray(b * 16, b * 16 + 8)]).toEqual([0xff, 0, 0, 0, 0, 0, 0, 0]);
    expect([...out.subarray(b * 16 + 8, b * 16 + 16)]).toEqual(block(b));
  }
});

it('leaves every other format alone', () => {
  const data = Uint8Array.from(block(1).concat(block(2)));
  const t = new THREE.CompressedTexture([{ data, width: 4, height: 4 }], 4, 4, THREE.RGBA_ASTC_4x4_Format);
  const version = t.version;
  widenRgbEtc2(t);
  expect(t.format).toBe(THREE.RGBA_ASTC_4x4_Format);
  expect(t.mipmaps[0]?.data).toBe(data);
  expect(t.version).toBe(version);
});
