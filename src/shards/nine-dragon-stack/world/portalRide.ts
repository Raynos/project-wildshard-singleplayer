// G224 (E435): riding the portals. Walk into a deck's ring and the view fades to the night's ink, you stand in Lantern
// Square facing up it, and the view fades back; walk into the square's ring and you come out on the deck you came in by
// (portalPlan.ts `exitDeck`; the north deck if you spawned in the square). Walk-in, no prompt: the ring is the door.
// The move is one call under the dark (`spawn`: feet, yaw, velocity and any ride reset together), so a save or a grid
// continuation only ever sees the player before it or after it, standing on a floor (G209: never mid-teleport). A ring
// re-arms once you have stepped out of every portal, so arriving never bounces you back.
import { mountUi, uiScope } from '@wildshard/engine/ui/ownership';
import { DECK_PORTALS, SQUARE_ARRIVAL, SQUARE_PORTAL, deckArrival, exitDeck, inPortal, type Pose, type ShardEdge } from './portalPlan';

/** s: the fade to dark, the hold in the dark (the move happens as it starts), the fade back */
export const PORTAL_FADE = { out: 0.28, hold: 0.12, in: 0.4 } as const;

/** what the ride needs of the player: the feet, and the engine's spawn (feet, yaw, velocity and ride reset at once) */
export interface PortalRider {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  spawn: (x: number, z: number, yaw: number, y?: number) => void;
}

/** where the world's per-frame update finds the ride's step (world/build.ts) */
export interface PortalSlot { step: ((dt: number) => void) | null }

/** the portals while they run (captures and tests read them through the plugin's `portals`) */
export interface PortalRide {
  /** the deck you came in by this session, else null */
  readonly entered: () => ShardEdge | null;
  /** true from a ring's touch until the view is back */
  readonly busy: () => boolean;
  /** rides completed this session, by portal id */
  readonly rides: () => readonly string[];
  /** one step of the ride (the session's update system calls it; tests drive it directly) */
  step: (dt: number) => void;
}

/** the pure ride: which ring the feet are in, the fade, the move under the dark; `veil(0..1)` draws the fade */
export function portalRide(rider: PortalRider, veil: (k: number) => void): PortalRide {
  let entered: ShardEdge | null = null, armed = true, t = -1, target: Pose | null = null, moved = false, via = '';
  const done: string[] = [];
  const touching = (): { id: string; to: Pose; edge: ShardEdge | null } | null => {
    const { x, y, z } = rider.position;
    for (const p of DECK_PORTALS) if (inPortal(p, x, y, z)) return { id: p.id, to: SQUARE_ARRIVAL, edge: p.edge };
    if (inPortal(SQUARE_PORTAL, x, y, z)) return { id: SQUARE_PORTAL.id, to: deckArrival(exitDeck(entered)), edge: null };
    return null;
  };
  const step = (dt: number): void => {
    if (t < 0) {
      const hit = touching();
      if (hit === null) { armed = true; return; }
      if (!armed) return;
      // the deck you came in by is remembered as you step through its ring (the square's ring sends you back to it)
      if (hit.edge !== null) entered = hit.edge;
      target = hit.to; via = hit.id; t = 0; moved = false; armed = false;
    }
    t += Math.min(dt, 0.1);
    if (!moved && t >= PORTAL_FADE.out && target !== null) { rider.spawn(target.x, target.z, target.yaw, target.y); moved = true; }
    const back = PORTAL_FADE.out + PORTAL_FADE.hold;
    veil(t < PORTAL_FADE.out ? t / PORTAL_FADE.out : t < back ? 1 : Math.max(0, 1 - (t - back) / PORTAL_FADE.in));
    if (t >= back + PORTAL_FADE.in) { t = -1; target = null; done.push(via); veil(0); }
  };
  return { entered: () => entered, busy: () => t >= 0, rides: () => done, step };
}

/**
 * install the portals' ride for this session: the fade veil in the HUD (owned by the level's scope, so it goes with the
 * session) and the step, run by the world's own per-frame update (world/build.ts `portal`, after the player's)
 */
export function installPortals(slot: PortalSlot, rider: PortalRider): PortalRide {
  const scope = uiScope('NdPortalVeil');
  const el = document.createElement('div');
  el.className = 'nd-portal-veil';
  el.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;display:none;z-index:60;background:radial-gradient(circle at 50% 50%,#2a1648 0%,#0a0612 70%)';
  mountUi(el, scope);
  const ride = portalRide(rider, (k) => { el.style.opacity = k.toFixed(3); el.style.display = k > 0 ? 'block' : 'none'; });
  slot.step = (dt) => { ride.step(dt); };
  scope.onDispose(() => { slot.step = null; });
  return ride;
}
