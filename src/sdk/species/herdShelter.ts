import { HerdShelter as PlatformHerdShelter, type HerdShelterLook as PlatformHerdShelterLook } from '@wildshard/game/systems/species/herdShelter';

/** Grazing herds sheltering from the rain, as data (SHARD-PLATFORM M3): the kinds, the big trees, the reach, the hold. */
export type HerdShelterLook = PlatformHerdShelterLook;
/** The herds' shelters through a shower: held under a big tree in the rain, walked back home after it. */
export const HerdShelter: typeof PlatformHerdShelter = PlatformHerdShelter;
