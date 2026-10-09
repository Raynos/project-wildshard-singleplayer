// oxlint-disable-next-line import/no-nodejs-modules -- Read the committed bake bytes in this Node fixture.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Noise2D } from '../../src/engine/core/noise';
import { CLOUD_FIELD_URL } from '../../src/engine/boot/bakedApi';
import { CLOUD_FIELD_N, cloudFieldPixels } from '../../src/engine/world/cloudField';

/** skyBackdrop.ts makeCloudTexture before SF67: the ImageData it put on the canvas */
function legacyImageData(): Uint8ClampedArray {
  const N = 512;
  const data = new Uint8ClampedArray(N * N * 4);
  const n = new Noise2D(1234);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = (x / N) * Math.PI * 2, v = (y / N) * Math.PI * 2;
    const px = Math.cos(u) * 1.5, py = Math.sin(u) * 1.5, pz = Math.cos(v) * 1.5, pw = Math.sin(v) * 1.5;
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < 6; o++) { const f = 2 ** o; s += (n.get((px + pz * 0.7) * f, (py + pw * 0.7) * f + o * 7.3) * 0.5 + 0.5) * amp; norm += amp; amp *= 0.55; }
    s /= norm;
    const i = (y * N + x) * 4; data[i] = data[i + 1] = data[i + 2] = s * 255; data[i + 3] = 255;
  }
  return data;
}

describe('cloud field bake (SF67)', () => {
  it('expands to exactly the ImageData the canvas got before, and the committed bake holds those bytes', () => {
    const grey = cloudFieldPixels();
    expect(grey.length).toBe(CLOUD_FIELD_N * CLOUD_FIELD_N);
    const legacy = legacyImageData();
    const fromBake = new Uint8ClampedArray(legacy.length);
    for (let p = 0; p < grey.length; p++) { const s = grey[p] ?? 0, i = p * 4; fromBake[i] = fromBake[i + 1] = fromBake[i + 2] = s; fromBake[i + 3] = 255; }
    expect(fromBake).toEqual(legacy);
    const committed = readFileSync(new URL(`../../public${CLOUD_FIELD_URL}`, import.meta.url));
    expect(new Uint8ClampedArray(committed)).toEqual(grey);
  });
});
