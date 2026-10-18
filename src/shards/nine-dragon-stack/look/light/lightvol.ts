// Copied from the light lab (the dev labs (deleted in E357 F7), round-9-lab-light) into the clean room.
// Lab P6 "light" (E169): warm LIGHT POOLS from every lantern, shop front, lamp and sign, baked once at build time into
// a small 3D irradiance texture (a "light volume") that every architecture program samples per pixel — one trilinear
// fetch per volume, any number of lights, no per-pixel light loop, no extra draw, no overdraw.
//
//  - A light is { at, color, k, r }: irradiance k·color / (1 + d²/r²), tapered to 0 at `cut`·r (a smooth window, so
//    the volume's bounds never show). Colours are linear.
//  - Two volumes: the square level (x −30…75, z −175…28, y +123…+171, 1 m cells) and the Well shaft below it
//    (1.5 m cells), each RGBA8: rgb = √(E / MAX) (perceptual, so the 8 bits go to the dim pool edges), a = the
//    luminance-weighted mean light direction's "up" share (0.5 + 0.5·ŷ) — the shader uses it to keep light that comes
//    from above off undersides and light from shop interiors (level) on walls and awnings.
//  - Bake: every light splats only the cells within cut·r (a 5 m lantern pool touches ~1.7k cells): 20 ms for the
//    clean room's 9.6k lights (387 lanterns, 84 shops / stalls, 4 lamps, 307 signs, 8784 lit windows) in JS. GPU memory:
//    4.2 MB (square, 106 × 49 × 204) + 0.6 MB (Well, 23 × 150 × 44), RGBA8.
//  - GLSL (`LIGHTVOL_GLSL`): `vec3 poolLight(vec3 wp, vec3 n)` = the irradiance at wp, shaped by the normal. The
//    material adds `albedo × poolLight × uLpGain.x` to its wash and, on wet ground, a broad glossy sheen
//    `poolLight × wet × uLpGain.y` (the wet stone's blurred reflection of the pool's light).
import { Data3DTexture } from 'three';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import metadata from '../../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../../boot/lookTypes.generated';

const light = metadata.looks.light as LookRows['light'];
// The boxes and exact RGBA8 splat are offline in generators/lightVolumes.ts.
// The page only lends the restored voxel textures and their transform uniforms.

/** uniforms the architecture programs share (add them to the clean room's Shared.u): the two volumes and data/light.ts'
 *  rows (the min / inv vectors after their volume, in the old order) */
export function lightVolUniforms(): { uLpVolA: { value: Data3DTexture }; uLpVolB: { value: Data3DTexture } } & UniformsOf<typeof light.volume> & UniformsOf<typeof light.haloUniforms> {
  const { uLpMinA, uLpInvA, ...rest } = uniformsFrom(light.volume);
  return { uLpVolA: { value: new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1) }, uLpMinA, uLpInvA, uLpVolB: { value: new Data3DTexture(new Uint8Array([0, 0, 0, 128]), 1, 1, 1) }, ...rest, ...uniformsFrom(light.haloUniforms) };
}
