// The same retained terrain binding as the native level: original WSTR samples plus its authored datum.
// Explicit function call only; import selects no world, service or level.
import { driftwoodGroundSampler } from './groundSampling.ts';
import { trailsideGeometry } from './trailside.ts';
import { islandTrailsideSpec } from '../world/trailsideLayout.ts';

/** Bake the original trail against the same retained WSTR height binding as the native level. */
export function originalTrailside() {
  const ground = driftwoodGroundSampler();
  return trailsideGeometry(islandTrailsideSpec(), ground);
}
