import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import type { Vector3 } from 'three';
import type { NativeGroupHost } from './groupPorts';

/** Native flock or actor prey; decisions and tuning live in the declared engine policy. */
export interface PackPrey {
  readonly position: Vector3; readonly yaw: number; readonly alive: boolean;
  readonly applyDamage: (amount: number, hitPoint: Vector3, dir: Vector3) => boolean;
}
/** The raid/strike/view recipes retain their existing structural controller surface. */
export type PackController = Pick<PackBrain<Animal>, 'members' | 'alpha' | 'phase' | 'awareness' | 'homeX' | 'homeZ'
  | 'prey' | 'findPrey' | 'tick' | 'drive' | 'scare' | 'raid' | 'alive'>;
/** Riding, taming and unique elites remain native recipes; the shared policy is renderer-free. */
export type HerdController = Pick<HerdBrain<Animal>, 'members' | 'lead' | 'stallion' | 'foals' | 'mode' | 'stampeding'
  | 'stallionState' | 'trust' | 'alert' | 'alertOwned' | 'calm' | 'ridden' | 'cx' | 'cz' | 'tick' | 'drive'
  | 'setRidden' | 'addTrust' | 'disturb' | 'stampede' | 'leadAway' | 'adoptStallion' | 'releaseStallion'>
  & { findWolf?: ((x: number, z: number, r: number) => Animal | null) | undefined };
// SF57: the lookups are keyed by member only. A module-level list of every controller (`Pack.all`, `HorseHerd.all`)
// kept each visit's packs and herds, their members and the AnimalManager behind them, for the page's life.
const packOf = new WeakMap<Animal, PackController>(), herdOf = new WeakMap<Animal, HerdController>();

/** One lookup for species and raid recipes; no scheduler or RNG ownership. */
export const Pack = {
  of(actor: Animal): PackController | null { return packOf.get(actor) ?? null; },
  register(controller: PackController): void { for (const actor of controller.members) packOf.set(actor, controller); },
};
/** Native riders and adopted elites share this lookup; registration performs no setup draws. */
export const HorseHerd = {
  of(actor: Animal): HerdController | null { return herdOf.get(actor) ?? null; },
  register(controller: HerdController): void { for (const actor of controller.members) herdOf.set(actor, controller); },
};

let fallbackHost: NativeGroupHost | null = null;
/**
 * Bind the group services a manager-only fallback group asks (runtime/groupDispatch.ts): the page binds the app's
 * (runtime/groupHost.ts) when its creatures attach, a trusted Node host its own. Returns the unbind for the caller's scope.
 */
export function bindFallbackGroupHost(host: NativeGroupHost): () => void {
  fallbackHost = host;
  return () => { if (fallbackHost === host) fallbackHost = null; };
}
/** The bound fallback group host; an unbound one refuses rather than inventing a decision stream. */
export function fallbackGroupHost(): NativeGroupHost {
  if (fallbackHost === null) throw new Error('Nalati fallback group has no bound host');
  return fallbackHost;
}
