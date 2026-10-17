import { SKY_PAINTED } from './rows/skyPaintedLook';

/** Resolve the fixed golden-hour look, image samplers and dressing graphs offline. */
export function paintedLookRows(): unknown {
  const { look, day, haze, ...rows } = SKY_PAINTED;
  return { ...rows, look: { ...look, lightScope: 'page', clock: day, sky: { kind: 'haze', row: haze } } };
}
