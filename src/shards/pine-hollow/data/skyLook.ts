/**
 * Pine Hollow's keyed sky as SF59 material graphs (SHARD-PLATFORM W2 C2; it was the keyed sky's GLSL program): the dome
 * the camera sits in and the same sky drawn into the environment equirect (runtime/looks/keyedSky). Both read two baked
 * equirect keys at a time, lent by the runtime as they decode (`keyA`, `keyB`: `role: 'lent'`), blended by `mix`, each
 * turned about the vertical (`rotA`, `rotB`: cos, sin) so its sun glow sits on the clock's sun or moon and scaled by its
 * gain; then the analytic aureole round `lightDir` (`glow`, above the haze line) and the weather's cloud deck (`grey`:
 * the photo's blue and clouds go to a flat cool grey near `flat`). The runtime sets every param each frame.
 *
 *   dome: a back-faced sphere, the direction its own vertex position
 *   env:  one clip-space triangle over the equirect target, the direction from the target's uv (u round, v up)
 */

/** the look.materials ids the sky's graphs are worn under */
export const SKY_LOOKS = { dome: 'pine-sky-dome', env: 'pine-sky-env' } as const;
