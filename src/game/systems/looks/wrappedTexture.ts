// wrappedTexture — a colour image that repeats along u (a panning scroll, a looping band), loaded once (SHARD-PLATFORM M3,
// ex Nine Dragon's look/scroll.ts): the phone's KTX2 copy where there is one (its own mips), else the image itself, sRGB,
// trilinear and anisotropic, its mips generated and the decoded image dropped once it is on the GPU.
//
//   const tex = await loadWrappedTexture('/assets/x/scroll.webp', 'X sky scroll (GPU only)');
import { LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace, type Texture, TextureLoader } from 'three';
import { phoneUrl } from '@wildshard/engine/boot/bytes';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { ktx2Texture } from '@wildshard/engine/core/ktx2';

/** Load a colour texture that repeats along u: KTX2 where the phone has one, else the image, mipmapped and made GPU-only (`label`). */
export async function loadWrappedTexture(url: string, label: string, anisotropy = 4): Promise<Texture> {
  const compressed = await ktx2Texture(phoneUrl(url));
  const t = compressed ?? await new TextureLoader().loadAsync(url);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.anisotropy = anisotropy;
  if (compressed === null) { t.generateMipmaps = true; t.needsUpdate = true; }
  // (E264) the decoded image is on the GPU after the first draw
  if (compressed === null) gpuOnlyTexture(t, label);
  return t;
}
