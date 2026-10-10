// Nine Dragon's banyan canopy as data (SHARD-PLATFORM M3, look-family rows): the foliage program's GLSL, its five program
// rows (painted cards under alpha to coverage, their plateau depth pass, real leaves, painted shells, the darker core), the
// lab's leaf ramp and dome B's night crown as uniform rows, and the leaf atlas, for the SDK card canopy
// (@wildshard/sdk/looks/cardCanopy) over the SDK shader family. world/canopy.ts dresses the crown; the organic lab's notes
// (the four ways to build the leaf mass, the winner) are there.
import type { ShaderProgramRow, UniformRows } from '@wildshard/sdk/looks/shaderFamily';
import { FOG_GLSL, NOISE_GLSL } from './look';

/** the vertex-stage subset of NOISE_GLSL that silkFog needs (the rest uses derivatives, fragment-only) */
const NOISE_VS = /* glsl */ `
float h12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y);
}
`;
export const CANOPY_VS = /* glsl */ `
attribute vec4 aUv;
attribute vec2 aTone;
attribute vec3 aSpill;
attribute vec4 aLump;
uniform float uPlate;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vUv;
varying vec2 vTone;
varying vec3 vSpill;
varying float vViewZ;
varying float vPlate;
varying vec4 vFog;
${NOISE_VS}
${FOG_GLSL}
invariant gl_Position;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
#ifndef DEPTH_ONLY
  // the silk fog per VERTEX: the crown is ~20 m across and the fog varies over tens of metres, and the cards overdraw
  // 2–4 layers deep, so the 9-band fog loop must not run per fragment (the phone's cost is the canopy's fill)
  vFog = silkFog(wp.xyz, 1.0);
#else
  vFog = vec4(0.0, 0.0, 0.0, 1.0);
#endif
  vN = normalize(mat3(modelMatrix) * normal);
  vUv = aUv;
  vTone = aTone;
  vSpill = aSpill;
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  // the silhouette plateau: every fragment of a lump (its cards, leaves, core) reports ONE depth, the lump's front,
  // so the post inks the clump's outline and the step to the next clump, not every card edge and pin-hole
  vec4 lc = viewMatrix * modelMatrix * vec4(aLump.xyz, 1.0);
  vPlate = aLump.w > 0.0 ? mix(-vp.z, max(-lc.z - aLump.w * 0.85, 0.2), uPlate) : -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;
export const CANOPY_FS = /* glsl */ `
uniform float uTime;
uniform float uNear;
uniform float uSutra;
uniform float uDpr;
uniform vec3 uLightDir;
uniform vec3 uInk0;
uniform vec3 uInk1;
uniform float uInkMid;
uniform vec2 uLineFade;
uniform vec3 uGold;
uniform vec3 uPaper;
uniform vec3 uLeaf[5];
uniform vec4 uWash;    // x: band contrast, y: inner darkening, z: per-cluster tone spread, w: painted value weight
uniform vec4 uLeafInk; // x: outline px (at 3×), y: outline strength, z: midrib strength, w: sky rim light
uniform sampler2D uAtlas;
varying vec3 vWorld;
varying vec3 vN;
varying vec4 vUv;
varying vec2 vTone;
varying vec3 vSpill;
varying float vViewZ;
varying float vPlate;
varying vec4 vFog;
uniform vec3 uCam;
${NOISE_GLSL}
vec3 ramp(float v) {
  v = clamp(v, 0.0, 1.0) * 4.0;
  float i = floor(v), f = v - i;
  vec3 a = uLeaf[0], b = uLeaf[1];
  if (i >= 3.0) { a = uLeaf[3]; b = uLeaf[4]; } else if (i >= 2.0) { a = uLeaf[2]; b = uLeaf[3]; } else if (i >= 1.0) { a = uLeaf[1]; b = uLeaf[2]; }
  // painted washes: flat steps with a narrow soft edge, not a gradient
  return mix(a, b, smoothstep(0.35, 0.65, f));
}
void main() {
#ifdef DEPTH_ONLY
  gl_FragColor = vec4(0.0, 0.0, 0.0, uNear / max(vPlate, uNear));
  return;
#else
  vec3 n = normalize(vN);
  vec3 V = normalize(uCam - vWorld);
  float dist = length(uCam - vWorld);
  float ndl = dot(n, uLightDir);
  // three hard washes: the belly, the body, the lit top (the sky screens light the crown from above)
  float band = smoothstep(-0.34, -0.26, ndl) * 0.5 + smoothstep(0.3, 0.38, ndl) * 0.5;
  float v = 0.06 + band * uWash.x - vTone.y * uWash.y + (vTone.x - 0.5) * uWash.z;
  float ink = 0.0;
  float a = 1.0;
#ifdef CARD
  vec4 tx = texture2D(uAtlas, vUv.xy);
  float L = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));
  // the painted leaves keep their own light / dark and their ink; the hue is ours
  v += (smoothstep(0.18, 0.62, L) - 0.4) * uWash.w;
  ink = (1.0 - smoothstep(0.07, 0.2, L)) * uLeafInk.y;
  // alpha to coverage, sharpened to a crisp leaf edge at any mip (the MSAA resolve antialiases it)
  // (mip-level coverage kept: the mips average the clear gaps in, so a far cluster would thin out and vanish)
  vec2 tsz = vec2(textureSize(uAtlas, 0));
  vec2 dx = dFdx(vUv.xy * tsz), dy = dFdy(vUv.xy * tsz);
  float mip = 0.5 * log2(max(max(dot(dx, dx), dot(dy, dy)), 1e-8));
  float ta = tx.a * (1.0 + max(mip, 0.0) * 0.25);
  a = clamp((ta - 0.5) / max(fwidth(ta), 1e-4) + 0.5, 0.0, 1.0);
#endif
#ifdef LEAF
  // the leaf's outline from its rim distance (aUv.z: 1 at the centre, 0 on the rim), a thin midrib
  float px = uLeafInk.x * uDpr;
  float fr = max(fwidth(vUv.z), 1e-5);
  float big = smoothstep(0.02, 0.2, 1.0 / (fr * 12.0));   // outlines only while the leaf is ≥ ~12 px
  ink = clamp(px * 0.5 + 0.5 - vUv.z / fr, 0.0, 1.0) * uLeafInk.y * big;
  float fs = max(fwidth(vUv.x), 1e-5);
  ink = max(ink, clamp(0.5 - abs(vUv.x) / fs, 0.0, 1.0) * step(0.08, vUv.y) * step(vUv.y, 0.85) * uLeafInk.z * big);
  v += (vTone.x - 0.5) * 0.15;
#endif
#ifdef SHELL
  // gongbi leaves painted on the shell: a Voronoi of leaves, each outlined and tinted (the K.leaf pattern, finer)
  vec3 an = abs(n);
  vec2 lp = (an.y > max(an.x, an.z) ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy)) / 0.2;
  vec2 cc = floor(lp), fc = fract(lp);
  float d1 = 9.0, d2 = 9.0, idv = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 o = vec2(float(i), float(j));
      vec2 rr = o + vec2(h12(cc + o), h12(cc + o + 17.3)) - fc;
      float dd = dot(rr, rr);
      if (dd < d1) { d2 = d1; d1 = dd; idv = h12(cc + o + 3.1); } else if (dd < d2) { d2 = dd; }
    }
  }
  float flw = max(fwidth(lp.x), fwidth(lp.y)) * 0.2;
  float det = smoothstep(2.5, 6.0, 0.2 / flw);
  float ed = (sqrt(d2) - sqrt(d1)) * 0.5 * 0.2;
  ink = clamp(uLeafInk.x * uDpr * 0.3 + 0.5 - ed / flw, 0.0, 1.0) * det * uLeafInk.y * 0.7;
  v += (idv - 0.5) * 0.35 * det;
#endif
#ifdef INNER
  v = 0.14 + band * 0.22 - vTone.y * 0.12;
#endif
  vec3 col = ramp(v);
  // light through the crown's edge: a cool sky rim where the lump turns away from the eye on its upper side
  float rim = pow(1.0 - clamp(abs(dot(n, V)), 0.0, 1.0), 3.0) * smoothstep(-0.1, 0.5, n.y) * (1.0 - vTone.y);
  col += uLeaf[4] * rim * uLeafInk.w;
  // warm lantern / neon spill, baked per vertex like the kits
  col += col * vSpill * 1.6;
  vec3 inkC = mix(uInk0, uInk1, smoothstep(4.0, uInkMid, dist));
  inkC = mix(inkC, uGold, uSutra);
  float fade = 1.0 - smoothstep(uLineFade.x, uLineFade.y, dist);
  col = mix(col, uPaper * (0.5 + v * 0.7), uSutra * 0.8);
  vec4 fg = vFog;
  col = mix(col, inkC, ink * fade * pow(max(fg.a, 1e-4), 0.7));
#ifdef CARD
  // alpha = coverage (a2c); the blend keeps the target's alpha, the depth pass writes the plateau after
  gl_FragColor = vec4(col * fg.a + fg.rgb, a);
#else
  // alpha = inverse view depth (the post silhouette reads it), the lump's plateau
  gl_FragColor = vec4(col * fg.a + fg.rgb, uNear / max(vPlate, uNear));
#endif
#endif
}
`;

export type FoliageMode = 'cards' | 'cards-depth' | 'leaves' | 'shells' | 'inner';

/**
 * One program, five modes. 'cards' is alpha-to-coverage with the target's alpha KEPT (the card canopy's coverage pass);
 * 'cards-depth' re-draws the same cards depth-EQUAL writing only alpha = near / viewZ (the post silhouette's inverse
 * depth, its plateau pass), so it must render right after 'cards'. Everything else is plain opaque.
 */
export const FOLIAGE_PROGRAMS: Readonly<Record<FoliageMode, ShaderProgramRow>> = {
  cards: { vertex: CANOPY_VS, fragment: CANOPY_FS, defines: { CARD: '' }, side: 'double' },
  'cards-depth': { vertex: CANOPY_VS, fragment: CANOPY_FS, defines: { DEPTH_ONLY: '' }, side: 'double' },
  leaves: { vertex: CANOPY_VS, fragment: CANOPY_FS, defines: { LEAF: '' }, side: 'double' },
  shells: { vertex: CANOPY_VS, fragment: CANOPY_FS, defines: { SHELL: '' }, side: 'front' },
  inner: { vertex: CANOPY_VS, fragment: CANOPY_FS, defines: { INNER: '' }, side: 'front' },
};

/** the gongbi banyan greens (display sRGB), sampled from the targets' canopy (k-means of style A's crown) */
export const LEAF_PALETTE = [0x131d19, 0x20322a, 0x31483c, 0x566a4d, 0xa4a674] as const;

/** the lab's foliage uniforms: the ramp; the wash (x: band contrast, y: inner darkening, z: per-cluster tone spread, w:
 *  painted value weight); the leaf ink (x: outline px at 3×, y: outline strength, z: midrib strength, w: sky rim light);
 *  the plateau */
export const FOLIAGE_UNIFORMS = {
  uLeaf: { rgbs: [...LEAF_PALETTE] }, uWash: { v4: [0.32, 0.45, 0.26, 1.0] }, uLeafInk: { v4: [1.6, 0.9, 0.5, 0.35] }, uPlate: 1,
} as const satisfies UniformRows;

/** dome B's ramp (display sRGB), darker than the lab's LEAF_PALETTE */
export const DOME_B_LEAVES = [0x0c1310, 0x142019, 0x1e2e25, 0x2d3d31, 0x3f4e38] as const;

/** dome B's night crown (ΔE vs its targets: the lab's palette read #4c5742 against #343b32, the lit tops khaki from
 *  above): the ramp a step darker and less yellow, the lit band narrower, the sky rim down (from above every card edge
 *  caught it and the crown went pale) */
export const DOME_B_CROWN = {
  uLeaf: { rgbs: [...DOME_B_LEAVES] }, uWash: { v4: [0.18, 0.45, 0.26, 1.0] }, uLeafInk: { v4: [1.6, 0.9, 0.5, 0.15] }, uPlate: 1,
} as const satisfies UniformRows;

/** the painted leaf atlas (the codex gongbi 2×2 sheet) */
export const LEAF_ATLAS = '/assets/nine-dragon/lab/organic/leaf-atlas.webp';
