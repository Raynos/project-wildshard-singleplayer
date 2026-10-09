import { UPDRAFT } from '../data/layout';

/** The updraft's upward push while you ride its column (m/s², G24). */
export const UPDRAFT_LIFT = 12;

/**
 * Is a board rider at (x, y, z) inside the updraft's wind column (G24)? Along the ramp's run (any heading), within its
 * width plus half a metre, below the step's deck plus half a metre. The one rule the browser's `far.updraft` system
 * (runtime/index.ts) and the headless host's (runtime/headless.ts) both feed `UPDRAFT_LIFT * dt` of upward impulse on.
 */
export function inUpdraft(x: number, y: number, z: number): boolean {
  const ux = UPDRAFT.x1 - UPDRAFT.x0, uz = UPDRAFT.z1 - UPDRAFT.z0, len = Math.hypot(ux, uz);
  const along = ((x - UPDRAFT.x0) * ux + (z - UPDRAFT.z0) * uz) / len, across = Math.abs((x - UPDRAFT.x0) * uz - (z - UPDRAFT.z0) * ux) / len;
  return across < UPDRAFT.width / 2 + 0.5 && along > 0 && along < len && y < UPDRAFT.y1 + 0.5;
}
