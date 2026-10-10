import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { ENTRY_ASPHALT, ENTRY_WIDTH } from '@wildshard/engine/core/config';

/** One declared entryway as the shardfile states it (a midpoint opening on an edge). */
export interface TerrainEntryway { readonly edge: 'north' | 'east' | 'south' | 'west'; readonly kind?: string | undefined }
/** The walk: lanes per opening, metres walked in, where on the axis the feet start, and the step budget per lane. */
export interface TerrainEntryWalk { readonly lanes: number; readonly walk: number; readonly start: number; readonly maxTicks: number }
/** The player's capsule (the engine's edge walk's). */
const CAPSULE = { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] } as const;

/**
 * An entry proof on a shard's native terrain (SF27): a real player capsule walks `walk` m in from each of the four
 * declared ground entryways, `lanes` lanes across the opening, through the host's own collision world. The engine's edge
 * walk holds every step at y = 0, which only a flat shard meets; here the first `ENTRY_ASPHALT` m (the socket) must be
 * flat at y = 0, and past it the feet follow the admitted heights within 0.15 m on ground no steeper than the capsule
 * climbs. A stall, a fall, a drift out of the lane or an unwalkable slope refuses the proof.
 */
export function proveTerrainEntries(physics: Physics, entryways: readonly TerrainEntryway[], heightAt: (x: number, z: number) => number, spec: TerrainEntryWalk): { lanes: number; steps: number } {
  if (entryways.length !== 4 || entryways.some(entry => (entry.kind ?? 'ground') !== 'ground')) throw new Error('The terrain entry proof needs four ground entryways');
  const motor = new CharacterMotor(physics, CAPSULE), half = ENTRY_WIDTH / 2 - CAPSULE.radius, slope = Math.cos(Math.PI / 4);
  let lanes = 0, steps = 0;
  try {
    for (const edge of ['north', 'east', 'south', 'west'] as const) for (let lane = 0; lane < spec.lanes; lane++) {
      if (!entryways.some(entry => entry.edge === edge)) throw new Error(`Missing the ${edge} entryway`);
      const offset = -half + lane * (2 * half) / (spec.lanes - 1), along = edge === 'north' || edge === 'east' ? spec.start : -spec.start, sign = edge === 'north' || edge === 'east' ? -1 : 1;
      const ns = edge === 'north' || edge === 'south';
      const feet = { x: ns ? offset : along, y: 0.03, z: ns ? along : offset };
      const delta = { x: ns ? 0 : sign * 0.1, y: -9.81 / 3600, z: ns ? sign * 0.1 : 0 };
      let travelled = 0, stalled = 0;
      for (let tick = 0; tick < spec.maxTicks; tick++) {
        if (travelled >= spec.walk) break;
        const before = ns ? feet.z : feet.x;
        const result = motor.move(feet, delta); steps++;
        const advance = sign * ((ns ? feet.z : feet.x) - before);
        travelled += advance; stalled = advance < 0.05 ? stalled + 1 : 0;
        const ground = heightAt(feet.x, feet.z), socket = travelled < ENTRY_ASPHALT - (250 - spec.start);
        if (stalled >= 5 || !result.grounded || Math.abs((ns ? feet.x : feet.z) - offset) > CAPSULE.radius
          || Math.abs(feet.y - ground) > 0.15 || result.groundNormalY < slope || (socket && (ground !== 0 || result.groundNormalY < 0.99))) {
          throw new Error(`Blocked entry ${edge} lane ${String(lane)} at ${travelled.toFixed(2)} m`);
        }
      }
      if (travelled < spec.walk) throw new Error(`Blocked entry ${edge} lane ${String(lane)}: ${String(spec.maxTicks)} steps reached ${travelled.toFixed(2)} m`);
      lanes++;
    }
    return { lanes, steps };
  } finally { motor.dispose(); }
}
