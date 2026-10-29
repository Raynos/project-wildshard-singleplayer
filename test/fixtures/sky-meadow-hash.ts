/**
 * The meadow bake's original lattice hash, in double precision. FR6 moved the bake to the GPU's single precision
 * (generators/meadowHash.ts); the ownership oracles rebuild the predecessor bake with this one, so their pins stay the
 * original bake's bytes. Never a live product hash.
 */
export function predecessorMeadowHash(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
