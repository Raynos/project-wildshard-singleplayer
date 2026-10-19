// hostRide — a walk-in ring ride in the renderer-free host (SHARD-PLATFORM M3, ex Nine Dragon's runtime/portals.ts, SF72):
// the page's own ride and rider (walkInRide), driven by the host's fixed step after the player's move as a page's world
// update runs it after the player's. The rider's player is the host's: `carried` holds the feet at the ring's touch (no
// move, no velocity, off the ground) while the fade runs, `spawn` is its resets (the motor's anchor released, every
// velocity and the dash cleared, facing the admitted heading), the hoverboard the host's. Nothing draws: the veil is the
// page's. The ride's state and the hold are exact continuation.
//
//   installHostRide(host, 'my-shard.portals', (body) => walkInRide(playerRider(body, () => host.physics, source), () => {}, rings));
import * as v from 'valibot';
import { createPortalRide, PortalRideStateSchema, type RideRings } from '@wildshard/game/shardfile/walkInPortalRide';
import { createPortalTraversal, type PortalTraversalPorts } from '@wildshard/game/shardfile/portalTraversal';
import type { PortalSource, PortalRider, PortalPlayer, PortalRide } from './types';
import type { PortalLinkEntry } from '@wildshard/format/portalLinkAssets';

interface Point { x: number; y: number; z: number }
/** What the ride uses of the renderer-free host (the engine's SimHost, structurally): its player, the player's fall,
 *  impulse, knockback and board, its physics, and a fixed-step system with continuation. */
export interface RideHost<Physics> {
  readonly player: { readonly position: PortalPlayer['position'] & { set: (x: number, y: number, z: number) => unknown }; yaw: number; readonly motor: PortalPlayer['motor'] };
  readonly physics: Physics;
  readonly playerFall: { vy: number; grounded: boolean };
  readonly playerImpulse: { set: (x: number, y: number, z: number) => unknown };
  readonly playerShove: { t: number };
  readonly playerDash: { t: number };
  readonly playerBoard: { readonly on: boolean };
  setBoard: (on: boolean) => void;
  onStep: (id: string, run: (dt: number) => void, adapter: { snapshot: () => string; restore: (value: unknown) => void }) => unknown;
}

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({
  held: v.nullable(v.strictObject({ x: finite, y: finite, z: finite })),
  ride: PortalRideStateSchema,
});

/** Install a ride on the host's fixed step under `id`: `rideOf` makes it for the host's player, `stepOf` wraps its step
 *  (a shard's facts read off the rides it completes); a continuation that is not the ride's own is refused. */
export function installHostRide<Physics>(host: RideHost<Physics>, id: string, rideOf: (body: PortalPlayer) => PortalRide, stepOf: (ride: PortalRide) => (dt: number) => void = (ride) => ride.step): PortalRide {
  const player = host.player;
  let held: Point | null = null;
  const holdPoint = { x: 0, y: 0, z: 0 }, spawnPoint = { x: 0, y: 0, z: 0 };
  const keep = (at: Point): void => {
    player.position.set(at.x, at.y, at.z); player.motor.resetAt(at);
    host.playerFall.vy = 0; host.playerFall.grounded = false; host.playerImpulse.set(0, 0, 0); host.playerShove.t = 0;
  };
  const body: PortalPlayer = {
    // the motor is read each time: a restore rebuilds the player's motor on the restored physics after install
    position: player.position, get motor() { return player.motor; },
    get hover() { return host.playerBoard.on; },
    get carried() { return held !== null; },
    set carried(on) {
      holdPoint.x = player.position.x; holdPoint.y = player.position.y; holdPoint.z = player.position.z;
      held = on ? holdPoint : null;
      if (held !== null) keep(held);
    },
    setHover: (on) => { host.setBoard(on); },
    spawn: (x, z, yaw, y) => { player.yaw = yaw; player.motor.release(); host.playerDash.t = 0; spawnPoint.x = x; spawnPoint.y = y ?? player.position.y; spawnPoint.z = z; keep(spawnPoint); },
  };
  const ride = rideOf(body);
  const advanceRide = stepOf(ride);
  host.onStep(id, (dt) => {
    if (held !== null) keep(held);
    advanceRide(dt);
  }, { snapshot: () => JSON.stringify({ held, ride: ride.snapshot() }), restore: (value) => {
    if (typeof value !== 'string') throw new Error(`Invalid portal continuation (${id})`);
    const saved = v.parse(Saved, JSON.parse(value));
    ride.restore(saved.ride); held = saved.held;
  } });
  return ride;
}

/** Native view/service wiring; all trigger, fade and routing decisions are rows. */
export function bindPortalRide(rider: PortalRider, veil: (amount: number) => void, rings: RideRings): PortalRide {
  const lane = createPortalRide(rings);
  return { entered: lane.entered, busy: lane.busy, rides: lane.rides, refused: lane.refused, snapshot: lane.snapshot, restore: lane.restore,
    step: dt => {
      const frame = lane.observe(dt, rider.position);
      for (let index = 0; index < 3; index++) {
        const command = frame.commands[index]; if (command === undefined) break;
        if (command.kind === 'hold') { rider.hold(command.on); continue; }
        try { const transfer = rider.teleport(command.from); rider.settle(transfer.yaw); lane.complete(transfer); }
        catch (error) { lane.refuse(error instanceof Error ? error.message : String(error)); }
      }
      veil(frame.veil);
    } };
}
/** Read the actual admitted nodes for both trigger selection and checked transfer; missing links never become portals. */
export function declaredPortals(source: PortalSource): PortalLinkEntry[] {
  return source.entryways.flatMap(row => row.portal === undefined ? [] : [{ edge: row.edge, portal: row.portal }]);
}

/** the player's side of the ride: the hold, the checked transfer in the player's current physics frame, the resets */
export function playerRider(player: PortalPlayer, physics: () => PortalTraversalPorts['physics'], source: PortalSource): PortalRider {
  // the shardfile's portalLink entries, exactly as `wildshard validate` proves them
  const entries = declaredPortals(source), spawnPlayer = player.spawn.bind(player);
  const ports = { physics: physics(), motor: player.motor, feet: player.position };
  const traversal = createPortalTraversal(entries, source, ports);
  const transferPlayer = (from: string): ReturnType<typeof traversal.teleport> => {
    ports.physics = physics(); ports.motor = player.motor;
    return traversal.teleport(from);
  };
  return {
    position: player.position,
    hold: (on) => { if (on && player.hover) player.setHover(false); player.carried = on; },
    // built per transfer: a grid frame rebinds the player's physics and motor (the links' rules are re-run, ~4 rows)
    teleport: transferPlayer,
    settle: (yaw) => { const p = player.position; spawnPlayer(p.x, p.z, yaw, p.y); },
  };
}
