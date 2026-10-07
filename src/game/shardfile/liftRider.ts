import * as v from 'valibot';
import { canStandAt } from '@wildshard/engine/physics/query';
import { tagOf } from '@wildshard/engine/physics/surface';
import type { Shardfile } from './schema';
import type { ShardfileSimulation } from './simulation';
import { socketLiftEntries } from './socketLift';

/** Stable edge identity only: no historical pose, native handle or author function enters a rider checkpoint. */
export const LiftRiderSchema = v.nullable(v.picklist(['north', 'east', 'south', 'west']));
/** A rider reloads at its admitted road boarding point; other player progress keeps its existing save policy. */
export type LiftRider = v.InferOutput<typeof LiftRiderSchema>;
/** Capture only a live grounded rider aboard a declared moving lift, never a proximity guess. */
export function captureLiftRider(source: Shardfile, sim: Pick<ShardfileSimulation, 'host' | 'movers'>): LiftRider {
  if (!sim.host.hasPlayerMotor || sim.movers === undefined) return null;
  const motor = sim.host.player.motor;
  if (!motor.result.grounded || motor.result.groundCollider === null) return null;
  const owner = tagOf(motor.result.groundCollider)?.owner;
  const entry = socketLiftEntries(source.entryways).find(row => row.lift.mover === owner);
  if (entry === undefined) return null;
  const at = sim.movers.pose(entry.lift.mover).position;
  return Math.hypot(at.x - entry.lift.roadStop[0], at.y - entry.lift.roadStop[1], at.z - entry.lift.roadStop[2]) > 0.001 ? entry.edge : null;
}
/** Reset only on load. Actual deck collision and capsule clearance decide boarding; an absent/blocked landing uses normal safe spawn. */
export function restoreLiftRider(source: Shardfile, sim: Pick<ShardfileSimulation, 'host' | 'movers' | 'water'>, edge: LiftRider): void {
  if (edge === null || !sim.host.hasPlayerMotor) return;
  const entry = socketLiftEntries(source.entryways).find(row => row.edge === edge), player = sim.host.player;
  const stop = entry?.lift.roadStop, feet = stop === undefined ? undefined : { x: stop[0], y: stop[1], z: stop[2] };
  const water = feet === undefined ? null : sim.water.restAt(feet.x, feet.z);
  const valid = feet !== undefined && entry !== undefined && (water === null || water <= feet.y + 0.15)
    && canStandAt(sim.host.physics, feet, player.motor.opts, entry.lift.mover, player.motor.collider);
  const at = valid ? feet : source.spawn;
  player.position.set(at.x, at.y, at.z); player.motor.resetAt(player.position);
}
