// Copied from the texture lab (the dev labs (deleted in E357 F7), round-9-lab-texture) into the clean room.
// P5 "texture" (E169, round-9-lab-texture): PAINTED SURFACE TEXTURES under the Jiehua ink.
//
// Nine codex image_gen swatches (art/nine-dragon-stack/round-9-lab-texture/tools/mkjobs.py), made seamless and turned
// into DETAIL RATIOS by tools/texprep.py (linear texel / its flattened local mean, stored as ratio / scale), loaded into
// ONE RGBA8 texture array (1024² × 9, mipmapped, anisotropic). The material multiplies its wash by the ratio before
// the ruled lines are composed, so the lines stay crisp, the palette stays the wash's (the deepest mip is exactly 1: a
// far surface is its flat wash, the round-8 ΔE fit survives), and the paint reads as painted grain, grime runs, carved
// relief, glaze and lacquer. Alpha carries a cavity map (flagstone puddles) or a coverage mask (posters).
//
// Surfaces pick a layer by their kind (flag 3 → flag/flag2 per stone, panel 5 → the carved frieze, tiles 2 → glazed
// tiles, facade 1 → concrete, stone 9 → stone) or explicitly by `Look.surf` (flag bits × 4096): see SURF.
// Cost: 1 sample (flags, panel field, tiles, lacquer, wood), 2 samples (concrete / stone: a second scale), 3 on a
// poster wall (concrete ×2 + the poster). GPU memory 1024² × 9 × 4 B × 4/3 = 50 MB as RGBA8 (the lab); ~12.6 MB as ASTC
// 4×4 / ETC2 in a KTX2 array for shipping. Download: the JPEGs, 3.65 MB. Findings: round-9-lab-texture/README.md.
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { paintSize, type NdTier } from '../tier';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { LAYERS, PAINT_UNIFORMS, SURF as PAINT_SURF } from '../data/paint';

// SHARD-PLATFORM M3: the layers, the surfaces, the flagstone layout, the uniforms' rows and the GLSL are data
// (data/paint.ts); this module loads the array.

/** Look.surf: an explicit surface (flag bits × 4096); 0 = by kind (data/paint.ts) */
export const SURF: typeof PAINT_SURF = PAINT_SURF;

// The 1024px array alone holds 48 MiB on the GPU. On a phone, 512px preserves the authored ratios at the
// displayed scale and reduces the array and its upload buffer to one quarter of that size.

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

/** a 1-texel stand-in (ratio 1 everywhere) until the real array has loaded */
export function paintPlaceholder(): DataArrayTexture {
  const n = LAYERS.length;
  const data = new Uint8Array(4 * n);
  LAYERS.forEach((l, i) => { const v = Math.round(255 / l.scale); data.set([v, v, v, 128], i * 4); });
  const t = new DataArrayTexture(data, 1, 1, n);
  t.format = RGBAFormat;
  t.type = UnsignedByteType;
  t.needsUpdate = true;
  return t;
}

/** load every layer (`base` = the folder URL) into one mipmapped RGBA8 array */
export async function loadPaint(base: string, anisotropy: number, tier: NdTier, onLayer: (fraction: number) => void = () => undefined): Promise<{ tex: DataArrayTexture; bytes: number }> {
  const S = paintSize(tier);
  const n = LAYERS.length;
  const data = new Uint8Array(S * S * 4 * n);
  let bytes = 0;
  // Start the small compressed downloads together, then decode/read back just one layer at a time.
  // Serial fetches made the phone wait for 11 network round trips; parallel ImageBitmaps instead
  // would raise the build's peak decoded-image memory, so only the compressed Blobs overlap.
  const compressed = await Promise.all(LAYERS.map(async (l) => {
    const [rgb, alpha] = await Promise.all([
      loadBlob(phoneUrl(`${base}/${l.name}.jpg`)),
      l.alpha ? loadBlob(phoneUrl(`${base}/${l.name}-a.jpg`)) : Promise.resolve(undefined),
    ]);
    return { rgb, alpha };
  }));
  for (const [i, layer] of compressed.entries()) {
    const rgb = await createImageBitmap(layer.rgb);
    let alpha: ImageBitmap | undefined;
    try {
      if (layer.alpha !== undefined) alpha = await createImageBitmap(layer.alpha);
      bytes += layer.rgb.size + (layer.alpha?.size ?? 0);
      const p = pixels(rgb, S);
      const off = i * S * S * 4;
      data.set(p, off);
      if (alpha !== undefined) {
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
  gpuOnlyTexture(t, 'Nine Dragon paint array (GPU only)');
  return { tex: t, bytes };
}

/** the paint uniforms (merged into Shared.u so every world program sees one object): the array and data/paint.ts' rows */
export function paintUniforms(): { uPaint: { value: DataArrayTexture } } & UniformsOf<typeof PAINT_UNIFORMS> {
  return { uPaint: { value: paintPlaceholder() }, ...uniformsFrom(PAINT_UNIFORMS) };
}
