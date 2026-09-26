// Lab P9 "grapple" (E169): the overlook's wet granite (comp-B's foreground: dark rain-soaked stone that mirrors the
// neon). The same vertex contract as the kit (./world/geo.ts: colour wash, aFace metres, aPat.w edge bits, aMisc.y line
// weight), so the Builder's boxes and quads draw with it unchanged:
//  - ruled ink at the face edges (constant px, fading into the wash), two hard bands of the sky-screen top light;
//  - granite speckle (two octaves of world-space cells) and weathering stains;
//  - WET on every up-facing face: the wash darkens, the painted environment reflects (a smooth fresnel sheen) and the
//    neon signs smear into long vertical reflection streaks (four sign lights; the reflected ray's angle to each sign,
//    tolerant vertically, tight horizontally), broken by puddle noise; drizzle rings are ruled circles.
//  - silk fog, alpha = the fog's transmittance (the post's silhouette mask), like the kit.
import { Color, ShaderMaterial, Vector3 } from 'three';
import { ENV_GLSL } from './vm-material';
import type { Uniforms } from './world/material';

const VS = /* glsl */ `
attribute vec4 aFace;
attribute vec4 aPat;
attribute vec2 aMisc;
varying vec3 vW;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec2 vMisc;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vCol = color;
  vFace = aFace;
  vPat = aPat;
  vMisc = aMisc;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FS = /* glsl */ `
uniform vec3 uCam;
uniform float uFogDensity;
uniform vec4 uFogBand;
uniform vec3 uFogCol;
uniform vec3 uFogLow;
uniform vec3 uLightDir;
uniform vec3 uShade;
uniform vec3 uInk;
uniform float uLinePx;
uniform float uTime;
uniform vec3 uSignP[4];
uniform vec3 uSignC[4];
uniform float uWet;
varying vec3 vW;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vFace;
flat varying vec4 vPat;
flat varying vec2 vMisc;
${ENV_GLSL}
vec4 silkFog(vec3 wp) {
  vec3 d = wp - uCam;
  float L = length(d);
  float dy = d.y;
  float H = uFogBand.y;
  float e0 = exp(-(uCam.y - uFogBand.x) / H), e1 = exp(-(wp.y - uFogBand.x) / H);
  float band = abs(dy) > 0.05 ? H * abs(e1 - e0) / abs(dy) : exp(-(0.5 * (uCam.y + wp.y) - uFogBand.x) / H);
  float tauB = uFogBand.z * min(band, 60.0) * L;
  float tau = uFogDensity * L;
  float T = exp(-(tau + tauB));
  vec3 fc = mix(uFogCol, uFogLow, clamp(tauB / max(tau + tauB, 1e-4), 0.0, 1.0));
  return vec4(fc * (1.0 - T), T);
}
float n2(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(eh21(i), eh21(i + vec2(1.0, 0.0)), f.x), mix(eh21(i + vec2(0.0, 1.0)), eh21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float lineAt(float d, float fw, float w) { float px = d / max(fw, 1e-6); float wc = max(w, 1.0); return clamp(wc * 0.5 + 0.5 - px, 0.0, 1.0) * min(w, 1.0); }
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 V = normalize(uCam - vW);
  float kind = floor(vPat.x + 0.5);
  // ruled face edges
  float fl = floor(vPat.w + 0.5);
  float eU0 = mod(fl, 2.0), eU1 = mod(floor(fl * 0.5), 2.0), eV0 = mod(floor(fl * 0.25), 2.0), eV1 = mod(floor(fl * 0.125), 2.0);
  vec2 q = vFace.xy;
  vec2 fq = max(fwidth(q), vec2(1e-6));
  float lw = uLinePx * vMisc.y;
  float lines = 0.0;
  if (vMisc.y > 0.0) {
    lines = max(lines, eU0 * lineAt(q.x, fq.x, lw));
    lines = max(lines, eU1 * lineAt(vFace.z - q.x, fq.x, lw));
    lines = max(lines, eV0 * lineAt(q.y, fq.y, lw));
    lines = max(lines, eV1 * lineAt(vFace.w - q.y, fq.y, lw));
  }
  if (kind == 10.0) {
    // carved panel: a double inset frame + a carved cloud roundel
    float ins = min(min(q.x, vFace.z - q.x), min(q.y, vFace.w - q.y));
    float fwm = max(fq.x, fq.y);
    lines = max(lines, max(lineAt(abs(ins - 0.05), fwm, lw * 0.9), lineAt(abs(ins - 0.09), fwm, lw * 0.6)));
    vec2 c = vec2(vFace.z, vFace.w) * 0.5;
    float r = length((q - c) * vec2(1.0, 1.4));
    lines = max(lines, lineAt(abs(r - min(c.x, c.y) * 0.55), fwm, lw * 0.7) * 0.8);
  }
  // granite: speckle + stains
  vec3 an = abs(n);
  vec2 sp = an.y > 0.6 ? vW.xz : (an.x > an.z ? vW.zy : vW.xy);
  // granite: dark matrix, pale feldspar flecks, a few black mica specks, a slow stain
  float fleck = n2(sp * 240.0) * 0.75 + n2(sp * 610.0) * 0.25;
  float speck = eh21(floor(sp * 70.0)) * 0.5 + n2(sp * 9.0) * 0.5;
  float stain = n2(sp * 1.3 + 7.0);
  vec3 col = vCol * (0.62 + 0.5 * speck) * (0.85 + 0.25 * stain);
  col = mix(col, vCol * 1.8, smoothstep(0.7, 0.86, fleck) * 0.55);
  col = mix(col, vCol * 0.35, smoothstep(0.72, 0.88, 1.0 - fleck) * 0.5);
  // top light, two hard bands, never black
  float ndl = dot(n, uLightDir);
  col = mix(col * uShade, col, smoothstep(-0.03, 0.03, ndl - 0.08));
  col *= mix(1.0, 0.55, smoothstep(0.35, 0.8, -n.y));
  // wet: up-facing faces (and a little on the sides where the rain runs)
  float up = smoothstep(0.55, 0.9, n.y);
  float puddle = smoothstep(0.35, 0.7, n2(vW.xz * 0.7 + 3.0) * 0.7 + 0.3 * stain);
  float wet = uWet * (up * (0.55 + 0.45 * puddle) + (1.0 - up) * 0.25);
  col *= 1.0 - 0.38 * wet;
  vec3 R = reflect(-V, n);
  // an art-directed fresnel (the targets paint wet granite as a near mirror at any angle, not water's 3 %)
  float fr = 0.22 + 0.78 * pow(1.0 - max(dot(n, V), 0.0), 2.0);
  col += envMap(R, mix(0.45, 0.06, puddle)) * fr * wet * 0.28;
  // neon streaks: each sign mirrored as a long vertical smear
  if (up > 0.01) {
    for (int i = 0; i < 4; i++) {
      vec3 L = normalize(uSignP[i] - vW);
      vec3 d = R - L;
      // horizontal error (across) tight, vertical error (along the streak) loose
      vec3 hz = normalize(vec3(L.z, 0.0, -L.x) + 1e-5);
      float ex = dot(d, hz), ey = d.y;
      float s = exp(-(ex * ex) / 0.0003 - (ey * ey) / 0.12);
      // broken into ripples along the streak (the rain on the surface)
      float broken = smoothstep(0.25, 0.75, n2(vec2(dot(vW.xz, hz.xz) * 40.0 + float(i) * 5.0, (vW.y + dot(vW.xz, L.xz)) * 90.0)));
      col += uSignC[i] * s * broken * wet * up * 5.0;
    }
    // the Well's lantern strings and lit windows, mirrored: red and amber specks drawn out into vertical streaks
    float az = atan(R.x, -R.z);
    float el = R.y;
    if (el > -0.05 && el < 0.5) {
      float ca = floor(az * 110.0);
      float ha = eh11(ca * 1.7 + 3.0);
      float fa = fract(az * 110.0);
      float dotm = 1.0 - smoothstep(0.1, 0.35, abs(fa - 0.5));
      float row = fract(el * 7.0 + ha * 3.0);
      float lamp = step(0.4, ha) * dotm * smoothstep(0.0, 0.12, row) * (1.0 - smoothstep(0.3, 0.75, row));
      vec3 lc = ha > 0.82 ? vec3(1.0, 0.6, 0.28) : vec3(1.0, 0.16, 0.08);
      float broken2 = smoothstep(0.2, 0.8, n2(vec2(vW.x * 40.0, vW.z * 90.0)));
      col += lc * lamp * broken2 * wet * up * 3.2 * (1.0 - smoothstep(0.15, 0.5, el));
    }
    // wet sparkle: the flecks catch the sky screens
    col += vec3(0.8, 0.88, 1.0) * smoothstep(0.8, 0.9, fleck) * wet * up * fr * 0.9;
    // drizzle rings: ruled circles that grow and fade
    vec2 cell = floor(vW.xz * 2.2);
    vec2 cp = (cell + vec2(eh21(cell), eh21(cell + 3.1))) / 2.2;
    float ph = fract(uTime * 1.3 + eh21(cell + 9.0));
    float rr = length(vW.xz - cp);
    float ring = lineAt(abs(rr - ph * 0.22), max(fq.x, fq.y) * 0.9 + 1e-4, 1.0) * (1.0 - ph) * puddle;
    col = mix(col, col * 1.6 + 0.04, ring * 0.5 * up);
  }
  float dist = length(uCam - vW);
  col = mix(col, uInk, clamp(lines, 0.0, 1.0) * (1.0 - smoothstep(30.0, 90.0, dist)));
  vec4 fg = silkFog(vW);
  gl_FragColor = vec4(col * fg.a + fg.rgb, fg.a);
}
`;

export interface WetSign { p: Vector3; c: Color }

export function wetStoneMaterial(shared: Uniforms, signs: readonly WetSign[]): ShaderMaterial {
  const P = [0, 1, 2, 3].map((i) => signs[i]?.p.clone() ?? new Vector3(0, -1000, 0));
  const C = [0, 1, 2, 3].map((i) => signs[i]?.c.clone() ?? new Color(0, 0, 0));
  return new ShaderMaterial({
    uniforms: {
      uCam: shared['uCam'] ?? { value: new Vector3() }, uFogDensity: shared['uFogDensity'] ?? { value: 0 },
      uFogBand: shared['uFogBand'] ?? { value: null }, uFogCol: shared['uFogCol'] ?? { value: new Color() },
      uFogLow: shared['uFogLow'] ?? { value: new Color() }, uLightDir: shared['uLightDir'] ?? { value: new Vector3(0, 1, 0) },
      uShade: shared['uShade'] ?? { value: new Color(1, 1, 1) }, uInk: shared['uInk'] ?? { value: new Color(0x14161c) },
      uLinePx: shared['uLinePx'] ?? { value: 1.3 }, uTime: shared['uTime'] ?? { value: 0 },
      uSignP: { value: P }, uSignC: { value: C }, uWet: { value: 1.0 },
    },
    vertexShader: VS,
    fragmentShader: FS,
    vertexColors: true,
  });
}
