// Lab P6 "light" (E169), from the light lab into the clean room; the rows are data (the composite graph, generators/compositeGraph.ts).
//  - WINDOW GLOW: lit windows, shop fronts and lanterns bleed warm light into the silk fog at distance, riding in the
//    alpha channel of the bleed pyramid (½-res prefilter: brightness over a low threshold × warmth × distance; the
//    composite adds warm amber × (tight.a · halo + wide.a · veil), kept off anything nearer than the glow).
//  - COLOUR GRADE: a learned 33³ LUT (public/assets/nine-dragon/lab/grade-lut.bin, display sRGB in and out, through the
//    engine's one reader), the composite's last colour step before grain.
//  - LIGHT POOLS: every lantern, shop, lamp and sign baked offline (generators/lightVolumes.ts) into two RGBA8 irradiance
//    volumes (the square level and the Well shaft; rgb = √(E / MAX), a = the light's "up" share) that every architecture
//    program samples once per pixel. The page only lends the restored voxel textures and their transforms.
import { Data3DTexture } from 'three';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import metadata from '../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../boot/lookTypes.generated';

export const light = metadata.looks.light as LookRows['light'];

/** the light pools' shared uniforms: the two volumes (1-texel stand-ins until restored) and their rows */
export function lightVolUniforms(): { uLpVolA: { value: Data3DTexture }; uLpVolB: { value: Data3DTexture } } & UniformsOf<typeof light.volume> & UniformsOf<typeof light.haloUniforms> {
  const { uLpMinA, uLpInvA, ...rest } = uniformsFrom(light.volume);
  return { uLpVolA: { value: new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1) }, uLpMinA, uLpInvA, uLpVolB: { value: new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1) }, ...rest, ...uniformsFrom(light.haloUniforms) };
}
