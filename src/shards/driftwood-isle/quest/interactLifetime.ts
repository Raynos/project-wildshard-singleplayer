import { withOwner } from '@wildshard/engine/app/ownership';
import type { Interactables, InteractHost } from '@wildshard/engine/world/interact/Interactables';
import type { Scope } from '@wildshard/engine/app/scope';
import { DRIFTWOOD_INTERACT } from './interactables';

/** Build after lazy code admission under the actual entry owner, before registering its dependent cleanup. */
export async function installAdventureInteractables(scope: Scope, host: InteractHost): Promise<Interactables> {
  const { Interactables } = await import('@wildshard/engine/world/interact/Interactables');
  if (scope.disposed) throw new Error('Driftwood adventure left while admitting its interactables');
  const kit = withOwner(scope, () => new Interactables(host).build(DRIFTWOOD_INTERACT));
  scope.onDispose(() => { kit.dispose({ batches: false }); });
  return kit;
}
