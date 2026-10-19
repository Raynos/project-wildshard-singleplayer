import type { PortalRideState } from '@wildshard/game/shardfile/walkInPortalRide';
import type { PortalTraversalPorts, PortalTransfer } from '@wildshard/game/shardfile/portalTraversal';
import type { PortalLinkEntry, portalLinkRules } from '@wildshard/format/portalLinkAssets';

export interface PortalRider {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  /** hold the body still (true from the ring's touch until the transfer, so it stays at the node it touched) */
  hold: (on: boolean) => void;
  /** the format's checked transfer from a declared portal node (throws when it is refused: the player stays put) */
  teleport: (from: string) => PortalTransfer;
  /** the engine's normal ride resets at the feet the transfer set (velocity, ride, interpolation), facing `yaw` */
  settle: (yaw: number) => void;
}
/** the portals while they run (captures and tests read them through the plugin's `portals`) */
export interface PortalRide {
  /** the road you came in by this session, else null */
  readonly entered: () => PortalLinkEntry['edge'] | null;
  /** true from a ring's touch until the view is back */
  readonly busy: () => boolean;
  /** transfers completed this session, as the declared nodes they went from → to */
  readonly rides: () => readonly PortalTransfer[];
  /** transfers the format refused this session (why), each faded back where the player stood */
  readonly refused: () => readonly string[];
  /** one step of the ride (the session's update system calls it; tests drive it directly) */
  step: (dt: number) => void;
  snapshot: () => PortalRideState;
  restore: (state: PortalRideState) => void;
}
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

