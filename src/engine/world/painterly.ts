/**
 * World-material compatibility on the shared painterly family. The family's data-driven material owns cel bands,
 * painted shade, warm terminator, rim, wetness and sway; this adapter keeps the existing world/kit handles and sky
 * registration. There is no second shader implementation here. `painterlyUniforms` aliases the family's live values;
 * its sun reference and direction also feed drawing systems outside the material. `painterlyKnobs` aliases the defining
 * surface's knobs, so existing model clones and live tuning keep uniform identity.
 */
import * as THREE from 'three';
import { attachFogUniforms } from './Atmosphere';
import type { SkyRig as Sky } from './skyRig';
import { PATCH_ORDER, patchShader } from '../render/shaderPatches';
import { compilePainterly, PainterlyLook as MaterialLook, type PainterlyMaterialUniforms } from '../render/families/painterly';
import { PainterlyMaterialSchema } from '@wildshard/format/materialFamilies';
import * as v from 'valibot';

export interface PainterlyOpts {
  color?: THREE.ColorRepresentation;
  vertexColors?: boolean;
  rim?: number;
  bands?: number;
  shade?: number;
  sway?: number;
  emissive?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  depthWrite?: boolean;
  alphaTest?: number;
}

export interface PainterlyLook {
  /** the colour painted into the shadow side (linear RGB, added × albedo where the sun doesn't reach) */
  shadeTint?: THREE.ColorRepresentation;
  /** rim light colour (linear, HDR allowed) */
  rimColor?: THREE.ColorRepresentation;
  /** world wind direction (x, z) and strength multiplier for `sway` */
  wind?: { x: number; z: number; strength: number };
}

/** Compatibility handles on the shared family look; the shader lives in render/families/painterly. */
const worldLook = new MaterialLook({ grade: null });
export const painterlyUniforms = {
  uPSunRef: { value: new THREE.Color(3, 3, 3) },
  uPSunDir: { value: new THREE.Vector3(0.5, 0.5, 0.5).normalize() },
  uPShade: worldLook.uniforms.famPaintShade, uPRimColor: worldLook.uniforms.famPaintRimColour,
  uPTime: worldLook.uniforms.famPaintTime, uPWind: worldLook.uniforms.famPaintWind,
  uPWarm: worldLook.uniforms.famPaintWarm, uPFloor: worldLook.uniforms.famPaintFloor, uPWet: worldLook.uniforms.famPaintWet,
};

// live tuning / the parity harness: `window.__painterly.uPWet.value = 1`
if (typeof window !== 'undefined') Object.assign(window, { __painterly: painterlyUniforms });

/** Advance the shared clock that drives `sway`. */
export function updatePainterly(dt: number): void { painterlyUniforms.uPTime.value += dt; }

export function setPainterlyLook(look: PainterlyLook): void {
  if (look.shadeTint !== undefined) painterlyUniforms.uPShade.value.set(look.shadeTint);
  if (look.rimColor !== undefined) painterlyUniforms.uPRimColor.value.set(look.rimColor);
  if (look.wind) {
    const l = Math.hypot(look.wind.x, look.wind.z) || 1;
    painterlyUniforms.uPWind.value.set(look.wind.x / l, look.wind.z / l, look.wind.strength);
  }
}

/**
 * Read the sun off the sky rig into the shared uniforms (CSM lights all share the sun's colour and intensity).
 * `painterlyMaterial(sky, …)` does it; call it yourself after building materials with `sky = null`.
 */
export function syncPainterlySun(sky: Sky): void {
  const l = sky.csm.lights[0];
  if (l) painterlyUniforms.uPSunRef.value.copy(l.color).multiplyScalar(l.intensity);
  painterlyUniforms.uPSunDir.value.copy(sky.sunDir).normalize();
}

/** Legacy view bindings borrow the defining family's surface uniforms. */
export interface PainterlyKnobs { uPRim: { value: number }; uPBands: { value: number }; uPShadeAmt: { value: number }; uPSway: { value: number }; uPFloorAmt: { value: number } }
const knobs = new WeakMap<THREE.Material, PainterlyKnobs>();
export function painterlyKnobs(mat: THREE.Material): PainterlyKnobs | undefined { return knobs.get(mat); }

/** Compatibility constructor on the data-driven painterly family, including its single shared program. */
export function painterlyMaterial(sky: Sky | null, opts: PainterlyOpts = {}): THREE.MeshLambertMaterial {
  if (sky) syncPainterlySun(sky);
  const mat = compilePainterly(v.parse(PainterlyMaterialSchema, { family: 'painterly', vertexColours: true,
    rim: opts.rim ?? 0.35, bands: opts.bands ?? 0.8, shade: opts.shade ?? 1, sway: opts.sway ?? 0,
    map: opts.map ? 'surface' : null, doubleSided: opts.side === THREE.DoubleSide, alphaCutoff: opts.alphaTest ?? 0,
  }), worldLook, () => { if (!opts.map) throw new Error('Painterly surface map is missing'); return opts.map; });
  mat.color.set(opts.color ?? 0xffffff); mat.emissive.set(opts.emissive ?? 0x000000);
  mat.side = opts.side ?? THREE.FrontSide; mat.transparent = opts.transparent ?? false;
  mat.opacity = opts.opacity ?? 1; mat.depthWrite = opts.depthWrite ?? true;
  const family = mat.userData['familyUniforms'] as PainterlyMaterialUniforms;
  const own = { uPRim: family.famPaintRim, uPBands: family.famPaintBands, uPShadeAmt: family.famPaintShadeAmt,
    uPSway: family.famPaintSway, uPFloorAmt: family.famPaintFloorAmt };
  mat.userData['painterly'] = own; knobs.set(mat, own);
  patchShader(mat, 'engine.painterly.air', PATCH_ORDER.decorate, shader => { attachFogUniforms(shader); });
  sky?.setupMaterial(mat);
  return mat;
}

/** The colour setter shared by the painterly modules: paint a whole geometry one colour (× jitter per vertex, seeded). */
export function paintGeometry(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation, jitter = 0, seed = 1): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = geo.getAttribute('position').count;
  const out = new Float32Array(n * 3);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const k = 1 - jitter + (s / 4294967296) * jitter * 2;
    out[i * 3] = c.r * k; out[i * 3 + 1] = c.g * k; out[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return geo;
}
