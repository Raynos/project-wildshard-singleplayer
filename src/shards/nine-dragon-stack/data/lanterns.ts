// Nine Dragon's red paper lanterns (look/lanterns.ts) as data (SHARD-PLATFORM M3, look-family rows): the near / far / dot
// switches and the lantern program's GLSL and row (its colours and gain as uniform rows), for the SDK shader family
// (@wildshard/sdk/looks/shaderFamily); `@{name}` splices what look/style.ts passes the family.
import type { ShaderProgramRow } from '@wildshard/sdk/looks/shaderFamily';
import { EMIT_FOG, FOG_GLSL, NOISE_GLSL } from './look';

/** the near / far switch (m) */
export const LOD_NEAR = 35;
/**
 * (E283, Jake's pick: the distance LODs) past LOD_DOT m a third draw: the body as a
 * 2 × 6 lathe (24 tris, half the far one's). Its outline is within ~5 cm of the far one's, ~⅔ px there on the phone frame
 */
export const LOD_DOT = 80;

const VS_LANTERN = /* glsl */ `
attribute float aPart;
attribute float aSeed;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vSeed;
varying float vViewZ;
void main() {
  vLocal = position; vPart = aPart; vSeed = aSeed;
  float a = sin(uTime * 0.9 + aSeed * 6.28) * 0.05;
  vec3 p = position - vec3(0.0, 0.3, 0.0);
  p = vec3(p.x, p.y * cos(a) - p.z * sin(a), p.y * sin(a) + p.z * cos(a)) + vec3(0.0, 0.3, 0.0);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vec4 vp = viewMatrix * wp;
  vViewZ = -vp.z;
  gl_Position = projectionMatrix * vp;
}
`;

const FS_LANTERN = /* glsl */ `
${NOISE_GLSL}
${FOG_GLSL}
uniform float uTime;
uniform float uSutra;
uniform vec3 uHot;
uniform vec3 uRim;
uniform vec3 uCapCol;
uniform vec3 uTassel;
uniform vec3 uGold;
uniform float uGain;
uniform float uNear;
varying float vViewZ;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vSeed;
void main() {
  vec3 V = normalize(uCam - vWorld);
  float ndv = abs(dot(normalize(vN), V));
  vec4 fg = silkFog(vWorld, 1.0);
  vec3 col;
  if (vPart < 0.5) {
    float ang = atan(vLocal.z, vLocal.x);
    float rib = abs(fract(ang / 6.2832 * 16.0) - 0.5) / 16.0 * 6.2832 * length(vLocal.xz);
    float fw = max(fwidth(rib), 1e-5);
    float ribs = 1.0 - smoothstep(0.0045, 0.0045 + fw * 1.5, rib);
    ribs *= 1.0 - smoothstep(0.004, 0.012, fw);
    float band = smoothstep(0.17, 0.2, abs(vLocal.y));
    float candle = pow(clamp(ndv, 0.0, 1.0), 2.2) * (0.6 + 0.4 * (1.0 - abs(vLocal.y) / 0.25));
    float fl = 0.93 + 0.07 * sin(uTime * 11.0 + vSeed * 40.0) * sin(uTime * 7.3 + vSeed * 13.0);
    vec3 E = mix(uRim, uHot, candle) * uGain * fl;
    E += vec3(1.0, 0.62, 0.3) * pow(clamp(ndv, 0.0, 1.0), 7.0) * (1.0 - abs(vLocal.y) / 0.25) * uGain * 0.55 * fl;
    E *= 1.0 - 0.7 * ribs;
    E = mix(E, uRim * uGain * 0.25, band * 0.8);
    E = mix(E, E * (1.0 - ribs * 0.5) + uGold * ribs * uGain * 0.4, uSutra);
    col = E * pow(max(fg.a, 1e-4), ${EMIT_FOG});
  } else if (vPart < 1.5) {
    vec3 c = mix(uCapCol, uGold * 0.8, uSutra) * (0.35 + 0.65 * pow(clamp(1.0 - ndv, 0.0, 1.0), 2.0));
    col = c * fg.a + fg.rgb;
  } else {
    col = uTassel * (0.6 + 0.4 * ndv) * fg.a + fg.rgb;
  }
  gl_FragColor = vec4(col, uNear / max(vViewZ, uNear));
}
`;

/** the paper glows hot orange through the candle, deep cinnabar at the rim; lacquer caps, a red tassel */
export const LANTERN_PROGRAMS = {
  lantern: {
    vertex: VS_LANTERN, fragment: FS_LANTERN,
    uniforms: { uHot: { rgb: 0xff6a3c }, uRim: { rgb: 0x9a0e0a }, uCapCol: { rgb: 0x3a2a18 }, uTassel: { rgb: 0xb3241a }, uGain: 1.5 },
  },
} as const satisfies Readonly<Record<string, ShaderProgramRow>>;
