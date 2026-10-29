/**
 * Build-time only (FR6): the old meadow program's lattice hash, `fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453)`,
 * as the GPU ran it: in single precision at every step. `* 43758.5453` amplifies the last bits of the sine, so the
 * double-precision hash grew a different field from the one the LEGACY goldens show (other lawn / wild patches, tones
 * and daisy drifts round spawn); single precision matches the GPU's values to ~0.004.
 */
const f32 = Math.fround;

export function meadowHash(x: number, y: number): number {
  const v = f32(f32(Math.sin(f32(f32(f32(x) * f32(127.1)) + f32(f32(y) * f32(311.7))))) * f32(43758.5453));
  return f32(v - Math.floor(v));
}
