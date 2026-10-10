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
import { type Data3DTexture, Vector3 } from 'three';
import { type VolumeBox, blankLightVolume } from '@wildshard/sdk/looks/lightVolume';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { LIGHTVOL_UNIFORMS } from '../../data/light';
// SHARD-PLATFORM M3: the uniforms' rows, LP_MAX and the GLSL (`LIGHTVOL_GLSL`) are data (data/light.ts); the bake is the
// SDK's light volume (@wildshard/sdk/looks/lightVolume, look/light/install.ts); this module keeps the two boxes and the uniforms.

/** the square level and the Well shaft (Lantern Square's layout.ts: WELL x −28…0, z −44…16; Y0 = 125) */
// (round 14) east to x 110: the stair-street's upper flights and its gate (x 22 … 102) were outside the pools
export const SQUARE_BOX: VolumeBox = { min: new Vector3(-30, 123, -175), max: new Vector3(110, 171, 28), cell: 1 };
export const WELL_BOX: VolumeBox = { min: new Vector3(-30, -100, -46), max: new Vector3(2, 123, 18), cell: 1.5 };

/** uniforms the architecture programs share (add them to the clean room's Shared.u): the two volumes and data/light.ts'
 *  rows (the min / inv vectors after their volume, in the old order) */
export function lightVolUniforms(): { uLpVolA: { value: Data3DTexture }; uLpVolB: { value: Data3DTexture } } & UniformsOf<typeof LIGHTVOL_UNIFORMS> {
  const { uLpMinA, uLpInvA, ...rest } = uniformsFrom(LIGHTVOL_UNIFORMS);
  return { uLpVolA: { value: blankLightVolume() }, uLpMinA, uLpInvA, uLpVolB: { value: blankLightVolume() }, ...rest };
}
