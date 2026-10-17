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
import { headingTexture } from '@wildshard/engine/render/dataLook';
import { paintedAir } from './air';
import { V2_TINT_GLSL, tintUniforms } from './tint';
import { ungrade } from './grade';
import { PANO_FOG_SRGB } from './panoramaData';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { FOG_GLSL } from '../runtime/looks/fogGlsl';
import { fogUniforms } from '@wildshard/engine/world/Atmosphere';
import { hasLentLook, lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';

/** the GLSL below is trusted custom code (runtime/looks/fogGlsl.ts); `@{name}` splices the fragments this module passes */
const FOG_GLSL_FAMILY = new ShaderFamily(FOG_GLSL, {});

/** the LUT: scene-linear (already un-graded), half float, RepeatWrapping on the azimuth */
export const fogLut = headingTexture({ samples: PANO_FOG_SRGB, stride: 3, half: true, map: (y) => { ungrade(y); }, name: 'nalati-fog-lut' });

/** x = density (1/m), y = clear distance (m), z = the valley floor's height (m, the height thinning's zero), w = the day's aerial density (the rig's fogDist above it thickens the v2 fog) */
export const fogV2 = { value: new THREE.Vector4(0.0032, 30, -10, 0.002) };
/**
 * N19 — the edge haze (the user: "make this far background transition super smooth and invisible"; the pick: blend the
 * painting). Where the slab ends the 3D land used to stop crisp, ~15 % fogged at 80 m, against the painting's far hills.
 * Now the ground within the last metres before the slab edge (and every ring / cloud past it) thickens into the same
 * panorama haze the dome's painted land dissolves into (sky.ts `land`), so both sides of the seam are the one haze.
 * x = strength, y = where it starts (m from the slab centre, the larger of |x| |z|), z = where it is full, w = the view
 * distance it needs (ground near you stays clear: a player by the edge still sees his feet).
 *
 * N23's edge berm (src/shards/nalati-grasslands/edge.ts) on the slab's last metres IS the skyline now — real ground, trees and rock,
 * only as hazed as any ground that far away — so the edge haze starts past the slab (the rings): 251 → 270 m.
 */
export const fogEdgeV2 = { value: new THREE.Vector4(0.95, 251, 270, 20) };

let installed = false;
export function installLookV2Fog(): void {
  if (installed) return;
  installed = true;
  Object.assign(paintedAir, { fogLutV2: { value: fogLut }, fogV2, fogEdgeV2 }, tintUniforms);
  THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment.replace('#endif', FOG_GLSL_FAMILY.glsl(FOG_GLSL.fog_pars_tail, { V2_TINT_GLSL }));
  THREE.ShaderChunk.fog_fragment = FOG_GLSL_FAMILY.glsl(FOG_GLSL.fog_fragment);
}

/**
 * The same painted fog for the look graphs (O11): data/lookGraphs.json 'nalati-fog' is this module's fog as a `kind: 'fog'`
 * graph, and every graph look that selects it (`effectState.fog`: the grass, the water, the puddles) is fogged by it in the
 * engine's fog epilogue instead of the engine fog. Once a frame, after `updateTint`, its params take the live values the
 * chunk reads (the air, the tint, fogV2 / fogEdgeV2) and its LUT is lent once. Uniform writes only: no program changes.
 */
export const PAINTED_FOG = 'nalati-fog';
const air = [0, 0, 0, 0], v2 = [0, 0, 0, 0], edge = [0, 0, 0, 0], key = [0, 0, 0], light = [0, 0, 0], veil = [0, 0, 0];
/** the compiled fog the LUT was last lent to (a re-entered shard compiles a fresh one) */
let lutLent: THREE.Material | null = null;
export function syncPaintedFog(): void {
  if (!hasLentLook(PAINTED_FOG)) return;
  const carrier = lentLook(PAINTED_FOG);
  if (lutLent !== carrier) { setLentTexture(PAINTED_FOG, 'lut', fogLut); lutLent = carrier; }
  const f = fogUniforms, t = tintUniforms;
  air[0] = f.fogDistDensity.value; air[1] = f.fogHeightFalloff.value; air[2] = f.fogHeight.value; air[3] = f.fogHeightDensity.value;
  setLentParam(PAINTED_FOG, 'air', air);
  setLentParam(PAINTED_FOG, 'fogV2', fogV2.value.toArray(v2));
  setLentParam(PAINTED_FOG, 'fogEdge', fogEdgeV2.value.toArray(edge));
  setLentParam(PAINTED_FOG, 'keyTint', t.uV2KeyTint.value.toArray(key));
  setLentParam(PAINTED_FOG, 'light', t.uV2Light.value.toArray(light));
  setLentParam(PAINTED_FOG, 'veilColour', t.uV2VeilCol.value.toArray(veil));
  setLentParam(PAINTED_FOG, 'moon', t.uV2Moon.value);
  setLentParam(PAINTED_FOG, 'veil', t.uV2Veil.value);
  setLentParam(PAINTED_FOG, 'flash', t.uV2Flash.value);
}
