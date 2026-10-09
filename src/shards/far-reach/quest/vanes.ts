import type { Vector3 } from 'three';
import type { Flags } from '@wildshard/engine/world/interact/flags';
import { FAN_GUST } from '../data/items';
import { inCone } from '../weapons/fanStrikes';
import { FLAGS, vaneFlag } from './flags';

/** How close a GUST must reach a vane to turn it (metres; the cone is the fan's GUST cone, a little longer). */
export const VANE_REACH = FAN_GUST.reach + 2;
/** A vane's rotor hub stands this far above its island deck (world/build.ts `vanes[].at`). */
export const VANE_HUB = 3.3;
/** Every vane is a finite authored row; refuse overflow instead of silently dropping one. */
const MAX_VANES = 64;

/**
 * A GUST from `from` along `dir` turns every vane its cone reaches (quest step 3, once the keeper's notes are read): each
 * sets its own flag, and `turned` hears its id. The browser plugin and the renderer-free host (runtime/fan.ts) share it.
 * Returns how many turned.
 */
export function turnVanes(flags: Pick<Flags, 'has' | 'set'>, vanes: readonly { readonly id: string; readonly at: Vector3 }[], from: Vector3, dir: Vector3,
  turned: (id: string) => void = () => undefined): number {
  if (!flags.has(FLAGS.notes)) return 0;
  if (vanes.length > MAX_VANES) throw new RangeError('Sky vane roster exceeds its finite row bound');
  let count = 0;
  for (let i = 0; i < MAX_VANES; i++) {
    const vane = vanes[i]; if (vane === undefined) break;
    if (flags.has(vaneFlag(vane.id)) || !inCone(from, dir, vane.at, VANE_REACH, FAN_GUST.halfAngle + 0.15)) continue;
    flags.set(vaneFlag(vane.id)); count++; turned(vane.id);
  }
  return count;
}
