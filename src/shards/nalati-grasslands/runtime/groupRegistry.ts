import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { PackBrain } from '@wildshard/engine/ai/pack';
import type { HerdBrain } from '@wildshard/engine/ai/herd';
import type { Vector3 } from 'three';

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
const packOf = new WeakMap<Animal, PackController>(), herdOf = new WeakMap<Animal, HerdController>();
const packs: PackController[] = [], herds: HerdController[] = [];

/** One lookup for species and raid recipes; no scheduler or RNG ownership. */
export const Pack = {
  all: packs,
  of(actor: Animal): PackController | null { return packOf.get(actor) ?? null; },
  register(controller: PackController): void {
    for (const actor of controller.members) packOf.set(actor, controller);
    if (!Pack.all.includes(controller)) Pack.all.push(controller);
  },
};
/** Native riders and adopted elites share this lookup; registration performs no setup draws. */
export const HorseHerd = {
  all: herds,
  of(actor: Animal): HerdController | null { return herdOf.get(actor) ?? null; },
  register(controller: HerdController): void {
    for (const actor of controller.members) herdOf.set(actor, controller);
    if (!HorseHerd.all.includes(controller)) HorseHerd.all.push(controller);
  },
};
