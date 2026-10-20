// Lab P6 "light" (E169), from the light lab into the clean room; the GLSL and the rows are data (generators/compositeLight.ts).
//  - WINDOW GLOW: lit windows, shop fronts and lanterns bleed warm light into the silk fog at distance, riding in the
//    alpha channel of the bleed pyramid (½-res prefilter: brightness over a low threshold × warmth × distance; the
//    composite adds warm amber × (tight.a · halo + wide.a · veil), kept off anything nearer than the glow).
//  - COLOUR GRADE: a learned 33³ LUT (public/assets/nine-dragon/lab/grade-lut.bin, display sRGB in and out, through the
//    engine's one reader), the composite's last colour step before grain.
//  - LIGHT POOLS: every lantern, shop, lamp and sign baked offline (generators/lightVolumes.ts) into two RGBA8 irradiance
//    volumes (the square level and the Well shaft; rgb = √(E / MAX), a = the light's "up" share) that every architecture
//    program samples once per pixel. The page only lends the restored voxel textures and their transforms.
import { Data3DTexture, NoColorSpace } from 'three';
import { LookupTexture } from 'postprocessing';
import { loadCarriedLUT } from '@wildshard/engine/boot/bakedApi';
import { LUT_SIZE } from '@wildshard/engine/render/lut';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import metadata from '../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../boot/lookTypes.generated';

export const light = metadata.looks.light as LookRows['light'];

/** the glow's live uniforms */
export function glowUniforms(): UniformsOf<typeof light.glow> { return uniformsFrom(light.glow); }

/** a neutral grade until the learned LUT loads */
export function gradeUniforms(): { uLut: { value: Data3DTexture }; uLutAmt: { value: number } } {
  const texture = LookupTexture.createNeutral(LUT_SIZE).convertToUint8(); texture.colorSpace = NoColorSpace;
  return { uLut: { value: texture }, uLutAmt: { value: 0 } };
}

/** Use the existing engine LUT reader; a missing shipped grade refuses the build. */
export async function loadLut(url: string): Promise<Data3DTexture> {
  const texture = await loadCarriedLUT(url, 'nine-grade');
  if (texture === null) throw new Error(`Missing Nine grade LUT: ${url}`);
  return texture;
}

/** the light pools' shared uniforms: the two volumes (1-texel stand-ins until restored) and their rows */
export function lightVolUniforms(): { uLpVolA: { value: Data3DTexture }; uLpVolB: { value: Data3DTexture } } & UniformsOf<typeof light.volume> & UniformsOf<typeof light.haloUniforms> {
  const { uLpMinA, uLpInvA, ...rest } = uniformsFrom(light.volume);
  return { uLpVolA: { value: new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1) }, uLpMinA, uLpInvA, uLpVolB: { value: new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1) }, ...rest, ...uniformsFrom(light.haloUniforms) };
}
