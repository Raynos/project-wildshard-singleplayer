// paintArray — painted surface swatches loaded into ONE mipmapped RGBA8 texture array (SHARD-PLATFORM M3, ex Nine
// Dragon's look/paint.ts, lab P5 "texture", E169): each layer a seamless JPEG of detail ratios (linear texel / its
// local mean, stored as ratio / scale) a ruled material multiplies its wash by, its alpha a second JPEG (a cavity map or
// a coverage mask) or ½. The compressed downloads overlap; each layer is decoded and read back one at a time (rows
// flipped so the image's top is v = 1), so the build's peak decoded-image memory stays one layer. Until the array
// loads, a 1-texel stand-in holds every layer's ratio 1 (255 / scale).
//
//   const { tex } = await loadPaintArray('/assets/x/paint', LAYERS, 1024, 8, 'X paint array (GPU only)', onLayer);
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { workSlice } from '@wildshard/engine/core/workSlice';

/** A paint layer: its file name (`<name>.jpg`, and `<name>-a.jpg` with an alpha), the ratio scale it is stored at, and whether it has an alpha. */
export interface PaintLayer { readonly name: string; readonly scale: number; readonly alpha: boolean }

async function loadBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`paint: ${url} failed to load (${res.status})`);
  return res.blob();
}

/** the texels of an image, rows flipped so the image's top is v = 1 (grime runs fall toward −v, the kit's down) */
function pixels(img: ImageBitmap, size: number): Uint8ClampedArray {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c2 = cv.getContext('2d', { willReadFrequently: true });
  if (c2 === null) throw new Error('paint: 2d canvas unavailable');
  c2.setTransform(1, 0, 0, -1, 0, size);
  c2.drawImage(img, 0, 0, size, size);
  return c2.getImageData(0, 0, size, size).data;
}

/** A 1-texel stand-in (ratio 1 everywhere: 255 / scale, alpha ½) per layer until the real array has loaded. */
export function paintArrayPlaceholder(layers: readonly PaintLayer[]): DataArrayTexture {
  const n = layers.length;
  const data = new Uint8Array(4 * n);
  layers.forEach((l, i) => { const v = Math.round(255 / l.scale); data.set([v, v, v, 128], i * 4); });
  const t = new DataArrayTexture(data, 1, 1, n);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.needsUpdate = true;
  return t;
}

/** Load every layer (`base` = the folder URL) at `size`² into one mipmapped, repeating RGBA8 array, GPU-only once uploaded (`label`); `onLayer(fraction)` after each. */
export async function loadPaintArray(base: string, layers: readonly PaintLayer[], size: number, anisotropy: number, label: string, onLayer: (fraction: number) => void = () => undefined): Promise<{ tex: DataArrayTexture; bytes: number }> {
  const S = size;
  const n = layers.length;
  const data = new Uint8Array(S * S * 4 * n);
  let bytes = 0;
  // Start the small compressed downloads together, then decode/read back just one layer at a time.
  // Serial fetches made the phone wait for 11 network round trips; parallel ImageBitmaps instead
  // would raise the build's peak decoded-image memory, so only the compressed Blobs overlap.
  const compressed = await Promise.all(layers.map(async (l) => {
    const [rgb, alpha] = await Promise.all([
      loadBlob(phoneUrl(`${base}/${l.name}.jpg`)),
      l.alpha ? loadBlob(phoneUrl(`${base}/${l.name}-a.jpg`)) : Promise.resolve(undefined),
    ]);
    return { rgb, alpha };
  }));
  // op-hitch23: a frame between layers' read-backs (a grid cell loads this on the road, in play)
  const slice = workSlice();
  for (const [i, layer] of compressed.entries()) {
    if (slice.due()) await slice.yield();
    const rgb = await createImageBitmap(layer.rgb);
    let alpha: ImageBitmap | undefined;
    try {
      if (layer.alpha !== undefined) alpha = await createImageBitmap(layer.alpha);
      bytes += layer.rgb.size + (layer.alpha?.size ?? 0);
      const p = pixels(rgb, S);
      const off = i * S * S * 4;
      data.set(p, off);
      if (alpha !== undefined) {
        if (slice.due()) await slice.yield();
        const pa = pixels(alpha, S);
        for (let k = 0; k < S * S; k++) data[off + k * 4 + 3] = pa[k * 4] ?? 128;
      } else {
        for (let k = 0; k < S * S; k++) data[off + k * 4 + 3] = 128;
      }
    } finally {
      rgb.close();
      alpha?.close();
    }
    onLayer((i + 1) / n);
  }
  const t = new DataArrayTexture(data, S, S, n);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.colorSpace = NoColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  // (E264) the array's pixels are on the GPU once uploaded; nothing reads them again
  gpuOnlyTexture(t, label);
  return { tex: t, bytes };
}
