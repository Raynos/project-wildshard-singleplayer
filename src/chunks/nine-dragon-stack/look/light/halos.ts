// (render, E281) Light halos in the rain: the phone's glow. The phone tier draws no bleed pyramid (render.ts: the three
// custom passes and their half-float targets are off on the phone), so its lanterns, lamps, lit shops and neon had no
// glow at all — against the blue-hour targets, where every light hangs in a soft warm (or neon) halo of lit drizzle.
// One instanced additive draw of soft camera-facing discs, one per light (the light volume's sources, lit windows
// excluded), no texture, no render target: the disc's colour and its fog transmittance are worked out per corner in the
// vertex stage, the fragment is a gaussian. A disc is pulled toward the eye by its radius so the wall a lantern hangs
// on does not slice it, fades out close to the eye (walking under a lantern never fills the screen), its screen size
// is capped (the fill cost), and a disc too dim to see is collapsed before rasterising.
import { Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, ShaderMaterial, Uint16BufferAttribute, Vector4 } from 'three';
import { ADD_KEEP_ALPHA, EMIT_FOG, FOG_GLSL, type Shared } from '../style';
import { type EmitterLike, isLamp } from './pools';

/** per source kind: the disc's radius (m; signs: + a share of the board's size) and its gain */
export const HALO = {
  // (round 2 fix: the Well's new lantern rows under ×3 halos read as dozens of soft orange bokeh blobs) a lantern's glow is
  // tight: ~2× its own radius (the body's R 0.27 m at scale 1), not a 1.3 m soft disc
  lantern: { r: 0.5, k: 0.16 },
  lamp: { r: 1.6, k: 0.3 },
  shop: { r: 0.0, rPerW: 0.45, rMin: 1.2, rMax: 2.6, k: 0.07 },
  sign: { r: 0.5, rPerSize: 0.45, k: 0.1 },
} as const;

export interface HaloSources { lanterns: readonly EmitterLike[]; shops: readonly EmitterLike[]; signs: readonly EmitterLike[] }

/** the knobs: x gain, y radius scale, z the near fade's end (m), w the screen-size cap (share of the view's height) */
export const HALO_DEFAULTS = new Vector4(2, 1.2, 5, 0.12);
/** (E281) the gain per kind: lanterns, lamps, shops, signs */
export const HALO_KIND = new Vector4(3, 1, 2, 1);
/** (round 2 fix) the distance fade: from x to y m the glow goes to z of its gain and w of its radius */
export const HALO_FAR = new Vector4(12, 28, 0.12, 0.5);

const NOISE_VS = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;

const VS = /* glsl */ `
attribute vec2 aCorner;
attribute vec3 aAt;
attribute vec4 aCol;
attribute float aR;
uniform vec4 uHalo;
uniform vec4 uHaloKind;
uniform vec4 uHaloFar;
${NOISE_VS}
${FOG_GLSL}
varying vec2 vC;
varying vec3 vCol;
void main() {
  vec3 toEye = uCam - aAt;
  float d = length(toEye);
  // with distance the glow shrinks and dims (uHaloFar: from x to y m, to z of its gain and w of its radius): past ~25 m
  // a lantern is its own bright point with at most a faint rim
  float far = smoothstep(uHaloFar.x, uHaloFar.y, length(uCam - aAt));
  float R = aR * uHalo.y * mix(1.0, uHaloFar.w, far);
  // pulled toward the eye by its radius: the wall behind a lantern does not cut the disc
  vec3 c = aAt + toEye / max(d, 1e-3) * min(R, d * 0.5);
  vec4 mv = viewMatrix * vec4(c, 1.0);
  // the screen-size cap: R never spans more than uHalo.w of the view's height (projectionMatrix[1][1] = 1 / tan(fov/2))
  float cap = uHalo.w * 2.0 * max(-mv.z, 0.01) / projectionMatrix[1][1];
  float Rs = min(R, cap);
  mv.xy += aCorner * Rs;
  vC = aCorner;
  float T = silkFog(aAt, 1.0).a;
  // a capped disc keeps its energy per pixel, not its total: a close lantern glows as hard, just not as wide
  // (E281) a gain per kind (aCol.w: 0 lantern, 1 lamp, 2 shop, 3 sign): the lanterns read as lit red globes at 20–40 m
  float kg = aCol.w < 0.5 ? uHaloKind.x : aCol.w < 1.5 ? uHaloKind.y : aCol.w < 2.5 ? uHaloKind.z : uHaloKind.w;
  vCol = aCol.rgb * kg * uHalo.x * mix(1.0, uHaloFar.z, far) * pow(max(T, 1e-4), ${EMIT_FOG}) * smoothstep(1.2, uHalo.z, d) * step(0.0, -mv.z);
  gl_Position = projectionMatrix * mv;
  if (max(vCol.r, max(vCol.g, vCol.b)) < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const FS = /* glsl */ `
varying vec2 vC;
varying vec3 vCol;
void main() {
  float r2 = dot(vC, vC);
  if (r2 >= 1.0) discard;
  // a tight core over a short skirt, zero at the rim
  float a = (exp(-r2 * 9.0) * 0.7 + exp(-r2 * 3.5) * 0.3) * (1.0 - r2);
  gl_FragColor = vec4(vCol * a, 0.0);
}
`;

export interface Halos { mesh: Mesh<InstancedBufferGeometry, ShaderMaterial>; knobs: Vector4 }

export function buildHalos(shared: Shared, src: HaloSources): Halos {
  const at: number[] = [], col: number[] = [], rad: number[] = [];
  const push = (e: EmitterLike, r: number, k: number, pull = 0, kind = 0): void => {
    at.push(e.at.x, e.at.y, e.at.z);
    // a lantern's paper glows orange-red, a sign its own neon, a shop amber: the halo is the light's colour, not the
    // emitter's saturated body colour pulled to white
    col.push(e.color.r * k, (e.color.g + pull) * k, e.color.b * k, kind);
    rad.push(r);
  };
  for (const e of src.lanterns) push(e, HALO.lantern.r * (e.w / 0.5), HALO.lantern.k, 0.18);
  for (const e of src.shops) {
    if (isLamp(e)) { push(e, HALO.lamp.r, HALO.lamp.k, 0, 1); continue; }
    push(e, Math.min(Math.max(HALO.shop.rPerW * e.w, HALO.shop.rMin), HALO.shop.rMax), HALO.shop.k * Math.min(Math.max(e.spill / 0.3, 0.5), 1.5), 0, 2);
  }
  for (const e of src.signs) {
    if (e.power <= 0) continue;
    push(e, HALO.sign.r + HALO.sign.rPerSize * Math.max(e.w, e.h), HALO.sign.k * Math.min(e.power, 1.5), 0, 3);
  }
  const n = rad.length;
  const g = new InstancedBufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(new Float32Array(12), 3));
  g.setAttribute('aCorner', new Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  g.setIndex(new Uint16BufferAttribute([0, 1, 2, 0, 2, 3], 1));
  g.setAttribute('aAt', new InstancedBufferAttribute(new Float32Array(at), 3));
  g.setAttribute('aCol', new InstancedBufferAttribute(new Float32Array(col), 4));
  g.setAttribute('aR', new InstancedBufferAttribute(new Float32Array(rad), 1));
  g.instanceCount = n;
  const knobs = HALO_DEFAULTS.clone();
  const mat = new ShaderMaterial({
    uniforms: { ...shared.u, uHalo: { value: knobs }, uHaloKind: { value: HALO_KIND.clone() }, uHaloFar: { value: HALO_FAR.clone() } },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthWrite: false,
    ...ADD_KEEP_ALPHA,
  });
  const mesh = new Mesh(g, mat);
  mesh.name = 'halos';
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  return { mesh, knobs };
}
