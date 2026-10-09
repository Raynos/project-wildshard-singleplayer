import * as v from 'valibot';
import { playerRider, portalRide, type PortalPlayer, type PortalRide } from '../world/portalRide';

/** The ride's fixed-step adapter id. */
export const PORTAL_STEP = 'nine-dragon-stack.portals';

interface Point { x: number; y: number; z: number }
/** What the ride uses of the renderer-free host (the engine's SimHost, structurally): its player, the player's fall,
 *  impulse, knockback and board, its physics, and a fixed-step system with continuation. */
export interface PortalHost {
  readonly player: { readonly position: PortalPlayer['position'] & { set: (x: number, y: number, z: number) => unknown }; yaw: number; readonly motor: PortalPlayer['motor'] };
  readonly physics: ReturnType<Parameters<typeof playerRider>[1]>;
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

/**
 * Nine Dragon's portal rides in the renderer-free host (SF72): the page's own ride and rider (world/portalRide.ts
 * `portalRide` + `playerRider`: the ring you walk into, the hold, the format's checked transfer under the dark on the
 * player's physics, motor and feet, the re-arm once you step out), driven by the host's fixed step after the player's
 * move as the page's world update runs it after the player's. The rider's player is the host's: `carried` is the page
 * Player's (no move, no velocity, off the ground: the feet stay at the ring's touch while the fade runs), `spawn` its
 * resets (the motor's anchor released, every velocity and the dash cleared, facing the admitted heading), the hoverboard the host's.
 * Nothing draws: the veil is the page's (world/portalVeil.ts). The ride's state and the hold are exact continuation.
 */
export function installNinePortals(host: PortalHost): PortalRide {
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
  const ride = portalRide(playerRider(body, () => host.physics), () => { /* the fade is the page's view */ });
  host.onStep(PORTAL_STEP, (dt) => {
    if (held !== null) keep(held);
    ride.step(dt);
  }, { snapshot: () => JSON.stringify({ held, ride: ride.snapshot() }), restore: (value) => {
    if (typeof value !== 'string') throw new Error('Invalid Nine portal continuation');
    const saved = v.parse(Saved, JSON.parse(value));
    held = saved.held; ride.restore(saved.ride);
  } });
  return ride;
}
