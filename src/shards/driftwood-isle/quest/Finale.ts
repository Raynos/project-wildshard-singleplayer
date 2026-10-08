import { app } from '@wildshard/engine/app/runtime';
import { installLegacyFinale, installDirectorFinale, type FinaleAdventure as RuntimeAdventure, type FinaleWorld as RuntimeWorld } from '../runtime/finale';
import type { AdvAnimal } from './adventure';

/** Legacy service boundary retained until SF46 retires the native combat/view recipe. */
export type FinaleHost = Pick<typeof app, 'events' | 'encounters' | 'levelScope' | 'engineScope' | 'clock'>;

/** The runtime keeps the boss/camera recipes while the admitted director owns finale decisions and timers. */
export type Finale = ReturnType<typeof installLegacyFinale>;
/** Minimal quest ports used by the runtime recipe and its real-code replay oracle. */
export type FinaleAdventure = RuntimeAdventure;
/** Minimal presentation/combat ports; no renderer construction is required by a replay. */
export type FinaleWorld<A extends AdvAnimal> = RuntimeWorld<A>;

export function installFinale<A extends AdvAnimal>(adv: FinaleAdventure, world: FinaleWorld<A>): Finale;
export function installFinale<A extends AdvAnimal>(adv: FinaleAdventure, world: FinaleWorld<A>, context: Parameters<typeof installDirectorFinale>[2]): Promise<Finale>;
export function installFinale<A extends AdvAnimal>(adv: FinaleAdventure, world: FinaleWorld<A>, context?: Parameters<typeof installDirectorFinale>[2]): Finale | Promise<Finale> {
  if (context === undefined) return installLegacyFinale(adv, world, app);
  const owner = context.scope, host: FinaleHost = { events: app.events, encounters: app.encounters, levelScope: owner,
    engineScope: app.engineScope, clock: app.clock };
  // SF57: the recipe (its boss bar, reward beat and update) is built synchronously under the shard's scope, never under the
  // page's ambient owner that an awaiting caller is left with
  return owner.run(() => installDirectorFinale(adv, world, context, host));
}
