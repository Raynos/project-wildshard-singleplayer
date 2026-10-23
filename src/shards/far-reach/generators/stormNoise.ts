import { bakeSkySeaTexture } from './seaTexture';
import { writeImagePixels } from '@wildshard/sdk/bake/image';
import { bakeRawColourTexture } from '@wildshard/sdk/bake/texture';

/** Retain the existing density/light raster as a lossless, linear library
 * texture. Row order, alpha and channel meaning match the original DataTexture. */
export async function bakeStormNoise(): Promise<Uint8Array> {
  const SEA_BAKE=bakeSkySeaTexture(),pixels = new Uint8ClampedArray(SEA_BAKE.rgba);
  const png = await writeImagePixels({ width: SEA_BAKE.size, height: SEA_BAKE.size, pixels });
  return bakeRawColourTexture(png, { colourSpace: 'linear' });
}
