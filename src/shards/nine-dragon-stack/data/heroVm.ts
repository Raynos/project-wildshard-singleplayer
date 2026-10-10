// Nine Dragon's hero viewmodel look as data (SHARD-PLATFORM M3): the material classes, the toon program's GLSL and its
// tuning as uniform rows. world/hero/vm-material.ts draws the decal atlas and makes the material; the comment at its
// head describes the look.
import type { UniformRows } from '@wildshard/sdk/looks/shaderFamily';

/** material classes (the Kit's `kind` slot, aPat.x); values clear of the architecture kinds 0–8 */
export const HERO_VM = { brass: 20, steel: 21, lacquer: 22, matte: 23, silk: 24, paper: 25, glow: 26, darkBrass: 27 } as const;

/** the program's tuning (the silk grain, the decal atlas and its cells are the shard's) */
export const HERO_VM_UNIFORMS = {
  uKey: { v3: [-0.45, 0.75, 0.5], normalize: true },
  uInk: { rgb: 0x111214 },
  uLinePx: 1.6,
  uSutra: 0,
  uGold: { rgb: 0xc9a24a },
} as const satisfies UniformRows;

/** the hero program's vertex source */
export const HERO_VM_VS = /* glsl */ `
attribute vec4 aFace;
attribute vec4 aPat;
attribute vec4 aMisc;
varying vec3 vN;
varying vec3 vView;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec4 vMisc;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  vN = normalize(normalMatrix * normal);
  vColor = color;
  vFace = aFace;
  vPat = aPat;
  vMisc = aMisc;
  gl_Position = projectionMatrix * mv;
}
`;

/** the hero program's fragment source: class bands, ruled face edges, the decal cells, the sutra wash and the silk grain */
export const HERO_VM_FS = /* glsl */ `
uniform sampler2D uSilk;
uniform sampler2D uDecal;
uniform vec4 uEtch;
uniform vec4 uFu;
uniform vec3 uKey;
uniform vec3 uInk;
uniform float uLinePx;
uniform float uSutra;
uniform vec3 uGold;
varying vec3 vN;
varying vec3 vView;
varying vec3 vColor;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec4 vMisc;
float lineAt(float d, float fw, float w) { float px = d / max(fw, 1e-6); float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - px, 0.0, 1.0) * min(w, 1.0); }
float band(float x, float e) { float w = max(fwidth(x), 1e-4) * 0.75; return smoothstep(e - w, e + w, x); }
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(-vView);
  float cls = floor(vPat.x + 0.5);
  vec3 base = vColor;
  vec3 col;
  float ndl = dot(n, uKey);
  float rim = pow(1.0 - clamp(dot(n, V), 0.0, 1.0), 3.0);
  float lines = 0.0;
  vec2 ff = max(fwidth(vFace.xy), vec2(1e-6));
  float fl = floor(vMisc.w + 0.5);
  float eU0 = mod(fl, 2.0), eU1 = mod(floor(fl * 0.5), 2.0), eV0 = mod(floor(fl * 0.25), 2.0), eV1 = mod(floor(fl * 0.125), 2.0);
  float lw = uLinePx * vMisc.y;
  if (vMisc.y > 0.0) {
    lines = max(lines, eU0 * lineAt(vFace.x, ff.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - vFace.x, ff.x, lw));
    lines = max(lines, eV0 * lineAt(vFace.y, ff.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - vFace.y, ff.y, lw));
  }
  vec3 R = reflect(-V, n);
  // key-light bands (the sky screens above) + one narrow studio highlight: toon metal the way the targets paint it
  float lit = band(ndl, 0.08);
  float half1 = band(ndl, -0.3);
  float spec = pow(max(dot(R, normalize(uKey + vec3(0.1, 0.25, 0.3))), 0.0), 24.0);
  float rimL = band(rim * max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 0.22);
  if (cls == 20.0 || cls == 27.0) {
    // brass: umber shadow, a mid brass, gold light, pale-gold highlight streaks
    vec3 dark = base * vec3(0.34, 0.27, 0.18);
    vec3 midc = base * vec3(0.72, 0.64, 0.5);
    vec3 hi = mix(base, vec3(1.0, 0.9, 0.6), 0.35) * 1.12;
    col = mix(dark, midc, half1);
    col = mix(col, base, lit);
    col = mix(col, hi, band(spec, 0.35) * lit);
    col = mix(col, vec3(1.25, 1.15, 0.85), band(spec, 0.8));
    col += base * 0.4 * rimL;
  } else if (cls == 21.0) {
    // steel: near black, the lit flat a shade lighter, one cool streak; the etch lightens the flats
    float along = vFace.y / max(vFace.w, 1e-4);
    col = mix(base * 0.5, base, half1);
    col = mix(col, base * 1.2, lit);
    col = mix(col, vec3(0.42, 0.48, 0.56), band(spec, 0.6) * 0.6);
    col *= 0.8 + 0.35 * along;
    if (vPat.y > 0.5 && vPat.y < 1.5) {
      vec2 uv = vec2(mix(uEtch.x, uEtch.z, 1.0 - along), mix(uEtch.y, uEtch.w, vFace.x / max(vFace.z, 1e-4)));
      float e = texture2D(uDecal, uv).r * smoothstep(0.02, 0.2, along) * (1.0 - smoothstep(0.75, 0.95, along));
      col = mix(col, vec3(0.36, 0.41, 0.47), e * 0.3);
    }
  } else if (cls == 22.0) {
    // black lacquer: a dark body, a narrow white highlight, a diamond silk wrap ruled over it (vPat.z = pitch)
    col = mix(base * 0.8, base * 1.8 + 0.012, lit);
    col = mix(col, vec3(0.62, 0.64, 0.7), band(spec, 0.55) * 0.8);
    if (vPat.z > 0.0 && vPat.z < 0.1) {
      vec2 q = vFace.xy;
      vec2 rq = vec2(q.x + q.y, q.x - q.y) * 0.7071 / vPat.z;
      vec2 fr = max(fwidth(rq), vec2(1e-5));
      vec2 dd = abs(fract(rq + 0.5) - 0.5);
      float w = max(lineAt(dd.x, fr.x, 1.2), lineAt(dd.y, fr.y, 1.2));
      col = mix(col, col * 0.3, w);
    }
  } else if (cls == 26.0) {
    col = base;
  } else if (cls == 25.0) {
    // paper: the talisman cell from the decal atlas, lit flat with a soft shade
    vec2 uv = vec2(mix(uFu.x, uFu.z, vFace.x / max(vFace.z, 1e-4)), mix(uFu.y, uFu.w, vFace.y / max(vFace.w, 1e-4)));
    vec3 t = texture2D(uDecal, uv).rgb;
    col = t * mix(0.72, 1.0, band(abs(ndl), 0.15));
  } else {
    // matte (cloth, leather, glove, skin) and silk: 3 hard bands, never black, a lit rim
    float l = mix(0.5, 0.74, band(ndl, -0.25));
    l = mix(l, 1.0, band(ndl, 0.25));
    col = base * l;
    if (cls == 24.0) {
      // silk: a sheen band where the view grazes
      col += base * 0.45 * band(rim, 0.35) * band(ndl, 0.0);
    } else {
      col += base * 0.28 * band(rim, 0.55) * band(ndl, -0.1);
    }
    // cloth wraps: ruled bands across the length (vPat.y = band pitch in metres)
    if (vPat.y > 0.0 && vPat.y < 1.0) {
      float q = vFace.y / vPat.y;
      float fw2 = max(fwidth(q), 1e-5);
      float d = abs(fract(q + 0.5) - 0.5);
      col = mix(col, col * 0.55, lineAt(d * vPat.y, fw2 * vPat.y, 1.3));
    }
  }
  // gold-on-indigo: lines turn gold, washes dim toward the indigo paper (the sutra look)
  vec3 lineC = mix(uInk, uGold * 1.3, uSutra);
  col = mix(col, col * vec3(0.55, 0.6, 0.85), uSutra * 0.35);
  // silk grain on the viewmodel too (codex's edit of the lab frame puts paper grain on every surface)
  col *= 1.0 + (texture2D(uSilk, gl_FragCoord.xy / 220.0).r - 0.5) * 0.12;
  col = mix(col, lineC, clamp(lines, 0.0, 1.0));
  col += base * vMisc.x;
  gl_FragColor = vec4(col, 1.0);
}
`;
