/** Numeric gust-front policy, passed by the world owner; no clock or shader state is read. */
export interface WindFieldSpec {
  readonly x: number; readonly z: number;
  readonly frontLength: number; readonly frontSpeed: number; readonly secondaryLength: number;
}

/** Slow clock gust with the weather's additive boost. Arithmetic matches the live uniform update. */
export function clockGust(time: number, boost: number): number {
  let gust = 0.5 + 0.28 * Math.sin(time * 0.11) + 0.16 * Math.sin(time * 0.37 + 1.3)
    + 0.08 * Math.sin(time * 1.3 + 0.4);
  if (boost > 0) gust += boost * (0.45 - 0.25 * gust);
  return Math.min(1, Math.max(0, gust));
}

const TAU = 6.283185307;
function front(value: number): number {
  const fraction = value - Math.floor(value), warped = fraction + 0.12 * (1 - Math.cos(TAU * fraction));
  const cosine = 0.5 + 0.5 * Math.cos(TAU * warped);
  return cosine * cosine;
}

/** CPU gust-front sampler for projectile/sound laws and the live shader's mirror, using explicit time and gust. */
export function fieldGustAt(x: number, z: number, time: number, gust: number, field: WindFieldSpec): number {
  const along = x * field.x + z * field.z, across = -x * field.z + z * field.x;
  const bend = 22 * Math.sin(across * 0.021 + time * 0.043) + 9 * Math.sin(across * 0.057 - time * 0.031);
  const distance = along + bend - time * field.frontSpeed;
  const fronts = 0.75 * front(distance / field.frontLength) + 0.25 * front(distance / field.secondaryLength + 0.37);
  const patchy = 0.62 + 0.38 * Math.sin(across * 0.025 + along * 0.004 - time * 0.05);
  return (0.3 + 0.7 * gust) * (0.3 + 0.9 * fronts * patchy);
}
