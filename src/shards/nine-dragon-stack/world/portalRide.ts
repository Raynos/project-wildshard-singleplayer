// G224 (E435): riding the portals. Walk into a deck's ring and the view fades to the night's ink, you stand in Lantern
// Square facing up it, and the view fades back; walk into the square's ring and you come out of the ring on the deck you
// came in by (portalPlan.ts `exitDeck`; the north deck if you spawned in the square). Walk-in, no prompt: the ring is the
// door. The body is held still from the ring's touch (the engine's `carried`), and under the dark the move is the
// format's checked transfer (SF8c, @wildshard/game/shardfile/portalTraversal): from the declared node you stand at to
// the node its link binds, both floors rechecked against the declared colliders and the capsule's clearance, the save
// fence (`portalTransitioning`) up for the whole synchronous move, then the engine's normal ride resets facing the
// admitted heading. Never an arbitrary spawn: a refused transfer fades back where you stand. A ring re-arms once you
// have stepped out of every portal, so arriving in one never bounces you back. Renderer-free (SF72): the ride runs the
// same in the page (world/portalVeil.ts draws its fade in the HUD) and in the headless host (runtime/portals.ts).
import { createPortalTraversal, type PortalTransfer, type PortalTraversalPorts } from '@wildshard/game/shardfile/portalTraversal';
import source from '../shard.config';
import { DECK_PORTALS, SQUARE_PORTAL, exitDeck, inPortal, squareExitId, type ShardEdge } from './portalPlan';

/** s: the fade to dark, the hold in the dark (the move happens as it starts), the fade back */
export const PORTAL_FADE = { out: 0.28, hold: 0.12, in: 0.4 } as const;

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

/** where the world's per-frame update finds the ride's step (world/build.ts) */
export interface PortalSlot { step: ((dt: number) => void) | null }

/** the portals while they run (captures and tests read them through the plugin's `portals`) */
export interface PortalRide {
  /** the deck you came in by this session, else null */
  readonly entered: () => ShardEdge | null;
  /** true from a ring's touch until the view is back */
  readonly busy: () => boolean;
  /** transfers completed this session, as the declared nodes they went from → to */
  readonly rides: () => readonly PortalTransfer[];
  /** transfers the format refused this session (why), each faded back where the player stood */
  readonly refused: () => readonly string[];
  /** one step of the ride (the session's update system calls it; tests drive it directly) */
  step: (dt: number) => void;
  /** the ride's whole state, for a checkpoint (the headless host's continuation) */
  snapshot: () => PortalRideState;
  /** resume exactly at a snapshot's state */
  restore: (state: PortalRideState) => void;
}

/** the ride's whole state: the deck you came in by, whether a ring is armed, the fade clock (−1 at rest), the node it
 *  rides from, whether the transfer is done, and the session's transfers and refusals */
export interface PortalRideState {
  readonly entered: ShardEdge | null; readonly armed: boolean; readonly t: number; readonly from: string; readonly moved: boolean;
  readonly rides: readonly PortalTransfer[]; readonly refused: readonly string[];
}

/** the pure ride: which ring the feet are in, the hold and the fade, the checked transfer under the dark */
export function portalRide(rider: PortalRider, veil: (k: number) => void): PortalRide {
  let entered: ShardEdge | null = null, armed = true, t = -1, from = '', moved = false;
  const done: PortalTransfer[] = [], refused: string[] = [];
  /** the declared node the ring you stand in is: a deck's road portal, or the square's exit bound to your deck */
  const touching = (): string | null => {
    const { x, y, z } = rider.position;
    for (const p of DECK_PORTALS) if (inPortal(p, x, y, z)) return p.id;
    if (inPortal(SQUARE_PORTAL, x, y, z)) return squareExitId(exitDeck(entered).edge);
    return null;
  };
  const transfer = (): void => {
    try {
      const r = rider.teleport(from);
      rider.settle(r.yaw);
      done.push(r);
      // the deck you came in by is the one whose road you left (the square's ring sends you back to it)
      const deck = DECK_PORTALS.find((p) => p.id === r.from);
      if (deck !== undefined) entered = deck.edge;
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
    if (!moved && t >= PORTAL_FADE.out) { transfer(); moved = true; }
    const back = PORTAL_FADE.out + PORTAL_FADE.hold;
    veil(t < PORTAL_FADE.out ? t / PORTAL_FADE.out : t < back ? 1 : Math.max(0, 1 - (t - back) / PORTAL_FADE.in));
    if (t >= back + PORTAL_FADE.in) { t = -1; veil(0); }
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

/** the player's side of the ride: the hold, the checked transfer in the player's current physics frame, the resets */
export function playerRider(player: PortalPlayer, physics: () => PortalTraversalPorts['physics']): PortalRider {
  // the shardfile's four portalLink entries (shard.config.ts), exactly as `wildshard validate` proves them
  const entries = source.entryways.flatMap((row) => (row.portal === undefined ? [] : [{ edge: row.edge, portal: row.portal }]));
  return {
    position: player.position,
    hold: (on) => { if (on && player.hover) player.setHover(false); player.carried = on; },
    // built per transfer: a grid frame rebinds the player's physics and motor (the links' rules are re-run, ~4 rows)
    teleport: (from) => createPortalTraversal(entries, source, { physics: physics(), motor: player.motor, feet: player.position }).teleport(from),
    settle: (yaw) => { const p = player.position; player.spawn(p.x, p.z, yaw, p.y); },
  };
}
