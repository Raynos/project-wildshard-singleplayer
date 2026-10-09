import { BatchedMesh } from 'three';
import { withOwner } from '@wildshard/engine/app/ownership';
import type { Interactables, InteractHost } from '@wildshard/engine/world/interact/Interactables';
import type { Scope } from '@wildshard/engine/app/scope';
import { DRIFTWOOD_INTERACT } from './interactables';
import { ownEnteredTree } from './Spine';

/** Build after lazy code admission under the actual entry owner, before registering its dependent cleanup. The two batches
 *  belong to that owner (SF57): a re-entered borrowed home runs this again, and the page scene must not keep each copy. */
export async function installAdventureInteractables(scope: Scope, host: InteractHost): Promise<Interactables> {
  const { Interactables } = await import('@wildshard/engine/world/interact/Interactables');
  if (scope.disposed) throw new Error('Driftwood adventure left while admitting its interactables');
  const before = new Set(host.scene.children);
  const kit = withOwner(scope, () => new Interactables(host).build(DRIFTWOOD_INTERACT));
  for (const node of host.scene.children) if (!before.has(node) && node instanceof BatchedMesh) ownEnteredTree(node, scope);
  scope.onDispose(() => { kit.dispose({ batches: false }); });
  return kit;
}
