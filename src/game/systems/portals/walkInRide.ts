// walkInRide — riding ring portals (SHARD-PLATFORM M3, ex Nine Dragon's world/portalRide.ts, G224). Walk into a road's
// ring and the view fades to dark, you stand at the shared arrival, and the view fades back; walk into the way out's ring
// and you come out of the ring on the road you came in by (ringPortals `exitRoad`; the first road if you spawned inside).
// Walk-in, no prompt: the ring is the door. The body is held still from the ring's touch, and under the dark the move is
// the format's checked transfer (SF8c, game shardfile/portalTraversal): from the declared node you stand at to the node
// its link binds, both floors rechecked against the declared colliders and the capsule's clearance, then the engine's
// normal ride resets facing the admitted heading. A refused transfer fades back where you stand. A ring re-arms once you
// have stepped out of every portal, so arriving in one never bounces you back. Renderer-free: the same in a page (whose
// veil draws the fade) and in a headless host.
//
//   const ride = walkInRide(playerRider(player, () => physics, source), veil, { roads, out, trigger, fade });
import { createPortalTraversal, type PortalTransfer, type PortalTraversalPorts } from '../../shardfile/portalTraversal';
import type { PortalLinkEntry, portalLinkRules } from '../../shardfile/portalLink';
import { type EdgePortal, type RingPortal, type RingTrigger, type ShardEdge, exitNodeId, exitRoad, inRingPortal } from './ringPortals';

/** s: the fade to dark, the hold in the dark (the move happens as it starts), the fade back */
export interface RideFade { readonly out: number; readonly hold: number; readonly in: number }

/** the rings a ride watches: the roads', the way out's, their walk-in volume and the fade */
export interface RideRings {
  readonly roads: readonly EdgePortal[];
  readonly out: RingPortal;
  readonly trigger: RingTrigger;
  readonly fade: RideFade;
}

/** what the ride needs of the player */
export interface PortalRider {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  /** hold the body still (true from the ring's touch until the transfer, so it stays at the node it touched) */
  hold: (on: boolean) => void;
  /** the format's checked transfer from a declared portal node (throws when it is refused: the player stays put) */
  teleport: (from: string) => PortalTransfer;
  /** the engine's normal ride resets at the feet the transfer set (velocity, ride, interpolation), facing `yaw` */
  settle: (yaw: number) => void;
}

/** the portals while they run */
export interface PortalRide {
  /** the road you came in by this session, else null */
  readonly entered: () => ShardEdge | null;
  /** true from a ring's touch until the view is back */
  readonly busy: () => boolean;
  /** transfers completed this session, as the declared nodes they went from → to */
  readonly rides: () => readonly PortalTransfer[];
  /** transfers the format refused this session (why), each faded back where the player stood */
  readonly refused: () => readonly string[];
  /** one step of the ride (the session's update system calls it; tests drive it directly) */
  step: (dt: number) => void;
  /** the ride's whole state, for a checkpoint (a headless host's continuation) */
  snapshot: () => PortalRideState;
  /** resume exactly at a snapshot's state */
  restore: (state: PortalRideState) => void;
}

/** the ride's whole state: the road you came in by, whether a ring is armed, the fade clock (−1 at rest), the node it
 *  rides from, whether the transfer is done, and the session's transfers and refusals */
export interface PortalRideState {
  readonly entered: ShardEdge | null; readonly armed: boolean; readonly t: number; readonly from: string; readonly moved: boolean;
  readonly rides: readonly PortalTransfer[]; readonly refused: readonly string[];
}

/** the pure ride: which ring the feet are in, the hold and the fade, the checked transfer under the dark; `veil(k)` is the
 *  fade, 0 clear to 1 dark */
export function walkInRide(rider: PortalRider, veil: (k: number) => void, rings: RideRings): PortalRide {
  const { roads, out, trigger, fade } = rings;
  let entered: ShardEdge | null = null, armed = true, t = -1, from = '', moved = false;
  const done: PortalTransfer[] = [], refused: string[] = [];
  /** the declared node the ring you stand in is: a road's portal, or the way out's exit bound to your road */
  const touching = (): string | null => {
    const { x, y, z } = rider.position;
    for (const p of roads) if (inRingPortal(p, trigger, x, y, z)) return p.id;
    if (inRingPortal(out, trigger, x, y, z)) return exitNodeId(out, exitRoad(roads, entered).edge);
    return null;
  };
  const transfer = (): void => {
    try {
      const r = rider.teleport(from);
      rider.settle(r.yaw);
      done.push(r);
      // the road you came in by is the one whose ring you left (the way out sends you back to it)
      const road = roads.find((p) => p.id === r.from);
      if (road !== undefined) entered = road.edge;
    } catch (error) {
      refused.push(error instanceof Error ? error.message : String(error));
    } finally { rider.hold(false); }
  };
  const step = (dt: number): void => {
    if (t < 0) {
      const hit = touching();
      if (hit === null) { armed = true; return; }
      if (!armed) return;
      from = hit; t = 0; moved = false; armed = false;
      rider.hold(true);
    }
    t += Math.min(dt, 0.1);
    if (!moved && t >= fade.out) { transfer(); moved = true; }
    const back = fade.out + fade.hold;
    veil(t < fade.out ? t / fade.out : t < back ? 1 : Math.max(0, 1 - (t - back) / fade.in));
    if (t >= back + fade.in) { t = -1; veil(0); }
  };
  const snapshot = (): PortalRideState => ({ entered, armed, t, from, moved, rides: done.map((r) => ({ ...r })), refused: [...refused] });
  const restore = (state: PortalRideState): void => {
    entered = state.entered; armed = state.armed; t = state.t; from = state.from; moved = state.moved;
    done.splice(0, done.length, ...state.rides.map((r) => ({ ...r }))); refused.splice(0, refused.length, ...state.refused);
  };
  return { entered: () => entered, busy: () => t >= 0, rides: () => done, refused: () => refused, step, snapshot, restore };
}

/** what the ride uses of the engine's player: its feet and capsule, the hold, the hoverboard, the spawn's resets */
export interface PortalPlayer {
  readonly position: PortalTraversalPorts['feet'];
  readonly motor: PortalTraversalPorts['motor'];
  hover: boolean;
  carried: boolean;
  setHover: (on: boolean) => void;
  spawn: (x: number, z: number, yaw: number, y?: number) => void;
}

/** a shardfile's portal entries and the rules' inputs (its props and collision) */
export type PortalSource = Parameters<typeof portalLinkRules>[1] & { readonly entryways: readonly { readonly edge: PortalLinkEntry['edge']; readonly portal?: PortalLinkEntry['portal'] }[] };

/** the player's side of the ride: the hold, the checked transfer in the player's current physics frame, the resets */
export function playerRider(player: PortalPlayer, physics: () => PortalTraversalPorts['physics'], source: PortalSource): PortalRider {
  // the shardfile's portalLink entries, exactly as `wildshard validate` proves them
  const entries = source.entryways.flatMap((row) => (row.portal === undefined ? [] : [{ edge: row.edge, portal: row.portal }]));
  return {
    position: player.position,
    hold: (on) => { if (on && player.hover) player.setHover(false); player.carried = on; },
    // built per transfer: a grid frame rebinds the player's physics and motor (the links' rules are re-run, ~4 rows)
    teleport: (from) => createPortalTraversal(entries, source, { physics: physics(), motor: player.motor, feet: player.position }).teleport(from),
    settle: (yaw) => { const p = player.position; player.spawn(p.x, p.z, yaw, p.y); },
  };
}
