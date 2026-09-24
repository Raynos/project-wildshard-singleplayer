/**
 * The sea's one wave function (DRIFTWOOD-REMASTER W3): the Ocean's vertex shader and every TypeScript rider (the boat,
 * the swimmer's eye, gulls on the water, floating debris) evaluate the same four Gerstner waves on the same clock, so a
 * boat bobs exactly with the facets around it.
 *
 *   import { waveHeight, waveClock, WAVES_GLSL } from './waves';
 *   const y = level + waveHeight(x, z);                 // metres above the still level, at world (x, z), now
 *   const y2 = waveHeight(x, z, t, damp);               // at time t, with the shore damping (0..1) of your choice
 *   seaDamp(depth)                                      // the shore damping the Ocean uses: 0.35 on the sand → 1 by 1.5 m deep
 *
 * `waveClock.t` is advanced by `Ocean.update(dt)` (seconds). Gerstner: every wave moves points in a circle, so the
 * height at a fixed (x, z) is found by undoing the horizontal push (two fixed-point steps — plenty at these steepnesses).
 */

/** [dirX, dirZ, amplitude m, wavelength m, speed m/s, steepness 0..1] — gentle lagoon swell; λ ≥ 11 m so the phone's 4 m grid resolves them */
export const WAVES: readonly (readonly [number, number, number, number, number, number])[] = [
  [0.86, 0.51, 0.17, 27, 3.4, 0.55],
  [-0.34, 0.94, 0.12, 17, 2.6, 0.5],
  [0.62, -0.78, 0.07, 11.5, 2.1, 0.45],
  [-0.9, -0.43, 0.06, 14, 2.3, 0.4],
];

export const waveClock = { t: 0 };

/** shore damping from the water depth (m): the swell flattens over the sand so the foam line stays put */
export function seaDamp(depth: number): number {
  const x = Math.min(1, Math.max(0, depth / 1.5));
  return 0.35 + 0.65 * x * x * (3 - 2 * x);
}

const TAU = Math.PI * 2;

/** displacement (dx, dy, dz) of the surface point whose rest position is (x, z) */
export function waveDisplace(x: number, z: number, t: number, damp: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  let dx = 0, dy = 0, dz = 0;
  for (const [wx, wz, a, len, speed, q] of WAVES) {
    const k = TAU / len;
    const ph = k * (wx * x + wz * z - speed * t);
    const c = Math.cos(ph), s = Math.sin(ph);
    const qa = (q / (k * a * WAVES.length)) * a;
    dx += wx * qa * c; dz += wz * qa * c; dy += a * s;
  }
  out.x = dx * damp; out.y = dy * damp; out.z = dz * damp;
  return out;
}

const _o = { x: 0, y: 0, z: 0 };
/** surface height above the still level at world (x, z) — what a floating thing should ride */
export function waveHeight(x: number, z: number, t = waveClock.t, damp = 1): number {
  let px = x, pz = z;
  for (let i = 0; i < 2; i++) { waveDisplace(px, pz, t, damp, _o); px = x - _o.x; pz = z - _o.z; }
  return waveDisplace(px, pz, t, damp, _o).y;
}

/** the same waves in GLSL: `vec3 gerstner(vec2 p, float t, float damp)` → displacement */
export const WAVES_GLSL = /* glsl */`
vec3 gerstner(vec2 p, float t, float damp) {
  vec3 d = vec3(0.0);
${WAVES.map(([wx, wz, a, len, speed, q]) => {
    const k = TAU / len, qa = (q / (k * a * WAVES.length)) * a;
    return `  { float ph = ${k.toFixed(6)} * (${wx.toFixed(4)} * p.x + ${wz.toFixed(4)} * p.y - ${speed.toFixed(4)} * t); float c = cos(ph);
    d += vec3(${(wx * qa).toFixed(6)} * c, ${a.toFixed(4)} * sin(ph), ${(wz * qa).toFixed(6)} * c); }`;
  }).join('\n')}
  return d * damp;
}`;
