// G285: Nine Dragon's gameplay facts (data/ledger.ts), read off the same renderer-free laws the page and the headless host
// both run: the portal ride (world/portalRide.ts) and the Fei Zhua (grapple/sim.ts). Nothing here grants anything: each
// helper reports an outcome the step just played, and the platform ledger grants the declared achievement once.
import type { PortalTransfer } from '@wildshard/game/shardfile/portalTraversal';
import { NINE_FACT } from '../data/ledger';
import type { GrapplePhase } from '../grapple/sim';

/** Where a fact goes: the page's bound ledger, or the headless host's effect buffer. */
export type NineFacts = (name: string, entity: string) => void;
/** the square's arrival node, shared by every deck's link (world/portalPlan.ts `portalLinks`) */
const ARRIVAL = 'portal.square.arrival';

/** One ride step: each transfer it completed that lands in Lantern Square reports the square's fact. */
export function rideFeats(step: (dt: number) => void, rides: () => readonly PortalTransfer[], fact: NineFacts): (dt: number) => void {
  return (dt) => {
    const before = rides().length;
    step(dt);
    rides().slice(before).forEach(ride => { if (ride.to === ARRIVAL) fact(NINE_FACT.square, ARRIVAL); });
  };
}

/** What the crossing test reads of the grapple's law. */
export interface CrossingLaw { readonly phase: GrapplePhase; readonly target: { readonly lifts: boolean } | null; traverse: (dt: number) => boolean }
/** One traversal step: a lifting crossing that settles (settle → released on the far deck) reports the Well's fact. A zip
 *  that is blocked or times out releases from the zip, never from the settle, so it reports nothing. */
export function traverseFeats(law: CrossingLaw, dt: number, fact: NineFacts): boolean {
  const phase = (): GrapplePhase => law.phase, settling = phase() === 'settle' && law.target?.lifts === true;
  const owned = law.traverse(dt);
  if (settling && phase() === 'idle') fact(NINE_FACT.well, 'well');
  return owned;
}
