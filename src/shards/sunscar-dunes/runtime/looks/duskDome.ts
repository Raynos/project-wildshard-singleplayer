import { BackSide, ShaderMaterial, Vector3 } from 'three';

/**
 * A procedural dusk dome as a declared row (SHARD-PLATFORM SF72, look-family rows): a sky at infinity for a shard held at
 * sunset or in the blue hour, its palette and features data. From the horizon up: a band (warmer toward the set sun) →
 * a rose fade → a mid sky → a zenith, each colour moving from its `early` to its `late` value as the dusk uniform runs
 * 0 → 1; a hot glow over the sun's azimuth, a thin glow line on the horizon late in the dusk, an optional deck of thin
 * under-lit cloud streaks beside the glow (clearing early in the dusk), stars overhead, a dither against 8-bit banding,
 * and the dome's gamma. Colours are authored in the dome's own (sRGB-like) space and raised by `gamma` to linear.
 *
 * The dome is one `ShaderMaterial` on a back-faced sphere: drawn first, no depth test or write, never fogged. The shard
 * passes its own dusk uniform (it may share it with its other looks).
 */

/** RGB in the dome's authored space. */
export type DomeRgb = readonly [number, number, number];
/** A colour at the dusk's start and at its end. */
export interface DomeStage { readonly early: DomeRgb; readonly late: DomeRgb }

/** One dusk dome, as data. */
export interface DuskDomeStyle {
  /** Where the afterglow is brightest (normalized by the dome): the set sun's direction. */
  readonly sun: readonly [number, number, number];
  /** The band: `away` from the sun to `toward` it (blend by the turn to the sun ^ `power`), scaled by `gain[0]` + `gain[1]` × dusk. */
  readonly band: { readonly away: DomeRgb; readonly toward: DomeRgb; readonly power: number; readonly gain: readonly [number, number] };
  readonly rose: DomeStage;
  readonly mid: DomeStage;
  readonly zenith: DomeStage;
  /** The hot glow over the sun: `colour` × turn ^ `power` × `gain`, fading with height and dusk. */
  readonly glow: { readonly colour: DomeRgb; readonly power: number; readonly gain: number };
  /** The late dusk's glow line on the horizon. */
  readonly horizon: { readonly colour: DomeRgb; readonly gain: number };
  /** The under-lit cloud streaks (lit bellies `lit` → `litHot` near the glow, `litEdge` at their edge; dark tops `dark` → `darkHot`), gone by dusk `clearBy[1]`; null: a clear sky. */
  readonly clouds: { readonly lit: DomeRgb; readonly litHot: DomeRgb; readonly litEdge: DomeRgb; readonly dark: DomeRgb; readonly darkHot: DomeRgb; readonly clearBy: readonly [number, number] } | null;
  /** Stars: one in `1 - density` of the cells, `colour` × (`gain[0]` + `gain[1]` × a hash). */
  readonly stars: { readonly colour: DomeRgb; readonly density: number; readonly gain: readonly [number, number] };
  /** The dither's amplitude against 8-bit banding. */
  readonly dither: number;
  /** The authored colour's power to linear. */
  readonly gamma: number;
}

/** A GLSL float literal: integers keep a `.0`. */
const f = (n: number): string => Number.isInteger(n) ? n.toFixed(1) : String(n);
const v3 = (c: DomeRgb): string => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;

/** The dome's vertex shader: the direction of each sphere vertex. */
export const DUSK_DOME_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

function cloudDeck(c: NonNullable<DuskDomeStyle['clouds']>): string {
  return /* glsl */ `
  vec2 cq = vec2(az * 9.0, h * 38.0);
  float cn = vNoise(cq * 0.45 + 11.0) * 0.35 + vNoise(cq) * 0.33 + vNoise(cq * vec2(2.3, 2.0) + 3.1) * 0.2 + vNoise(cq * vec2(6.0, 4.0) + 7.3) * 0.12;
  float azG = atan(uSun.z, uSun.x), rel = az - azG; rel -= 6.2831853 * floor((rel + 3.1415927) / 6.2831853);
  float bank = 1.15 * smoothstep(0.04, 0.18, rel) * (1.0 - smoothstep(1.0, 1.5, rel)) + 0.3 * smoothstep(-1.1, -0.75, rel) * (1.0 - smoothstep(-0.22, -0.1, rel));
  float fil = vNoise(vec2(az * 60.0, h * 260.0) + 5.0), holes = smoothstep(0.32, 0.5, vNoise(vec2(az * 20.0, h * 90.0) + 9.0));
  float cov = smoothstep(0.46 - 0.04 * step(0.0, rel), 0.6, cn) * (0.35 + 0.65 * smoothstep(0.35, 0.65, fil)) * holes * bank * smoothstep(0.03, 0.06, h) * (1.0 - smoothstep(0.2, 0.28, h)) * (1.0 - smoothstep(2.7, 2.95, abs(az))) * (1.0 - smoothstep(${f(c.clearBy[0])}, ${f(c.clearBy[1])}, uDusk));
  vec2 cqb = cq - vec2(0.0, 0.35);
  float cBelow = vNoise(cqb * 0.45 + 11.0) * 0.35 + vNoise(cqb) * 0.33 + vNoise(cqb * vec2(2.3, 2.0) + 3.1) * 0.2 + vNoise(cqb * vec2(6.0, 4.0) + 7.3) * 0.12;
  float lit = clamp((cn - cBelow) * -6.0 + 0.7, 0.0, 1.0);
  float hot = pow(toward, 1.4) * (1.0 - smoothstep(0.1, 0.4, h));
  vec3 cLit = mix(mix(${v3(c.lit)}, ${v3(c.litHot)}, hot), ${v3(c.litEdge)}, hot * lit * 0.6);
  vec3 cDark = mix(${v3(c.dark)}, ${v3(c.darkHot)}, hot);
  float core = smoothstep(0.62, 0.78, cn);
  c = mix(c, mix(cDark, cLit, clamp(lit * (0.75 + 0.25 * hot) + 0.2 * hot - 0.5 * core, 0.0, 1.0)), min(1.0, cov * 1.15));`;
}

/** The dome's fragment shader for one style. */
export function duskDomeFragment(s: DuskDomeStyle): string {
  return /* glsl */ `
uniform vec3 uSun;
uniform float uDusk;
varying vec3 vDir;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
float vNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(vHash(i), vHash(i + vec2(1.0, 0.0)), f.x), mix(vHash(i + vec2(0.0, 1.0)), vHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  vec3 d = normalize(vDir);
  float h = max(d.y, 0.0);
  float toward = max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(uSun.x, 0.0, uSun.z))), 0.0);
  vec3 band = mix(${v3(s.band.away)}, ${v3(s.band.toward)}, pow(toward, ${f(s.band.power)})) * (${f(s.band.gain[0])} + ${f(s.band.gain[1])} * uDusk);
  vec3 rose = ${v3(s.rose.early)}, dusk = ${v3(s.mid.early)}, indigo = ${v3(s.zenith.early)};
  rose = mix(rose, ${v3(s.rose.late)}, uDusk);
  indigo = mix(indigo, ${v3(s.zenith.late)}, uDusk);
  dusk = mix(dusk, ${v3(s.mid.late)}, uDusk);
  vec3 c = mix(band, rose, smoothstep(0.0, (0.08 + 0.07 * toward) * (1.0 - 0.5 * uDusk), h));
  c = mix(c, dusk, smoothstep(0.05 * (1.0 - 0.6 * uDusk), 0.36 - 0.18 * uDusk, h));
  c = mix(c, indigo, smoothstep(0.08 - 0.05 * uDusk, 0.5, h));
  c += ${v3(s.glow.colour)} * pow(toward, ${f(s.glow.power)}) * (1.0 - smoothstep(0.02, 0.24 - 0.12 * uDusk, h)) * ${f(s.glow.gain)} * (1.0 - 0.6 * uDusk);
  c += ${v3(s.horizon.colour)} * (1.0 - smoothstep(0.0, 0.055, h)) * ${f(s.horizon.gain)} * smoothstep(0.3, 0.75, uDusk) * (0.4 + 0.6 * pow(toward, 0.7));
  float az = atan(d.z, d.x);${s.clouds === null ? '\n  float cov = 0.0;' : cloudDeck(s.clouds)}
  vec3 cellP = d * 300.0, cell = floor(cellP);
  vec3 spot = cell + 0.5 + (vec3(starHash(cell + 1.7), starHash(cell + 5.3), starHash(cell + 9.1)) - 0.5) * 0.5;
  float starDot = 1.0 - smoothstep(0.08, 0.4, length(cellP - spot));
  float star = step(${f(s.stars.density)}, starHash(cell)) * starDot * smoothstep(0.1 - 0.05 * uDusk, 0.35 - 0.15 * uDusk, h) * (1.0 - 0.7 * pow(toward, 2.0)) * (1.0 - cov);
  c += ${v3(s.stars.colour)} * star * (${f(s.stars.gain[0])} + ${f(s.stars.gain[1])} * starHash(cell + 3.1));
  c += (starHash(vec3(gl_FragCoord.xy, 7.0)) - 0.5) * ${f(s.dither)};
  gl_FragColor = vec4(pow(max(c, vec3(0.0)), vec3(${f(s.gamma)})), 1.0);
}`;
}

/** The set sun's direction for a style (the dome's `uSun`; a shard's other looks may read it too). */
export const duskDomeSun = (s: DuskDomeStyle): Vector3 => new Vector3(s.sun[0], s.sun[1], s.sun[2]).normalize();

/** The dome's material for one style over the shard's dusk uniform (0 the sunset … 1 the blue hour). */
export function duskDomeMaterial(s: DuskDomeStyle, dusk: { value: number }): ShaderMaterial {
  return new ShaderMaterial({ side: BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: { uSun: { value: duskDomeSun(s) }, uDusk: dusk }, vertexShader: DUSK_DOME_VERTEX, fragmentShader: duskDomeFragment(s) });
}
