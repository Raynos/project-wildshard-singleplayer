import { ActorProjectionV2,type ActorProjectionOwner } from '../population/actorProjectionV2';
import type { ThinkCtx } from '@wildshard/engine/entities/species/registry';
import type { Animal } from '@wildshard/engine/entities/AnimalView';

interface GuardBinding {readonly projection:ActorProjectionV2;readonly owner:ActorProjectionOwner}
const guards = new WeakMap<Animal, GuardBinding>();

/** A crowd guardian's projection, which every guardian of a shard's crowds shares. */
export function crowdGuardProjection(...args: ConstructorParameters<typeof ActorProjectionV2>): ActorProjectionV2 { return new ActorProjectionV2(...args); }
/** Bind a guardian to the crowd it keeps; the crowd's view stays on the page. */
export function bindCrowdGuard(actor: Animal, projection: ActorProjectionV2, owner: ActorProjectionOwner): void { guards.set(actor,{projection,owner}); }

/** Native species slot over a bound crowd; authored decisions stay in its guest. */
export function thinkCrowdGuard(actor: Animal, context: ThinkCtx): void {
  const bound = guards.get(actor);
  if (bound === undefined || !actor.alive) { actor.setMotion(actor.yaw, 0, 1); return; }
  bound.projection.step(actor,context,bound.owner);
}
