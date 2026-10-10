import { reflectionCards as platformReflectionCards, stairReflectionCards as platformStairReflectionCards, type ReflectCardProgram as PlatformReflectCardProgram, type ReflectCardRow as PlatformReflectCardRow, type ReflectCardSet as PlatformReflectCardSet, type ReflectPlane as PlatformReflectPlane, type StairCardPlan as PlatformStairCardPlan, type StairCardRow as PlatformStairCardRow } from '@wildshard/game/systems/looks/reflectionCards';

/** A reflecting plane: a point on it, its axis along x, its normal, and its extent (x0, z0, x1, z1). */
export type ReflectPlane = PlatformReflectPlane;
/** A reflection card set's look as data. */
export type ReflectCardRow = PlatformReflectCardRow;
/** One reflection card set: its plane (or the ground's height), hole, gain, lift, width and dash. */
export type ReflectCardSet = PlatformReflectCardSet;
/** The shard's card program, its shared uniforms, its look row and the shared perf knobs. */
export type ReflectCardProgram<P extends string = string> = PlatformReflectCardProgram<P>;
/** A stair's flights and landings, for its card sets. */
export type StairCardPlan = PlatformStairCardPlan;
/** A stair's card sets as data. */
export type StairCardRow = PlatformStairCardRow;
/** One wet-ground reflection card set: a card per emitter on a plane (SHARD-PLATFORM M3). */
export const reflectionCards: typeof platformReflectionCards = platformReflectionCards;
/** A stair's reflection card sets: one per flight (half a rise under its nosing line) and one per landing. */
export const stairReflectionCards: typeof platformStairReflectionCards = platformStairReflectionCards;
