// Nine Dragon's viewmodel look as data (SHARD-PLATFORM M3): the material classes, the class palette, the toon program's
// and the ink hull's GLSL and the program's tuning as uniform rows. vm/materials.ts draws the decal atlas and makes the
// materials; the comment at its head describes the look.
import type { UniformRows } from '@wildshard/sdk/looks/shaderFamily';

/** the material classes (aMat.x); materials.ts paints by class, a GLB names them by its material names */
export const CLS = {
  brass: 1, brassDark: 2, steel: 3, lacquer: 4, leather: 5, glove: 6, cloth: 7, sleeve: 8, trim: 9, silk: 10, carbon: 11,
  glow: 12, gold: 13, paper: 14, bevel: 15, skin: 16,
} as const;

/** the class palette (sRGB hex), index = CLS value; tuned against round-6 style A / target-1 */
export const PALETTE: Readonly<Record<number, number>> = {
  0: 0x808080,
  [CLS.brass]: 0xa8834a,
  [CLS.brassDark]: 0x6f5427,
  [CLS.steel]: 0x13161c,
  [CLS.lacquer]: 0x131418,
  [CLS.leather]: 0x25201f,
  [CLS.glove]: 0x332d2b,
  [CLS.cloth]: 0xd9c6a4,
  [CLS.sleeve]: 0x262b3a,
  [CLS.trim]: 0xa3261b,
  [CLS.silk]: 0xc42e1f,
  [CLS.carbon]: 0x18191e,
  [CLS.glow]: 0xd9fbff,
  [CLS.gold]: 0xd6a84c,
  [CLS.paper]: 0xffffff,
  [CLS.bevel]: 0x262c36,
  [CLS.skin]: 0xc99a7c,
};
export const NPAL = 17;

/** the palette as the program's colour array (index = class; a missing class is grey) */
export const VM_PAL: readonly number[] = Array.from({ length: NPAL }, (_, i) => PALETTE[i] ?? 0x808080);

/** the program's tuning (the textures, decal cells and live values are the shard's) */
export const VM_UNIFORMS = {
  uPal: { rgbs: VM_PAL },
  uKey: { v3: [-0.55, 0.8, 0.22], normalize: true },
  uInk: { rgb: 0x111214 },
  uLinePx: 1.6,
  uSutra: 0,
  uGold: { rgb: 0xc9a24a },
  uEnvHi: { rgb: 0x8fa4c4 },
  uEnvLo: { rgb: 0xb0584e },
  uBladeA: { v3: [0, 0, 0] },
  uBladeB: { v3: [0, 0, -1] },
  uSpill: { v4: [0.55, 0.95, 1.0, 0.9] },
  uTune: { v4: [0.8, 1.0, 0.85, 0.22] },
  uExposure: 1,
  uDetail: 1.8,
  uRes: { v2: [1, 1] },
  uHullPx: 2.6,
  uTime: 0,
} as const satisfies UniformRows;

/** the viewmodel program's vertex source */
export const VM_VS = /* glsl */ `
attribute vec4 aMat;
attribute vec4 aFace;
attribute vec3 aNs;
uniform mat3 uAssetRot;
varying vec3 vN;
varying vec3 vNs;
varying vec3 vView;
varying vec3 vMaps;
varying vec2 vUv;
varying vec4 vFace;
flat varying vec4 vMat;
varying vec3 vOX;
varying vec3 vOY;
varying vec3 vOZ;
varying vec3 vObj;
#include <skinning_pars_vertex>
void main() {
  vObj = position;
  vec3 objectNormal = normal;
  vec3 ns = aNs;
  // the object-space normal map's axes: the asset's own frame -> this mesh's (bind) space -> skinned -> view
  vec3 ax = uAssetRot * vec3(1.0, 0.0, 0.0), ay = uAssetRot * vec3(0.0, 1.0, 0.0), az = uAssetRot * vec3(0.0, 0.0, 1.0);
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vec3 transformed = position;
  #include <skinning_vertex>
  #ifdef USE_SKINNING
    ns = (skinMatrix * vec4(ns, 0.0)).xyz;
    ax = (skinMatrix * vec4(ax, 0.0)).xyz;
    ay = (skinMatrix * vec4(ay, 0.0)).xyz;
    az = (skinMatrix * vec4(az, 0.0)).xyz;
  #endif
  vec4 mv = modelViewMatrix * vec4(transformed, 1.0);
  vView = mv.xyz;
  vN = normalize(normalMatrix * objectNormal);
  vNs = normalize(normalMatrix * ns);
  vOX = normalMatrix * ax;
  vOY = normalMatrix * ay;
  vOZ = normalMatrix * az;
  vMaps = color;
  vUv = uv;
  vFace = aFace;
  vMat = aMat;
  gl_Position = projectionMatrix * mv;
}
`;

/** the viewmodel program's fragment source: shading by class */
export const VM_FS = /* glsl */ `
uniform vec3 uPal[${NPAL}];
uniform sampler2D uSilk;
uniform sampler2D uDecal;
uniform sampler2D uMapsTex;
uniform sampler2D uNrmTex;
uniform float uTexOn;
uniform vec4 uEtch;
uniform vec4 uFu;
uniform vec3 uKey;
uniform vec3 uInk;
uniform float uLinePx;
uniform float uSutra;
uniform vec3 uGold;
uniform vec3 uEnvHi;
uniform vec3 uEnvLo;
uniform vec3 uBladeA;
uniform vec3 uBladeB;
uniform vec4 uSpill;
uniform vec4 uTune;   // x crease ink, y edge wear, z AO strength, w env tint
uniform float uExposure;
uniform float uDetail;
varying vec3 vN;
varying vec3 vNs;
varying vec3 vView;
varying vec3 vMaps;
varying vec2 vUv;
varying vec4 vFace;
flat varying vec4 vMat;
varying vec3 vOX;
varying vec3 vOY;
varying vec3 vOZ;
varying vec3 vObj;
float h31(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn3(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float lineAt(float d, float fw, float w) { float px = d / max(fw, 1e-6); float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - px, 0.0, 1.0) * min(w, 1.0); }
float band(float x, float e) { float w = max(fwidth(x), 1e-4) * 0.75; return smoothstep(e - w, e + w, x); }
void main() {
  int ci = int(floor(vMat.x + 0.5));
  float cls = float(ci);
  vec3 n = normalize(vN);
  vec3 nm = normalize(vNs);
  vec3 maps = vMaps;
  if (uTexOn > 0.5) {
    maps = texture2D(uMapsTex, vUv).rgb;
    vec3 nb = texture2D(uNrmTex, vUv).rgb * 2.0 - 1.0;
    // Blender object axes → glTF / three local (x, z, -y) → view
    vec3 nl = vec3(nb.x, nb.z, -nb.y);
    vec3 nv = vOX * nl.x + vOY * nl.y + vOZ * nl.z;
    // a baked normal that disagrees wildly with the surface is a bake miss (contacts, tiny caps): keep the surface's
    if (dot(nv, nv) > 0.01) {
      nv = normalize(nv);
      float agree = dot(nv, n);
      n = normalize(mix(n, nv, 0.8 * smoothstep(0.2, 0.55, agree)));
    }
  }
  if (!gl_FrontFacing) { n = -n; nm = -nm; }
  float ao = maps.r, curv = maps.g, det = maps.b;
  vec3 V = normalize(-vView);
  vec3 base = uPal[ci] * clamp(1.0 + (det - 0.5) * uDetail, 0.35, 1.6);
  // big value shapes from the macro normal, glints / rims / ink from the detail normal
  float ndl = dot(nm, uKey);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  vec3 R = reflect(-V, n);
  vec3 Hk = normalize(uKey + vec3(0.1, 0.25, 0.3));
  float lit = band(ndl, 0.06);
  float half1 = band(ndl, -0.32);
  float aoK = mix(1.0, ao, uTune.z);
  float wear = smoothstep(0.62, 0.86, curv) * uTune.y;
  float crease = smoothstep(0.3, 0.1, curv) * uTune.x;
  float env = smoothstep(-0.35, 0.45, R.y);
  vec3 envC = mix(uEnvLo, uEnvHi, env);
  vec3 col;
  bool metal = ci == ${CLS.brass} || ci == ${CLS.brassDark} || ci == ${CLS.gold};
  if (metal) {
    // the painter's three values from the macro normal; AO sinks the crevices, harder on the shadow side
    vec3 shadowC = base * vec3(0.2, 0.13, 0.08);
    vec3 midC = base * vec3(0.6, 0.48, 0.34);
    vec3 lightC = base * 1.1;
    float v1 = band(ndl, -0.22), v2 = band(ndl, 0.32);
    col = mix(shadowC, midC, v1);
    col = mix(col, lightC, v2);
    col *= mix(mix(0.2, 0.42, v2), 1.0, aoK);
    // glints from the detail normal, only where lit: sparse and sharp
    float spec = pow(max(dot(R, Hk), 0.0), 48.0);
    col = mix(col, vec3(1.18, 1.02, 0.72), band(spec, 0.8) * v1);
    // raised ridges of the engraving catch light
    col = mix(col, base * 1.3 + 0.015, wear * 0.35 * v1);
    // (E283, Jake's pick: the lighter viewmodel) the brushed grain's 3D noise is gone: its mean (× 1.0)
    col = mix(col, col * envC * 1.8, uTune.w);
    col += base * 0.3 * band(rim * max(n.y, 0.0), 0.25);
  } else if (ci == ${CLS.steel} || ci == ${CLS.bevel}) {
    float along = vFace.y / max(vFace.w, 1e-4);
    col = mix(base * 0.6, base, half1);
    col = mix(col, base * 1.18, lit);
    // the sky screens slide along the flat: one long cool band, one faint warm one from the street
    float sky = smoothstep(0.78, 0.97, dot(R, normalize(vec3(-0.25, 0.85, 0.45))));
    float street = smoothstep(0.6, 0.92, dot(R, normalize(vec3(0.3, -0.7, 0.6))));
    col = mix(col, vec3(0.3, 0.36, 0.46), sky * 0.5);
    col += vec3(0.22, 0.08, 0.1) * street * 0.5;
    if (ci == ${CLS.bevel}) col = mix(col, vec3(0.45, 0.66, 0.74), 0.12 + 0.3 * sky);
    col *= 0.9 + 0.12 * along;
    if (vMat.z < -0.5) {
      // etched flat: the decal strip along the blade (u = across the flat, v = root → tip)
      vec2 uv = vec2(mix(uEtch.x, uEtch.z, vUv.y), mix(uEtch.y, uEtch.w, vUv.x));
      float e = texture2D(uDecal, uv).r * (1.0 - smoothstep(0.8, 0.97, vUv.y));
      col = mix(col, vec3(0.42, 0.5, 0.58) + sky * 0.2, e * 0.42);
    }
  } else if (ci == ${CLS.lacquer}) {
    col = mix(base * 0.8, base * 1.9 + 0.012, lit);
    float spec = pow(max(dot(R, Hk), 0.0), 40.0);
    col = mix(col, vec3(0.66, 0.68, 0.74), band(spec, 0.5) * 0.85);
    col += envC * 0.05 * rim;
    col *= mix(0.4, 1.0, aoK);
  } else if (ci == ${CLS.glow}) {
    col = base;
  } else if (ci == ${CLS.paper}) {
    vec2 uv = vec2(mix(uFu.x, uFu.z, vUv.x), mix(uFu.y, uFu.w, vUv.y));
    vec3 t = texture2D(uDecal, uv).rgb;
    col = t * mix(0.62, 1.0, band(abs(ndl), 0.12));
    col += t * 0.15 * rim;
  } else {
    // matte: 3 hard bands, never black, a painter's rim
    float l = mix(0.46, 0.72, band(ndl, -0.28));
    l = mix(l, 1.0, band(ndl, 0.24));
    col = base * l;
    if (ci == ${CLS.glove} || ci == ${CLS.leather}) {
      // leather: a soft sheen band and a cool wet rim (codex's edits light the knuckles and the finger backs)
      // (E283, Jake's pick: the lighter viewmodel) the pebbling's two octaves of 3D noise at their mean: the colour × 1.0
      // and the sheen × 0.9
      float spec = pow(max(dot(R, Hk), 0.0), 10.0);
      col += vec3(0.44, 0.44, 0.46) * smoothstep(0.1, 0.9, spec) * 0.1 * 0.9;
      col += envC * 0.1 * rim;
    } else if (ci == ${CLS.silk} || ci == ${CLS.trim}) {
      col += base * 0.4 * band(rim, 0.35) * band(ndl, -0.05);
    } else if (ci == ${CLS.cloth} || ci == ${CLS.sleeve}) {
      // linen (E283, Jake's pick: the lighter viewmodel): the thread fleck and the tonal drift at their means (× 0.98, × 1.0)
      col *= 0.98;
    } else if (ci == ${CLS.carbon}) {
      float spec = pow(max(dot(R, Hk), 0.0), 30.0);
      col += vec3(0.4, 0.44, 0.5) * band(spec, 0.4) * (0.4 + 0.6 * det);
    }
    col += base * 0.3 * band(rim, 0.55) * band(ndl, -0.1);
    col = mix(col, col * 1.12 + 0.02, wear * 0.4);
    col *= mix(0.42, 1.0, aoK);
  }
  // the neon spill: the blade's cyan edge lights what is near it
  if (ci != ${CLS.glow} && ci != ${CLS.steel} && ci != ${CLS.bevel} && uSpill.w > 0.0) {
    vec3 pa = vView - uBladeA, ba = uBladeB - uBladeA;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
    vec3 d = pa - ba * h;
    float dist = length(d);
    float facing = clamp(dot(n, -d / max(dist, 1e-5)) * 0.7 + 0.3, 0.0, 1.0);
    float sp = uSpill.w / (1.0 + dist * dist / (0.03 * 0.03)) * facing;
    col += (metal ? base * 1.4 + 0.1 : vec3(0.35) + base) * uSpill.rgb * sp;
  }
  // the street's wet neon from below (down-facing surfaces)
  col += base * uEnvLo * 0.35 * max(-n.y, 0.0) * (1.0 - uSutra);
  // ruled lines on built procedural faces
  float lines = 0.0;
  if (vMat.z > 0.0) {
    vec2 ff = max(fwidth(vFace.xy), vec2(1e-6));
    float fl = floor(vMat.w + 0.5);
    float eU0 = mod(fl, 2.0), eU1 = mod(floor(fl * 0.5), 2.0), eV0 = mod(floor(fl * 0.25), 2.0), eV1 = mod(floor(fl * 0.125), 2.0);
    float lw = uLinePx * vMat.z;
    lines = max(lines, eU0 * lineAt(vFace.x, ff.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - vFace.x, ff.x, lw));
    lines = max(lines, eV0 * lineAt(vFace.y, ff.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - vFace.y, ff.y, lw));
  }
  vec3 lineC = mix(uInk, uGold * 1.3, uSutra);
  col = mix(col, col * vec3(0.55, 0.6, 0.85), uSutra * 0.35);
  col *= 1.0 + (texture2D(uSilk, gl_FragCoord.xy / 220.0).r - 0.5) * 0.1;
  if (ci != ${CLS.glow}) col = mix(col, lineC, clamp(max(lines, crease * 0.85), 0.0, 1.0));
  col += base * vMat.y;
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

/** the ink hull's vertex source: back faces pushed out a pixel width (living classes brushed) */
export const VM_HULL_VS = /* glsl */ `
attribute vec3 aHullN;
attribute vec4 aMat;
uniform vec2 uRes;
uniform float uHullPx;
uniform float uHullK;
float h11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float vn1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h11(i), h11(i + 1.0), f); }
#include <skinning_pars_vertex>
void main() {
  int ci = int(floor(aMat.x + 0.5));
  vec3 objectNormal = aHullN;
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  vec3 transformed = position;
  #include <skinning_vertex>
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  vec3 nv = normalize(normalMatrix * objectNormal);
  vec2 dir = normalize(nv.xy + 1e-5);
  bool built = ci == ${CLS.brass} || ci == ${CLS.brassDark} || ci == ${CLS.steel} || ci == ${CLS.lacquer} || ci == ${CLS.bevel} || ci == ${CLS.gold} || ci == ${CLS.carbon};
  float s = dot(position, vec3(311.0, 473.0, 231.0));
  float brush = built ? 1.0 : 0.5 + 1.2 * vn1(s);
  float w = uHullPx * uHullK * brush * (built ? 1.0 : 1.35);
  if (ci == ${CLS.glow} || ci == ${CLS.bevel}) w = 0.0;
  clip.xy += dir * w * 2.0 / uRes * clip.w;
  clip.z += 0.0004 * clip.w;
  gl_Position = clip;
}
`;
/** the ink hull's fragment source */
export const VM_HULL_FS = /* glsl */ `
uniform vec3 uInk;
uniform float uSutra;
uniform vec3 uGold;
void main() { gl_FragColor = vec4(mix(uInk, uGold * 1.3, uSutra), 1.0); }
`;
