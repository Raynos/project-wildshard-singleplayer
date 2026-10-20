import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, LinearSRGBColorSpace, NoColorSpace, RepeatWrapping, RGBAFormat, SRGBColorSpace, UnsignedByteType, type Texture } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { BASIS_PATH, detectKtx2Support } from '@wildshard/engine/core/ktx2';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { loadTextureRow } from '@wildshard/engine/core/assets';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { workSlice } from '@wildshard/engine/core/workSlice';
import { TIER } from '@wildshard/engine/core/tier';
import type { Scope } from '@wildshard/engine/app/scope';
import type { WorldSceneLentTexture } from '@wildshard/format/worldScenes';
import { setLentParam, setLentTexture } from './lentLooks';
import { applyTextureSampler } from './clientMaterials';
import type { SceneHandles } from './sceneHandles';
import type { ShardProduct } from './shardProduct';

/** Client-only: load each declared texture under `owner`, lend it to its compiled looks (they are lent first) and
 * publish a product texture that names a handle. */
export async function lendWorldSceneTextures(rows: readonly WorldSceneLentTexture[], owner: Scope, product: Pick<ShardProduct, 'file'>, handles: SceneHandles, renderer: Renderer | undefined): Promise<void> {
  const products = rows.filter(row => row.kind === 'product');
  if (products.length > 0 && renderer === undefined) throw new Error('Product textures need the world renderer');
  const loader = renderer === undefined || products.length === 0 ? null : detectKtx2Support(new KTX2Loader().setTranscoderPath(BASIS_PATH), renderer);
  try {
    await Promise.all(rows.map(async row => {
      const texture = owner.own(row.kind === 'image' ? await loadTextureRow(row) : row.kind === 'layers' ? await loadLayers(row) : await loadProduct(row, product, loader));
      if (owner.disposed) throw new Error('World scene textures unloaded while loading');
      if (row.kind === 'product') {
        if (row.publish !== undefined) handles.publish(row.publish, texture);
        if (row.param !== undefined) for (const look of row.looks) setLentTexture(look, row.param, texture);
        return;
      }
      for (const look of row.looks) setLentTexture(look, row.param, texture);
      if (row.kind !== 'image' || row.sizeParam === undefined) return;
      const image: unknown = texture.image;
      if (typeof image !== 'object' || image === null || !('width' in image) || !('height' in image) || typeof image.width !== 'number' || typeof image.height !== 'number') throw new Error(`Lent texture ${row.url} has no pixel size`);
      for (const look of row.looks) setLentParam(look, row.sizeParam, [image.width, image.height]);
    }));
  } finally { loader?.dispose(); }
}

/** A product's own KTX2 blob for the tier (its encoded orientation, flipY false), sampled by its row; GPU-only once uploaded. */
async function loadProduct(row: Extract<WorldSceneLentTexture, { kind: 'product' }>, product: Pick<ShardProduct, 'file'>, loader: KTX2Loader | null): Promise<Texture> {
  if (loader === null) throw new Error('Product textures need a KTX2 reader');
  const bytes = Uint8Array.from(await product.file(row.file[TIER]));
  const texture = await new Promise<Texture>((resolve, reject) => { loader.parse(bytes.buffer, resolve, reject); });
  texture.flipY = false; texture.name = row.label;
  if (row.colour !== undefined) texture.colorSpace = row.colour === 'srgb' ? SRGBColorSpace : LinearSRGBColorSpace;
  applyTextureSampler(texture, row.sampler);
  texture.needsUpdate = true;
  gpuOnlyTexture(texture, row.label);
  return texture;
}

async function blob(url: string): Promise<Blob> {
  const res = await fetch(phoneUrl(url));
  if (!res.ok) throw new Error(`Lent layer ${url} failed to load (${res.status})`);
  return res.blob();
}

/** an image's texels at `size`², rows flipped so its top is v = 1 */
function pixels(image: ImageBitmap, size: number): Uint8ClampedArray {
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size }), c2 = canvas.getContext('2d', { willReadFrequently: true });
  if (c2 === null) throw new Error('Lent layers need a 2d canvas');
  c2.setTransform(1, 0, 0, -1, 0, size); c2.drawImage(image, 0, 0, size, size);
  return c2.getImageData(0, 0, size, size).data;
}

/** The compressed downloads overlap; each layer decodes and reads back alone, so the peak decoded memory stays one layer. */
async function loadLayers(row: Extract<WorldSceneLentTexture, { kind: 'layers' }>): Promise<Texture> {
  const size = row.size[TIER], data = new Uint8Array(size * size * 4 * row.layers.length), slice = workSlice();
  const files = await Promise.all(row.layers.map(layer => Promise.all([blob(`${row.base}/${layer.name}.jpg`), layer.alpha ? blob(`${row.base}/${layer.name}-a.jpg`) : null])));
  for (const [i, [rgb, alpha]] of files.entries()) {
    if (slice.due()) await slice.yield();
    const colour = await createImageBitmap(rgb), cover = alpha === null ? null : await createImageBitmap(alpha), at = i * size * size * 4;
    try {
      data.set(pixels(colour, size), at);
      const mask = cover === null ? null : pixels(cover, size);
      for (let k = 0; k < size * size; k++) data[at + k * 4 + 3] = mask === null ? 128 : mask[k * 4] ?? 128;
    } finally { colour.close(); cover?.close(); }
  }
  const texture = new DataArrayTexture(data, size, size, row.layers.length);
  Object.assign(texture, { format: RGBAFormat, type: UnsignedByteType, colorSpace: NoColorSpace, wrapS: RepeatWrapping, wrapT: RepeatWrapping,
    minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, generateMipmaps: true, anisotropy: row.anisotropy, needsUpdate: true });
  // (E264) the array's pixels are on the GPU once uploaded; nothing reads them again
  gpuOnlyTexture(texture, row.label);
  return texture;
}
