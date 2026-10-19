// G285: Nine Dragon's gameplay facts (data/ledger.ts), read off the same renderer-free laws the page and the headless host
// both run: the portal ride (world/portalRide.ts) and the Fei Zhua (grapple/sim.ts). Nothing here grants anything: each
// helper reports an outcome the step just played, and the platform ledger grants the declared achievement once.
import metadata from '../boot/metadata.generated.json' with { type: 'json' };

const NINE_FACT = metadata.ledgerFacts;

/** Where a fact goes: the page's bound ledger, or the headless host's effect buffer. */
export type NineFacts = (name: string, entity: string) => void;
/** What the square's test reads of one completed transfer (the format's `PortalTransfer`): the node it landed on. */
export interface LandedTransfer { readonly to: string }
/** the square's arrival node, shared by every deck's link (world/portalPlan.ts `portalLinks`) */
const ARRIVAL = 'portal.square.arrival';

/** One ride step: each transfer it completed that lands in Lantern Square reports the square's fact. */
export function rideFeats(step: (dt: number) => void, rides: () => readonly LandedTransfer[], fact: NineFacts): (dt: number) => void {
  return (dt) => {
    const before = rides().length;
    step(dt);
    rides().slice(before).forEach(ride => { if (ride.to === ARRIVAL) fact(NINE_FACT.square, ARRIVAL); });
  };
}
