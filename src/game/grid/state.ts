import type { SimHost } from '@wildshard/engine/sim';
import { regionalContinuation } from '@wildshard/engine/sim/snapshot';
import { regionalPhysicsState } from '@wildshard/engine/physics/regionalState';
/** Authored state hash input excludes global placement, platform collision geometry and profile-owned traveler data. */
export function regionalState(host: SimHost): string {
  return JSON.stringify({ continuation: regionalContinuation(host),
    physics: regionalPhysicsState(host.physics) });
}
