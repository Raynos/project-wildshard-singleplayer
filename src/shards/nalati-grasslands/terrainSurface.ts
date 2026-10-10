/**
 * The painterly terrain's surface detail (Nalati look pass, lever 5 "ground surface"; world agent).
 *
 * The terrain mesh is a 2 m grid, so its vertex colours carry the macro painting (valley / plateau greens, gold and
 * olive patches, gravel, rock, snow — the def's `groundColor`). Everything finer comes from the painted tileable
 * textures (src/shards/nalati-grasslands/look/nalatiTextures.ts), per pixel, on top of the shared painterly lighting (`painterlyMaterial` —
 * this only patches the albedo after `color_fragment`, so the look-director's light / shade / rim stays the one ramp):
 *
 *   · meadow   painted grass detail, luminance-preserving over the macro colour (the vertex colour keeps the hue),
 *              two taps (the second at 0.37×, turned 30°) blended by a low-frequency noise so the tiling never reads
 *   · roads    the painted dirt track, laid ALONG the road (uv = across × along the nearest trail, so the painted ruts
 *              follow it), darker wheel ruts, a grassy crown, a ragged grassy verge
 *   · gravel   the painted river stones on the bars, darker and greener at the wet margin
 *   · rock     the painted granite, triplanar (XZ / XY / ZY by |normal|⁴) on the steep faces and the slab walls
 *   · snow     the painted snow above the snow line
 *
 * The per-vertex masks come in two attributes (built by Terrain.ts):
 *   surf = (signed metres across the nearest road (±9 = none), gravel 0..1, snow 0..1, rock 0..1)
 *   rdir = the nearest road's direction (unit xz)
 *
 *   applyTerrainSurface(mat, textures)   // before sky.setupMaterial; the material's program key is 'painterly-terrain-v2'
 */
import * as THREE from 'three';
import { TEX_METRES, TEX_MEAN, isPhoneTier, type NalatiTexName } from './look/nalatiTextures';
import { V2_OLIVE_GLSL } from './look/light';
import { LOOK_BAKE_GLSL, bakeUniforms, PHONE_STATIC_OFF_CSM } from './look/bake';
import { SNOW_LINE, GLACIER } from './layout';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { TERRAIN_GLSL } from './data/terrainGlsl';

/** the GLSL below is data (data/terrainGlsl.ts); `@{name}` splices the fragments this module passes */
const TERRAIN_GLSL_FAMILY = new ShaderFamily(TERRAIN_GLSL, {});

export type TerrainTextures = Record<'meadow' | 'path' | 'gravel' | 'rock' | 'snow', THREE.Texture>;

const VERT_PARS = TERRAIN_GLSL_FAMILY.glsl(TERRAIN_GLSL.VERT_PARS);
const VERT_MAIN = TERRAIN_GLSL_FAMILY.glsl(TERRAIN_GLSL.VERT_MAIN);

/**
 * The snow ring's granite: the painted rock triplanar at two scales (the big tap, stretched down the fall
 * line on the side projections, breaks a 60 m face into blocks and streaks; desktop only), vertical fractures and
 * tilted strata bands across the faces (along-face coordinate: x on the faces that look ±z, z on those that look ±x),
 * dark and cool so the snow reads against it.
 */
const CRAG_ROCK_GLSL = TERRAIN_GLSL_FAMILY.glsl(TERRAIN_GLSL.CRAG_ROCK_GLSL, { CRAG_DETAIL: isPhoneTier() ? `r = mix( r, tRockBig( p, N, s ), smoothstep( 0.25, 0.75, tNoise( p.xz * 0.045 + p.y * 0.03 ) ) );` : `vec2 st = vec2( 1.0, 0.45 ) * s * 0.21;
  vec3 b = texture2D( tRock, p.zy * st ).rgb * w.x + texture2D( tRock, p.xz * s * 0.21 ).rgb * w.y + texture2D( tRock, p.xy * st ).rgb * w.z;
  r *= mix( vec3( 1.0 ), b / uMeanRock, 0.6 );` });

const FRAG_PARS = TERRAIN_GLSL_FAMILY.glsl(TERRAIN_GLSL.FRAG_PARS, { V2_OLIVE_GLSL, LOOK_BAKE_GLSL, CRAG_ROCK_GLSL });

/**
 * The three zones of layout v2 (src/shards/nalati-grasslands/look/zones.ts → the per-vertex `zone` weights) — the valley a lush
 * fresh green, the bowl gold, the snow ring cold: blue-grey scree on the gentle ground, granite on the steep, snowfields
 * lying in the hollows and on the flats (a slow noise), all on the painted textures. The slab's walls carry no zone.
 */
const ZONES_V2 = TERRAIN_GLSL_FAMILY.glsl(TERRAIN_GLSL.ZONES_V2, { SNOW_LO: (SNOW_LINE - 10).toFixed(1), SNOW_HI: (SNOW_LINE + 2).toFixed(1), GLACIER_X0: GLACIER.x0.toFixed(1), GLACIER_Z0: GLACIER.z0.toFixed(1), GLACIER_DX: (GLACIER.x1 - GLACIER.x0).toFixed(1), GLACIER_DZ: (GLACIER.z1 - GLACIER.z0).toFixed(1), GLACIER_HALF: GLACIER.half.toFixed(1), GLACIER_LEN: Math.hypot(GLACIER.x1 - GLACIER.x0, GLACIER.z1 - GLACIER.z0).toFixed(1) });

const FRAG_MAIN = TERRAIN_GLSL_FAMILY.glsl(TERRAIN_GLSL.FRAG_MAIN, { ZONES_V2 });

const mean = (n: NalatiTexName): THREE.Vector3 => new THREE.Vector3(...TEX_MEAN[n]);

/** Patch the terrain's painterly material with the painted surface detail (see the header). */
export function applyTerrainSurface(mat: THREE.Material, tex: TerrainTextures): void {
  const uniforms = {
    tMeadow: { value: tex.meadow }, tPath: { value: tex.path }, tGravel: { value: tex.gravel }, tRock: { value: tex.rock }, tSnow: { value: tex.snow },
    uMeanMeadow: { value: mean('meadow') }, uMeanRock: { value: mean('rock') },
    uTexScale: { value: new THREE.Vector4(1 / TEX_METRES.meadow, 1 / TEX_METRES.path, 1 / TEX_METRES.gravel, 1 / TEX_METRES.rock) },
    uSnowScale: { value: 1 / TEX_METRES.snow },
  };
  patchShader(mat, 'nalati.terrain', PATCH_ORDER.decorate, (shader) => {
    Object.assign(shader.uniforms, uniforms);
    Object.assign(shader.uniforms, bakeUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
      .replace('#include <worldpos_vertex>', VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_PARS}`)
      .replace('#include <color_fragment>', FRAG_MAIN);
    // phone: the static casters are out of the realtime shadow map (look/bake.ts) — the key light on the ground is
    // shadowed by the bake instead (CSM still adds what moves)
    if (PHONE_STATIC_OFF_CSM) {
      shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin
        .replaceAll('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\t\tdirectLight.color *= bakedShadow( vTWorld );')
        .replaceAll('getDirectionalLightInfo( directionalLights[0], directLight );', 'getDirectionalLightInfo( directionalLights[0], directLight );\n\t\tdirectLight.color *= bakedShadow( vTWorld );'));
    }
  }, { key: 'painterly-terrain-v2' });
}
