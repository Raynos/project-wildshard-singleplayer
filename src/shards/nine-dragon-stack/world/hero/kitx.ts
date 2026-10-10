// The swept kit is the SDK's (@wildshard/sdk/kit/sweptKit, SHARD-PLATFORM M3, the kit system), under the names the
// hero's and the layout's builders use.
import { SweptKit, type SweptLook, curve as sweptCurve, mergeKits } from '@wildshard/sdk/kit/sweptKit';

/** the layout's and the hero's swept kit */
export class KitX extends SweptKit {}
/** how a swept piece looks */
export type XLook = SweptLook;
/** merge Kit and KitX geometries (same attribute set) into one */
export const merge: typeof mergeKits = mergeKits;
/** a smooth path through control points */
export const curve: typeof sweptCurve = sweptCurve;
