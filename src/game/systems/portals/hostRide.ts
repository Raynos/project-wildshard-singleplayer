// hostRide — a walk-in ring ride in the renderer-free host (SHARD-PLATFORM M3, ex Nine Dragon's runtime/portals.ts, SF72):
// the page's own ride and rider (walkInRide), driven by the host's fixed step after the player's move as a page's world
// update runs it after the player's. The rider's player is the host's: `carried` holds the feet at the ring's touch (no
// move, no velocity, off the ground) while the fade runs, `spawn` is its resets (the motor's anchor released, every
// velocity and the dash cleared, facing the admitted heading), the hoverboard the host's. Nothing draws: the veil is the
// page's. The ride's state and the hold are exact continuation.
//
//   installHostRide(host, 'my-shard.portals', (body) => walkInRide(playerRider(body, () => host.physics, source), () => {}, rings));
import * as v from 'valibot';
import type { PortalPlayer, PortalRide } from './walkInRide';

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
  ride: v.strictObject({ entered: v.nullable(v.picklist(['north', 'east', 'south', 'west'])), armed: v.boolean(), t: finite, from: v.string(), moved: v.boolean(),
    rides: v.array(v.strictObject({ from: v.string(), to: v.string(), yaw: finite })), refused: v.array(v.string()) }),
});

/** Install a ride on the host's fixed step under `id`: `rideOf` makes it for the host's player, `stepOf` wraps its step
 *  (a shard's facts read off the rides it completes); a continuation that is not the ride's own is refused. */
export function installHostRide<Physics>(host: RideHost<Physics>, id: string, rideOf: (body: PortalPlayer) => PortalRide, stepOf: (ride: PortalRide) => (dt: number) => void = (ride) => ride.step): PortalRide {
  const player = host.player;
  let held: Point | null = null;
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
      held = on ? { x: player.position.x, y: player.position.y, z: player.position.z } : null;
      if (held !== null) keep(held);
    },
    setHover: (on) => { host.setBoard(on); },
    spawn: (x, z, yaw, y) => { player.yaw = yaw; player.motor.release(); host.playerDash.t = 0; keep({ x, y: y ?? player.position.y, z }); },
  };
  const ride = rideOf(body);
  const step = stepOf(ride);
  host.onStep(id, (dt) => {
    if (held !== null) keep(held);
    step(dt);
  }, { snapshot: () => JSON.stringify({ held, ride: ride.snapshot() }), restore: (value) => {
    if (typeof value !== 'string') throw new Error(`Invalid portal continuation (${id})`);
    const saved = v.parse(Saved, JSON.parse(value));
    held = saved.held; ride.restore(saved.ride);
  } });
  return ride;
}
