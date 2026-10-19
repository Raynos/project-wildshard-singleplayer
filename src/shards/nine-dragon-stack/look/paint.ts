// Keep the original compressed image path while predecoded payloads exceed admission.
import { DataArrayTexture } from 'three';
import { loadPaintArray } from '../runtime/looks/paintArray';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
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
/** Decode the original compressed layers at the unchanged per-tier size. */
export function loadPaint(base: string, anisotropy: number, tier: Tier, onLayer: (fraction: number) => void = () => undefined): Promise<{ tex: DataArrayTexture; bytes: number }> {
  return loadPaintArray(base, paint.layers, paint.sizes[tier], anisotropy, 'Nine Dragon paint array (GPU only)', onLayer);
}

export function paintUniforms(): { uPaint: { value: DataArrayTexture } } & UniformsOf<typeof paint.uniforms> {
  return { uPaint: { value: paintPlaceholder() }, ...uniformsFrom(paint.uniforms) };
}
