import * as v from 'valibot';
import { Data3DTexture, LinearFilter } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { fetchDeflatedBytes } from '@wildshard/engine/core/deflate';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { LightVolumeRowSchema } from '@wildshard/format/lightVolume';
import type { ShardProduct } from '../shardfile/shardProduct';

/** A loaded light volume: its GPU-only 3D texture and the box and range it samples (format/lightVolume). */
export interface LightVolume {
  readonly texture: Data3DTexture;
  readonly min: readonly number[];
  readonly inv: readonly number[];
  readonly maximum: number;
}

/** G571: read a baked irradiance volume row's file through the product (its bytes must fill `size` RGBA8 voxels) into a
 *  linearly filtered 3D texture `owner` disposes, kept on the GPU only once uploaded. Client-only. */
export async function loadLightVolume(product: Pick<ShardProduct, 'url'>, input: unknown, owner: Scope): Promise<LightVolume> {
  const row = v.parse(LightVolumeRowSchema, input), [x, y, z] = row.size;
  const bytes = await fetchDeflatedBytes(product.url(row.file));
  if (bytes.length !== x * y * z * 4) throw new Error('Light volume size differs');
  const texture = owner.own(new Data3DTexture(bytes, x, y, z)); texture.needsUpdate = true;
  texture.minFilter = texture.magFilter = LinearFilter; texture.unpackAlignment = 1;
  gpuOnlyTexture(texture, 'Baked light volumes (GPU only)');
  return { texture, min: row.min, inv: row.inv, maximum: row.maximum };
}
