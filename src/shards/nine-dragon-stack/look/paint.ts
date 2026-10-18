// Painted ratios arrive predecoded; the graph retains its nine authored layers.
import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping } from 'three';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import type { Tier } from '@wildshard/engine/core/tier';
import metadata from '../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../boot/lookTypes.generated';

const paint = metadata.looks.paint as LookRows['paint'];

export const SURF = paint.surfaces;
/** Ratio one in every layer while the admitted files load. */
export function paintPlaceholder(): DataArrayTexture {
  const data = new Uint8Array(paint.layers.length * 4);
  paint.layers.forEach((layer, i) => { const v = Math.round(255 / layer.scale); data.set([v, v, v, 128], i * 4); });
  const texture = new DataArrayTexture(data, 1, 1, paint.layers.length); texture.needsUpdate = true; return texture;
}
/** Restore bounded lossless chunks without canvas readback or image allocations. */
export async function loadPaint(_base: string, anisotropy: number, tier: Tier, onLayer: (fraction: number) => void = () => undefined): Promise<{ tex: DataArrayTexture; bytes: number }> {
  const product = await loadFirstPartyProduct('nine-dragon-stack');
  const size = paint.sizes[tier], layers = paint.layers.length, layerBytes = size * size * 4;
  const data = new Uint8Array(layerBytes * layers); let bytes = 0, done = 0;
  for (let layer = 0; layer < layers; layer++) for (let offset = 0; offset < layerBytes; offset += paint.chunkBytes) {
    const packed = await product.file(`looks/paint/${tier}/${layer}-${offset}.bin`); bytes += packed.length;
    const decoded = await new Response(new Blob([Uint8Array.from(packed)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
    if (decoded.byteLength !== Math.min(paint.chunkBytes, layerBytes - offset)) throw new Error('Paint chunk size differs');
    data.set(new Uint8Array(decoded), layer * layerBytes + offset); done++; onLayer(done / (Math.ceil(layerBytes / paint.chunkBytes) * layers));
  }
  const tex = new DataArrayTexture(data, size, size, layers);
  tex.wrapS = tex.wrapT = RepeatWrapping; tex.minFilter = LinearMipmapLinearFilter; tex.magFilter = LinearFilter;
  tex.generateMipmaps = true; tex.anisotropy = anisotropy; tex.needsUpdate = true;
  gpuOnlyTexture(tex, 'Nine Dragon paint array (GPU only)'); return { tex, bytes };
}
export function paintUniforms(): { uPaint: { value: DataArrayTexture } } & UniformsOf<typeof paint.uniforms> {
  return { uPaint: { value: paintPlaceholder() }, ...uniformsFrom(paint.uniforms) };
}
