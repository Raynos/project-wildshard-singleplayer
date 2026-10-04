import * as THREE from 'three';

/**
 * SF47-g (E435, Debug ▸ Loading ▸ Pine memory trim): a decoded HDRI sky key as RGB9_E5 instead of RGBA16F. The key's alpha is
 * the constant 1 the decode writes (BakedSky.ts) and the sky shader reads only .rgb, so the GPU keeps 4 bytes a texel, not 8:
 * 16.8 MB → 8.4 MB per 2048 × 1024 key, two to three resident. RGB9_E5 keeps 9 mantissa bits per channel under one shared
 * exponent (half float: 10 bits each), sampled and filtered like the half-float key; the driver packs it from the half-float
 * RGB rows at upload (WebGL2: RGB9_E5 ← RGB / HALF_FLOAT). Call it after anything reads the RGBA data (horizonOf).
 */
export function packSkyKeyRgb9e5(tex: THREE.DataTexture): void {
  const { width, height, data } = tex.image;
  if (!(data instanceof Uint16Array) || tex.format !== THREE.RGBAFormat || tex.type !== THREE.HalfFloatType) throw new Error('Pine sky key: expected RGBA half-float data');
  const texels = width * height, rgb = new Uint16Array(texels * 3);
  for (let i = 0; i < texels; i++) {
    rgb[i * 3] = data[i * 4] ?? 0; rgb[i * 3 + 1] = data[i * 4 + 1] ?? 0; rgb[i * 3 + 2] = data[i * 4 + 2] ?? 0;
  }
  tex.image.data = rgb;
  tex.format = THREE.RGBFormat;
  tex.internalFormat = 'RGB9_E5';
  tex.needsUpdate = true;
}
