import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { CHUNK_HALF, ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { PIER_START } from '../world/sea';

/** One declared entryway as the shardfile states it (the four midpoint openings). */
export interface DriftwoodEntryway { readonly edge: 'north' | 'east' | 'south' | 'west'; readonly kind?: string | undefined }
/** The player's capsule (the engine's edge walk's), its lane count per opening and the walk's ends. */
const CAPSULE = { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] } as const;
/** the sea ramp's run (world/build.ts ENTRY_RAMP_RUN, held equal by test/shards/driftwood-isle/headless-runtime.test.ts; the
 *  world build is the browser's, not imported here) */
export const ENTRY_RAMP_RUN = 9;
const LANES = 23, MAX_TICKS = 900, STRIDE = 0.08, LOOK = 1;
/** where each lane starts (in from the cell edge: clear of the edge wall's inner face) and how far in it walks (6 m along the deck) */
const START = 1.5, WALK_TO = PIER_START + ENTRY_RAMP_RUN + 6;
/** each entry's deck: the south pier is 4 m wide, the three jetties 3 m (world/build.ts); its top 1.2 m above the road */
const DECK_HALF = { south: 2, north: 1.5, east: 1.5, west: 1.5 } as const, DECK_Y = 1.2;

/**
 * Driftwood Isle's entry proof (SF72, the coordinator's pick (c)): a real player capsule walks in from every declared
 * entryway, 23 lanes across the 8 m opening, through the host's own collision world (the baked socket floors, landings,
 * flared sea ramps, piers and jetties). Each lane crosses the flat socket and its landing at road height, then follows the
 * flared ramp in proportion (the lane's share of the 8 m opening becomes the same share of the deck) up 1.2 m onto the
 * deck and 6 m along it. A stall, a step off the ground, a drift out of its lane or feet off the expected floor (flat at
 * y = 0, the ramp's line, the deck at 1.2 m) refuses the proof: the old straight ramp's outer lanes walk off the landing
 * into the sea.
 */
export function proveDriftwoodEntries(physics: Physics, entryways: readonly DriftwoodEntryway[]): { lanes: number; steps: number } {
  if (entryways.length !== 4 || entryways.some(entry => entry.kind !== 'socketOverWater')) throw new Error('Driftwood Isle declares four socket-over-water entryways');
  const motor = new CharacterMotor(physics, CAPSULE), open = ENTRY_WIDTH / 2 - CAPSULE.radius;
  let lanes = 0, steps = 0;
  try {
    for (const edge of ['north', 'east', 'south', 'west'] as const) {
      if (!entryways.some(entry => entry.edge === edge)) throw new Error(`Driftwood Isle declares its ${edge} entryway`);
      const top = DECK_HALF[edge] - CAPSULE.radius;
      // the lane's offset across at `a` metres in: the opening's, narrowing with the ramp's flare to the deck's
      const across = (share: number, a: number): number => {
        const t = Math.min(1, Math.max(0, (a - PIER_START) / ENTRY_RAMP_RUN));
        return share * (open + (top - open) * t);
      };
      const floor = (a: number): number => (a < PIER_START ? 0 : a < PIER_START + ENTRY_RAMP_RUN ? DECK_Y * (a - PIER_START) / ENTRY_RAMP_RUN : DECK_Y);
      const ns = edge === 'north' || edge === 'south', sign = edge === 'north' || edge === 'east' ? -1 : 1;
      // level space ↔ (in from the edge, across)
      const toWorld = (a: number, c: number): { x: number; z: number } => (ns ? { x: c, z: -sign * CHUNK_HALF + sign * a } : { x: -sign * CHUNK_HALF + sign * a, z: c });
      const inOf = (p: { x: number; z: number }): number => sign * (ns ? p.z : p.x) + CHUNK_HALF;
      const acrossOf = (p: { x: number; z: number }): number => (ns ? p.x : p.z);
      for (let lane = 0; lane < LANES; lane++) {
        const share = -1 + lane * 2 / (LANES - 1), start = toWorld(START, across(share, START));
        const feet = { x: start.x, y: 0.5, z: start.z };
        // dropped from 0.5 m onto the socket first (a capsule started skin-deep in the floor falls through it)
        for (let k = 0; k < 20; k++) { steps++; if (motor.move(feet, { x: 0, y: -0.05, z: 0 }).grounded) break; }
        let stalled = 0, reached = false;
        for (let tick = 0; tick < MAX_TICKS; tick++) {
          const a = inOf(feet);
          if (a >= WALK_TO) { reached = true; break; }
          const goal = toWorld(a + LOOK, across(share, a + LOOK)), dx = goal.x - feet.x, dz = goal.z - feet.z, d = Math.hypot(dx, dz);
          const result = motor.move(feet, { x: dx / d * STRIDE, y: -9.81 / 3600, z: dz / d * STRIDE }); steps++;
          const now = inOf(feet);
          stalled = now - a < STRIDE * 0.5 ? stalled + 1 : 0;
          const where = `${edge} lane ${String(lane)} at ${now.toFixed(2)} m in`;
          if (stalled >= 5) throw new Error(`Stalled on Driftwood entry ${where}`);
          if (!result.grounded) throw new Error(`Off the ground on Driftwood entry ${where}`);
          if (Math.abs(acrossOf(feet) - across(share, now)) > CAPSULE.radius) throw new Error(`Out of its lane on Driftwood entry ${where}`);
          if (Math.abs(feet.y - floor(now)) > 0.15) throw new Error(`Off the floor on Driftwood entry ${where}: feet ${feet.y.toFixed(3)} m, floor ${floor(now).toFixed(3)} m`);
          if (now < ENTRY_ASPHALT && result.groundNormalY < 0.99) throw new Error(`Socket not flat on Driftwood entry ${where}`);
        }
        if (!reached) throw new Error(`Blocked Driftwood entry ${edge} lane ${String(lane)}: ${String(MAX_TICKS)} steps`);
        lanes++;
      }
    }
    return { lanes, steps };
  } finally { motor.dispose(); }
}
