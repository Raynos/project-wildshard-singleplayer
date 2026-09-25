/**
 * Look v2 — fog coloured from the panorama (port-v2.md step 2).
 *
 * Every fogged material (terrain, grass, spruce, POIs, creatures — everything on Atmosphere.ts's chunks) fades into the
 * painted haze of the sky straight behind it: the colour is a 256 × 1 LUT over compass azimuth (panoramaData.ts, the
 * painting's band just above its horizon, blurred), taken back through the grade's inverse and re-tinted by the hour /
 * weather exactly as the dome is (tint.ts). So the 3D world dissolves INTO the painting, with no step at any angle.
 *
 * Density: clear to 30 m, then `1 − exp(−(d − 30) · 0.0032)` (thinner with the ray's mean height above the valley floor), plus
 * whatever the weather adds on top of the day's aerial density (a storm's rain closes it in), plus v1's valley height
 * haze. The cloud shadows (`pCloudShadow`, P_CLOUDS) stay in the pars chunk. Installed once, in the Game constructor
 * right after `installAtmosphere` (before anything compiles); the uniforms ride along `paintedAir`, which
 * `attachFogUniforms` hands to every fogged material.
 */
import * as THREE from 'three';
import { paintedAir } from '../../world/Atmosphere';
import { V2_TINT_GLSL, tintUniforms } from './tint';
import { ungrade } from './grade';
import { PANO_FOG_SRGB } from './panoramaData';
import { EDGE_ON } from '../../chunks/nalatiEdge';

/** the LUT: scene-linear (already un-graded), half float, RepeatWrapping on the azimuth */
export const fogLut = ((): THREE.DataTexture => {
  const n = PANO_FOG_SRGB.length / 3;
  const data = new Uint16Array(n * 4);
  const c = new THREE.Color();
  const y: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    c.setRGB(PANO_FOG_SRGB[i * 3] ?? 0.5, PANO_FOG_SRGB[i * 3 + 1] ?? 0.5, PANO_FOG_SRGB[i * 3 + 2] ?? 0.5, THREE.SRGBColorSpace);
    y[0] = c.r; y[1] = c.g; y[2] = c.b;
    ungrade(y);
    data[i * 4] = THREE.DataUtils.toHalfFloat(y[0]);
    data[i * 4 + 1] = THREE.DataUtils.toHalfFloat(y[1]);
    data[i * 4 + 2] = THREE.DataUtils.toHalfFloat(y[2]);
    data[i * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat, THREE.HalfFloatType);
  t.wrapS = THREE.RepeatWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  t.name = 'nalati-fog-lut';
  return t;
})();

/** x = density (1/m), y = clear distance (m), z = the valley floor's height (m, the height thinning's zero), w = the day's aerial density (the rig's fogDist above it thickens the v2 fog) */
export const fogV2 = { value: new THREE.Vector4(0.0032, 30, -10, 0.002) };
/**
 * N19 — the edge haze (the user: "make this far background transition super smooth and invisible"; the pick: blend the
 * painting). Where the slab ends the 3D land used to stop crisp, ~15 % fogged at 80 m, against the painting's far hills.
 * Now the ground within the last metres before the slab edge (and every ring / cloud past it) thickens into the same
 * panorama haze the dome's painted land dissolves into (sky.ts `uLandHaze`), so both sides of the seam are the one haze.
 * x = strength, y = where it starts (m from the slab centre, the larger of |x| |z|), z = where it is full, w = the view
 * distance it needs (ground near you stays clear: a player by the edge still sees his feet). `?horizonblend=0` = off.
 */
export const HORIZON_BLEND = new URLSearchParams(location.search).get('horizonblend') !== '0';
export const fogEdgeV2 = { value: new THREE.Vector4(HORIZON_BLEND ? 0.95 : 0, 170, 256, 20) };
// N23's Edge (the Look Lab, src/chunks/nalatiEdge.ts): the berm on the slab's last metres IS the skyline now — real
// ground, trees and rock, only as hazed as any ground that far away; the edge haze starts past the slab (the rings)
if (EDGE_ON) fogEdgeV2.value.set(HORIZON_BLEND ? 0.95 : 0, 251, 270, 20);

let installed = false;
export function installLookV2Fog(): void {
  if (installed) return;
  installed = true;
  Object.assign(paintedAir, { fogLutV2: { value: fogLut }, fogV2, fogEdgeV2 }, tintUniforms);
  THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment.replace('#endif', /* glsl */`
      uniform sampler2D fogLutV2;
      uniform vec4 fogV2;
      uniform vec4 fogEdgeV2;
      ${V2_TINT_GLSL}
    #endif`);
  THREE.ShaderChunk.fog_fragment = /* glsl */`
    #ifdef USE_FOG
      {
        vec3 ray = vFogWorldPos - cameraPosition;
        float rayLen = length( ray );
        vec3 viewDir = ray / max( rayLen, 1e-3 );
        float dens = fogV2.x + max( fogDistDensity - fogV2.w, 0.0 );
        // thinner with height: the ray's mean height above the valley floor (a view from above looks through clear air)
        float aer = max( rayLen - fogV2.y, 0.0 ) * dens * exp( - max( 0.5 * ( vFogWorldPos.y + cameraPosition.y ) - fogV2.z, 0.0 ) * 0.035 );
        // the valley's height haze, integrated along the ray (as v1)
        float dy = vFogWorldPos.y - cameraPosition.y;
        float camF = exp( - fogHeightFalloff * ( cameraPosition.y - fogHeight ) );
        float ht = fogHeightFalloff * dy;
        float integ = abs( ht ) > 1e-3 ? ( 1.0 - exp( - ht ) ) / ht : 1.0;
        float f = clamp( 1.0 - exp( - aer - fogHeightDensity * camF * integ * rayLen ), 0.0, 1.0 );
        // N19: the slab's edge dissolves into the haze the painting's land fades to (only seen from a distance)
        float edgeD = max( abs( vFogWorldPos.x ), abs( vFogWorldPos.z ) );
        float fe = fogEdgeV2.x * smoothstep( fogEdgeV2.y, fogEdgeV2.z, edgeD ) * smoothstep( fogEdgeV2.w, fogEdgeV2.w * 3.0, rayLen );
        f = 1.0 - ( 1.0 - f ) * ( 1.0 - fe );
        vec3 haze = v2Regrade( texture2D( fogLutV2, vec2( atan( - viewDir.x, viewDir.z ) * 0.15915494, 0.5 ) ).rgb );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, haze, f );
      }
    #endif`;
}
